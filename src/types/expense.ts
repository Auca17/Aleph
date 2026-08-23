export type ExpenseSource = 'voz' | 'foto' | 'manual';

export interface Expense {
  id?: string;
  monto: number;
  categoria: string;
  fecha: string; // ISO-8601
  fuente: ExpenseSource;
  flag_anomalia: boolean;
  raw_text?: string;
  descripcion?: string;
  created_at?: string;
  reviewed?: boolean;
}

export interface ParsedExpense {
  monto: number;
  categoria: string;
  fecha: string;
  descripcion?: string;
}
