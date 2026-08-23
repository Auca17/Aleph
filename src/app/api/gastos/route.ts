export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { fetchExpenses, insertExpense } from '@/lib/supabase/client';
import { processImageOcr } from '@/lib/qvac/ocr-pipeline';
import { processAudioTranscription } from '@/lib/qvac/transcription-pipeline';
import { parseAndCategorizeExpense } from '@/lib/qvac/llm-pipeline';
import { calculateAnomaly } from '@/lib/anomaly';
import { Expense, ExpenseSource } from '@/types/expense';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getRequestUserEmail(req: NextRequest): string | null {
  return req.headers.get('x-pockit-user-email');
}

function getPhotoAmountConfidence(rawText: string, monto: number) {
  const reasons: string[] = [];
  const hasTotalLabel =
    /\b(total|tot|importe|monto|suma\s+de\s+sus\s+pagos|total\s+a\s+pagar)\b|t[o0]ta[il1]/i.test(
      rawText
    );
  const hasPaymentLabel =
    /\b(pagado|pago|abonado|efectivo|tarjeta|visa|master|debito|débito|credito|crédito)\b/i.test(
      rawText
    );
  const numericMatches = rawText.match(/\d+(?:[.,]\d+)*/g) || [];
  const isShortOcr = rawText.trim().length < 25;

  if (monto <= 0) {
    return {
      level: 'baja',
      label: 'Baja confianza',
      reasons: ['No se detectó un monto confiable en el ticket']
    };
  }

  if (hasTotalLabel) {
    return {
      level: 'alta',
      label: 'Alta confianza',
      reasons: ['El OCR encontró una línea de total o importe']
    };
  }

  if (hasPaymentLabel) {
    return {
      level: 'media',
      label: 'Confianza media',
      reasons: ['El monto salió de una línea de pago, no de un total explícito']
    };
  }

  if (isShortOcr) reasons.push('El OCR extrajo poco texto');
  if (numericMatches.length > 8) reasons.push('El ticket tiene muchos números mezclados');

  return {
    level: reasons.length > 0 ? 'baja' : 'media',
    label: reasons.length > 0 ? 'Baja confianza' : 'Confianza media',
    reasons: reasons.length > 0 ? reasons : ['El monto salió de importes sueltos del OCR']
  };
}

export async function GET(req: NextRequest) {
  try {
    const expenses = await fetchExpenses(getRequestUserEmail(req));
    return NextResponse.json({ success: true, data: expenses });
  } catch (error: unknown) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const userEmail = getRequestUserEmail(req);
    const contentType = req.headers.get('content-type') || '';
    let fuente: ExpenseSource = 'manual';
    let rawText = '';
    let customMonto: number | null = null;
    let customCategoria: string | null = null;
    let customFecha: string | null = null;
    let customDescripcion: string | null = null;
    let requestAction: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      fuente = (formData.get('fuente') as ExpenseSource) || 'foto';
      const action = formData.get('action');
      requestAction = typeof action === 'string' ? action : null;
      const formMonto = formData.get('monto');
      const formCategoria = formData.get('categoria');
      const formFecha = formData.get('fecha');
      const formDescripcion = formData.get('descripcion');

      if (formMonto !== null) customMonto = Number(formMonto);
      if (typeof formCategoria === 'string' && formCategoria) customCategoria = formCategoria;
      if (typeof formFecha === 'string' && formFecha) customFecha = formFecha;
      if (typeof formDescripcion === 'string' && formDescripcion) {
        customDescripcion = formDescripcion;
      }

      if (file) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const tempDir = join(tmpdir(), 'pockit-uploads');
        await mkdir(tempDir, { recursive: true });

        const ext = file.name.split('.').pop() || (fuente === 'foto' ? 'png' : 'wav');
        tempFilePath = join(tempDir, `upload-${Date.now()}.${ext}`);
        await writeFile(tempFilePath, buffer);

        if (fuente === 'foto') {
          rawText = await processImageOcr(tempFilePath);
        } else if (fuente === 'voz') {
          rawText = await processAudioTranscription(tempFilePath);
        }
      }
    } else {
      const json = await req.json();
      fuente = json.fuente || 'manual';
      rawText = json.text || '';
      if (json.monto !== undefined) customMonto = Number(json.monto);
      if (json.categoria) customCategoria = json.categoria;
      if (json.fecha) customFecha = json.fecha;
      if (json.descripcion) customDescripcion = json.descripcion;
    }

    if (!rawText && customMonto === null) {
      return NextResponse.json(
        { success: false, error: 'No se recibió texto, audio o imagen para procesar' },
        { status: 400 }
      );
    }

    // Process with QVAC LLM if rawText extracted
    let parsed = {
      monto: customMonto ?? 0,
      categoria: customCategoria ?? 'Otros',
      fecha: customFecha ?? new Date().toISOString().split('T')[0],
      descripcion: customDescripcion ?? rawText.slice(0, 50)
    };

    if (rawText && (customMonto === null || !customCategoria)) {
      const llmParsed = await parseAndCategorizeExpense(rawText, fuente);
      parsed = {
        monto: customMonto ?? llmParsed.monto,
        categoria: customCategoria ?? llmParsed.categoria,
        fecha: customFecha ?? llmParsed.fecha ?? new Date().toISOString().split('T')[0],
        descripcion: customDescripcion ?? llmParsed.descripcion ?? rawText.slice(0, 50)
      };
    }

    if (requestAction === 'analyze' && fuente === 'foto') {
      return NextResponse.json({
        success: true,
        data: parsed,
        meta: {
          rawTextExtracted: rawText,
          photoConfidence: getPhotoAmountConfidence(rawText, parsed.monto)
        }
      });
    }

    // Calculate Anomaly in deterministic code
    const anomalyResult = await calculateAnomaly(parsed.monto, parsed.categoria, userEmail);

    const newExpense: Omit<Expense, 'id'> = {
      monto: parsed.monto,
      categoria: parsed.categoria,
      fecha: new Date(parsed.fecha).toISOString(),
      fuente,
      flag_anomalia: anomalyResult.isAnomaly,
      raw_text: rawText,
      descripcion: parsed.descripcion
    };

    const savedExpense = await insertExpense(newExpense, userEmail);

    return NextResponse.json({
      success: true,
      data: savedExpense,
      meta: {
        anomalyDetails: anomalyResult,
        rawTextExtracted: rawText,
        photoConfidence:
          fuente === 'foto' ? getPhotoAmountConfidence(rawText, parsed.monto) : null
      }
    });
  } catch (error: unknown) {
    console.error('Error processing expense:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'Error processing expense') },
      { status: 500 }
    );
  } finally {
    if (tempFilePath) {
      unlink(tempFilePath).catch(() => {});
    }
  }
}
