export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { removeIngreso } from '@/lib/supabase/client';

export async function DELETE(
  _req: NextRequest,
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

    const success = await removeIngreso(id);
    return NextResponse.json({ success });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error eliminando ingreso';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
