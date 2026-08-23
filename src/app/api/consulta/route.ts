export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Expense } from '@/types/expense';
import { Ingreso } from '@/types/ingreso';
import { fetchExpenses, fetchIngresos } from '@/lib/supabase/client';
import { answerExpenseQuery } from '@/lib/qvac/llm-pipeline';

function normalizeExpenseSnapshot(value: unknown): Expense[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      monto: Number(item.monto || 0),
      categoria: typeof item.categoria === 'string' ? item.categoria : 'Otros',
      fecha: typeof item.fecha === 'string' ? item.fecha : new Date().toISOString(),
      fuente: item.fuente === 'voz' || item.fuente === 'foto' || item.fuente === 'manual'
        ? item.fuente
        : 'manual',
      flag_anomalia: Boolean(item.flag_anomalia),
      raw_text: typeof item.raw_text === 'string' ? item.raw_text : undefined,
      descripcion: typeof item.descripcion === 'string' ? item.descripcion : undefined,
      created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
      reviewed: typeof item.reviewed === 'boolean' ? item.reviewed : undefined
    }));
}

function normalizeIncomeSnapshot(value: unknown): Ingreso[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      monto: Number(item.monto || 0),
      categoria: typeof item.categoria === 'string' ? item.categoria : 'Otros',
      fecha: typeof item.fecha === 'string' ? item.fecha : new Date().toISOString(),
      fuente: item.fuente === 'manual' || item.fuente === 'factura' || item.fuente === 'voz'
        ? item.fuente
        : 'manual',
      descripcion: typeof item.descripcion === 'string' ? item.descripcion : undefined,
      created_at: typeof item.created_at === 'string' ? item.created_at : undefined
    }));
}

function getRequestUserEmail(req: NextRequest): string | null {
  return req.headers.get('x-pockit-user-email');
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const pregunta = json.pregunta || json.query || json.message || '';

    if (!pregunta || typeof pregunta !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Debe incluir una pregunta' },
        { status: 400 }
      );
    }

    const userEmail = getRequestUserEmail(req);
    const expenseSnapshot = normalizeExpenseSnapshot(json.expensesSnapshot);
    const incomeSnapshot = normalizeIncomeSnapshot(json.incomesSnapshot);
    const [expenses, ingresos] = await Promise.all([
      expenseSnapshot.length > 0 ? Promise.resolve(expenseSnapshot) : fetchExpenses(userEmail),
      incomeSnapshot.length > 0 ? Promise.resolve(incomeSnapshot) : fetchIngresos(userEmail)
    ]);
    const tokenGenerator = answerExpenseQuery(pregunta, expenses, ingresos);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of tokenGenerator) {
            controller.enqueue(encoder.encode(token));
          }
          controller.close();
        } catch (err: unknown) {
          console.error('Streaming error in /api/consulta:', err);
          const message = err instanceof Error ? err.message : 'Error al procesar la respuesta del modelo';
          controller.enqueue(encoder.encode(`⚠️ Error: ${message}`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform'
      }
    });
  } catch (error: unknown) {
    console.error('Error in /api/consulta:', error);
    const message = error instanceof Error ? error.message : 'Error procesando consulta';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
