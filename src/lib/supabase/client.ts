import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Expense } from '@/types/expense';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback in-memory store for seamless local dev & demo without mandatory cloud creds
class LocalExpenseStore {
  private expenses: Expense[] = [
    {
      id: '1',
      monto: 4500,
      categoria: 'Alimentación',
      fecha: new Date(Date.now() - 86400000 * 2).toISOString(),
      fuente: 'foto',
      flag_anomalia: false,
      descripcion: 'Supermercado Coto',
      raw_text: 'SUPERMERCADO COTO TOTAL: $4500.00'
    },
    {
      id: '2',
      monto: 1200,
      categoria: 'Transporte',
      fecha: new Date(Date.now() - 86400000).toISOString(),
      fuente: 'voz',
      flag_anomalia: false,
      descripcion: 'Recarga SUBE',
      raw_text: 'cargué 1200 en la sube'
    },
    {
      id: '3',
      monto: 38000,
      categoria: 'Alimentación',
      fecha: new Date().toISOString(),
      fuente: 'foto',
      flag_anomalia: true,
      descripcion: 'Cena Restaurante Puerto Madero',
      raw_text: 'RESTAURANTE PUERTO MADERO TOTAL: $38000.00'
    }
  ];

  async getExpenses(): Promise<Expense[]> {
    return [...this.expenses].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  async getExpensesByCategory(category: string): Promise<Expense[]> {
    return this.expenses.filter(
      (e) => e.categoria.toLowerCase() === category.toLowerCase()
    );
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID()
    };
    this.expenses.unshift(newExpense);
    return newExpense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const prevLen = this.expenses.length;
    this.expenses = this.expenses.filter((e) => e.id !== id);
    return this.expenses.length < prevLen;
  }
}

export const localStore = new LocalExpenseStore();

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function fetchExpenses(): Promise<Expense[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false });
    if (!error && data) return data as Expense[];
  }
  return localStore.getExpenses();
}

export async function insertExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
  if (supabase) {
    const { data, error } = await supabase
      .from('gastos')
      .insert([expense])
      .select()
      .single();
    if (!error && data) return data as Expense;
  }
  return localStore.addExpense(expense);
}

export async function removeExpense(id: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    return !error;
  }
  return localStore.deleteExpense(id);
}
