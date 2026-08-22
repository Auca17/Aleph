export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { removeExpense } from '@/lib/supabase/client';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await removeExpense(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Gasto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Gasto eliminado' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error eliminando gasto';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
