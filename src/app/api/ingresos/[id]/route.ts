export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { removeIngreso, updateIngreso } from '@/lib/supabase/client';

function getRequestUserEmail(req: NextRequest): string | null {
  return req.headers.get('x-pockit-user-email');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const monto = Number(body.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido' },
        { status: 400 }
      );
    }

    const updatedIngreso = await updateIngreso(
      id,
      {
        monto,
        categoria: body.categoria || 'Otros',
        fecha: body.fecha || new Date().toISOString(),
        fuente: body.fuente || 'manual',
        descripcion: body.descripcion || ''
      },
      getRequestUserEmail(req)
    );

    if (!updatedIngreso) {
      return NextResponse.json(
        { success: false, error: 'Ingreso no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updatedIngreso });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error actualizando ingreso';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      );
    }

    const success = await removeIngreso(id, getRequestUserEmail(req));
    return NextResponse.json({ success });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error eliminando ingreso';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
