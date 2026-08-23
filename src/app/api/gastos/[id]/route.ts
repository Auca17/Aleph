export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { removeExpense, updateExpense } from '@/lib/supabase/client';
import { calculateAnomaly } from '@/lib/anomaly';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getRequestUserEmail(req: NextRequest): string | null {
  return req.headers.get('x-pockit-user-email');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await removeExpense(id, getRequestUserEmail(req));

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Gasto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Gasto eliminado' });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'Error eliminando gasto') },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const monto = Number(body.monto);
    const categoria = String(body.categoria || '').trim();
    const descripcion = String(body.descripcion || '').trim();
    const fecha = body.fecha ? new Date(body.fecha) : null;
    const fuente = ['foto', 'voz', 'manual'].includes(body.fuente) ? body.fuente : 'manual';
    const rawText = typeof body.raw_text === 'string' ? body.raw_text : undefined;
    const createdAt = typeof body.created_at === 'string' ? body.created_at : undefined;
    const reviewed = typeof body.reviewed === 'boolean' ? body.reviewed : undefined;

    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json(
        { success: false, error: 'El monto debe ser mayor a cero' },
        { status: 400 }
      );
    }

    if (!categoria || !descripcion) {
      return NextResponse.json(
        { success: false, error: 'Completá título y categoría' },
        { status: 400 }
      );
    }

    if (fecha && Number.isNaN(fecha.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Fecha inválida' },
        { status: 400 }
      );
    }

    const userEmail = getRequestUserEmail(req);
    const anomalyResult = await calculateAnomaly(monto, categoria, userEmail);
    const updated = await updateExpense(id, {
      monto,
      categoria,
      descripcion,
      fecha: (fecha ?? new Date()).toISOString(),
      fuente,
      raw_text: rawText,
      created_at: createdAt,
      reviewed,
      flag_anomalia: anomalyResult.isAnomaly
    }, userEmail);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Gasto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      meta: { anomalyDetails: anomalyResult }
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'Error actualizando gasto') },
      { status: 500 }
    );
  }
}
