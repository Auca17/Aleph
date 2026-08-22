export interface Ingreso {
  id: string;
  monto: number;
  categoria: string; // 'Honorarios' | 'Freelance' | 'Ventas' | 'Inversiones' | 'Otros'
  fecha: string;
  fuente?: 'manual' | 'factura' | 'voz';
  descripcion?: string;
  created_at?: string;
}
