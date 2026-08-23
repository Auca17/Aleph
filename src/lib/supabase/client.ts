import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Expense } from '@/types/expense';
import { Ingreso } from '@/types/ingreso';

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

  private ingresos: Ingreso[] = [
    {
      id: 'ing-1',
      monto: 150000,
      categoria: 'Freelance',
      fecha: new Date(Date.now() - 86400000 * 5).toISOString(),
      fuente: 'manual',
      descripcion: 'Desarrollo Web Frontend Client X'
    },
    {
      id: 'ing-2',
      monto: 85000,
      categoria: 'Honorarios',
      fecha: new Date(Date.now() - 86400000 * 1).toISOString(),
      fuente: 'manual',
      descripcion: 'Consultoría Financiera Aleph'
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
    this.expenses = this.expenses.filter((e) => e.id !== id);
    return true;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | null> {
    const index = this.expenses.findIndex((e) => e.id === id);
    if (index === -1) {
      if (
        typeof updates.monto !== 'number' ||
        !updates.categoria ||
        !updates.fecha ||
        !updates.fuente
      ) {
        return null;
      }

      const insertedExpense: Expense = {
        id,
        monto: updates.monto,
        categoria: updates.categoria,
        fecha: updates.fecha,
        fuente: updates.fuente,
        flag_anomalia: updates.flag_anomalia ?? false,
        descripcion: updates.descripcion,
        raw_text: updates.raw_text,
        created_at: updates.created_at
      };
      this.expenses.unshift(insertedExpense);
      return insertedExpense;
    }

    const updatedExpense = {
      ...this.expenses[index],
      ...updates,
      id
    };
    this.expenses[index] = updatedExpense;
    return updatedExpense;
  }

  async getIngresos(): Promise<Ingreso[]> {
    return [...this.ingresos].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  async addIngreso(ingreso: Omit<Ingreso, 'id'>): Promise<Ingreso> {
    const newIngreso: Ingreso = {
      ...ingreso,
      id: crypto.randomUUID()
    };
    this.ingresos.unshift(newIngreso);
    return newIngreso;
  }

  async deleteIngreso(id: string): Promise<boolean> {
    const prevLen = this.ingresos.length;
    this.ingresos = this.ingresos.filter((i) => i.id !== id);
    return this.ingresos.length < prevLen;
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

export async function fetchIngresos(): Promise<Ingreso[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ingresos')
      .select('*')
      .order('fecha', { ascending: false });
    if (!error && data) return data as Ingreso[];
  }
  return localStore.getIngresos();
}

export async function insertIngreso(ingreso: Omit<Ingreso, 'id'>): Promise<Ingreso> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ingresos')
      .insert([ingreso])
      .select()
      .single();
    if (!error && data) return data as Ingreso;
  }
  return localStore.addIngreso(ingreso);
}

export async function removeIngreso(id: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.from('ingresos').delete().eq('id', id);
    return !error;
  }
  return localStore.deleteIngreso(id);
}

export async function updateExpense(
  id: string,
  updates: Partial<Expense>
): Promise<Expense | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('gastos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as Expense;

    if (updates.reviewed !== undefined) {
      const { reviewed, ...updatesWithoutReviewed } = updates;
      const retry = await supabase
        .from('gastos')
        .update(updatesWithoutReviewed)
        .eq('id', id)
        .select()
        .single();
      if (!retry.error && retry.data) {
        return { ...(retry.data as Expense), reviewed };
      }
    }

    return null;
  }
  return localStore.updateExpense(id, updates);
}
