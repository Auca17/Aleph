export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { fetchExpenses } from '@/lib/supabase/client';
import { answerExpenseQuery } from '@/lib/qvac/llm-pipeline';

export async function POST(req: NextRequest) {
  try {
    const { pregunta } = await req.json();

    if (!pregunta || typeof pregunta !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Debe incluir una pregunta' },
        { status: 400 }
      );
    }

    const expenses = await fetchExpenses();
    const tokenGenerator = answerExpenseQuery(pregunta, expenses);

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
          controller.error(err);
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
