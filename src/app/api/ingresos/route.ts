export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { fetchIngresos, insertIngreso } from '@/lib/supabase/client';

export async function GET() {
  try {
    const data = await fetchIngresos();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error obteniendo ingresos';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { monto, categoria, fecha, fuente, descripcion } = body;

    if (!monto || isNaN(Number(monto))) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido' },
        { status: 400 }
      );
    }

    const nuevoIngreso = await insertIngreso({
      monto: Number(monto),
      categoria: categoria || 'Otros',
      fecha: fecha || new Date().toISOString(),
      fuente: fuente || 'manual',
      descripcion: descripcion || ''
    });

    return NextResponse.json({ success: true, data: nuevoIngreso });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creando ingreso';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
