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

export async function GET() {
  try {
    const expenses = await fetchExpenses();
    return NextResponse.json({ success: true, data: expenses });
  } catch (error: unknown) {
    console.error('Error fetching expenses:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const contentType = req.headers.get('content-type') || '';
    let fuente: ExpenseSource = 'manual';
    let rawText = '';
    let customMonto: number | null = null;
    let customCategoria: string | null = null;
    let customFecha: string | null = null;
    let customDescripcion: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      fuente = (formData.get('fuente') as ExpenseSource) || 'foto';

      if (file) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const tempDir = join(tmpdir(), 'aleph-uploads');
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
      const llmParsed = await parseAndCategorizeExpense(rawText);
      parsed = {
        monto: customMonto ?? llmParsed.monto,
        categoria: customCategoria ?? llmParsed.categoria,
        fecha: customFecha ?? llmParsed.fecha ?? new Date().toISOString().split('T')[0],
        descripcion: customDescripcion ?? llmParsed.descripcion ?? rawText.slice(0, 50)
      };
    }

    // Calculate Anomaly in deterministic code
    const anomalyResult = await calculateAnomaly(parsed.monto, parsed.categoria);

    const newExpense: Omit<Expense, 'id'> = {
      monto: parsed.monto,
      categoria: parsed.categoria,
      fecha: new Date(parsed.fecha).toISOString(),
      fuente,
      flag_anomalia: anomalyResult.isAnomaly,
      raw_text: rawText,
      descripcion: parsed.descripcion
    };

    const savedExpense = await insertExpense(newExpense);

    return NextResponse.json({
      success: true,
      data: savedExpense,
      meta: {
        anomalyDetails: anomalyResult,
        rawTextExtracted: rawText
      }
    });
  } catch (error: unknown) {
    console.error('Error processing expense:', error);
    const message = error instanceof Error ? error.message : 'Error processing expense';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  } finally {
    if (tempFilePath) {
      unlink(tempFilePath).catch(() => {});
    }
  }
}
