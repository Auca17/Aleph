import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Expense } from '@/types/expense';
import { Ingreso } from '@/types/ingreso';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const DEMO_USER_EMAIL = 'demo@pockit.ai';

function normalizeUserEmail(userEmail?: string | null): string {
  return (userEmail || DEMO_USER_EMAIL).trim().toLowerCase();
}

function createDemoExpenses(): Expense[] {
  return [
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
}

function createDemoIngresos(): Ingreso[] {
  return [
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
      descripcion: 'Consultoría Financiera Pockit'
    }
  ];
}

// Fallback in-memory store for seamless local dev & demo without mandatory cloud creds
class LocalExpenseStore {
  private expensesByUser = new Map<string, Expense[]>();
  private ingresosByUser = new Map<string, Ingreso[]>();

  private getExpenseBucket(userEmail?: string | null): Expense[] {
    const key = normalizeUserEmail(userEmail);
    if (!this.expensesByUser.has(key)) {
      this.expensesByUser.set(key, key === DEMO_USER_EMAIL ? createDemoExpenses() : []);
    }
    return this.expensesByUser.get(key) || [];
  }

  private getIngresoBucket(userEmail?: string | null): Ingreso[] {
    const key = normalizeUserEmail(userEmail);
    if (!this.ingresosByUser.has(key)) {
      this.ingresosByUser.set(key, key === DEMO_USER_EMAIL ? createDemoIngresos() : []);
    }
    return this.ingresosByUser.get(key) || [];
  }

  async getExpenses(userEmail?: string | null): Promise<Expense[]> {
    return [...this.getExpenseBucket(userEmail)].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  async getExpensesByCategory(category: string, userEmail?: string | null): Promise<Expense[]> {
    return this.getExpenseBucket(userEmail).filter(
      (e) => e.categoria.toLowerCase() === category.toLowerCase()
    );
  }

  async addExpense(expense: Omit<Expense, 'id'>, userEmail?: string | null): Promise<Expense> {
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID()
    };
    this.getExpenseBucket(userEmail).unshift(newExpense);
    return newExpense;
  }

  async deleteExpense(id: string, userEmail?: string | null): Promise<boolean> {
    const bucket = this.getExpenseBucket(userEmail);
    const prevLen = bucket.length;
    const nextBucket = bucket.filter((e) => e.id !== id);
    this.expensesByUser.set(
      normalizeUserEmail(userEmail),
      nextBucket
    );
    return nextBucket.length < prevLen;
  }

  async updateExpense(
    id: string,
    updates: Partial<Expense>,
    userEmail?: string | null
  ): Promise<Expense | null> {
    const bucket = this.getExpenseBucket(userEmail);
    const index = bucket.findIndex((e) => e.id === id);
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
      bucket.unshift(insertedExpense);
      return insertedExpense;
    }

    const updatedExpense = {
      ...bucket[index],
      ...updates,
      id
    };
    bucket[index] = updatedExpense;
    return updatedExpense;
  }

  async getIngresos(userEmail?: string | null): Promise<Ingreso[]> {
    return [...this.getIngresoBucket(userEmail)].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  async addIngreso(ingreso: Omit<Ingreso, 'id'>, userEmail?: string | null): Promise<Ingreso> {
    const newIngreso: Ingreso = {
      ...ingreso,
      id: crypto.randomUUID()
    };
    this.getIngresoBucket(userEmail).unshift(newIngreso);
    return newIngreso;
  }

  async deleteIngreso(id: string, userEmail?: string | null): Promise<boolean> {
    const bucket = this.getIngresoBucket(userEmail);
    const prevLen = bucket.length;
    const nextBucket = bucket.filter((i) => i.id !== id);
    this.ingresosByUser.set(
      normalizeUserEmail(userEmail),
      nextBucket
    );
    return nextBucket.length < prevLen;
  }

  async updateIngreso(
    id: string,
    updates: Partial<Ingreso>,
    userEmail?: string | null
  ): Promise<Ingreso | null> {
    const bucket = this.getIngresoBucket(userEmail);
    const index = bucket.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const updatedIngreso = {
      ...bucket[index],
      ...updates,
      id
    };
    bucket[index] = updatedIngreso;
    return updatedIngreso;
  }
}

export const localStore = new LocalExpenseStore();

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function fetchExpenses(userEmail?: string | null): Promise<Expense[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false });
    if (!error && data) return data as Expense[];
  }
  return localStore.getExpenses(userEmail);
}

export async function insertExpense(
  expense: Omit<Expense, 'id'>,
  userEmail?: string | null
): Promise<Expense> {
  if (supabase) {
    const { data, error } = await supabase
      .from('gastos')
      .insert([expense])
      .select()
      .single();
    if (!error && data) return data as Expense;
  }
  return localStore.addExpense(expense, userEmail);
}

export async function removeExpense(id: string, userEmail?: string | null): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    return !error;
  }
  return localStore.deleteExpense(id, userEmail);
}

export async function fetchIngresos(userEmail?: string | null): Promise<Ingreso[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ingresos')
      .select('*')
      .order('fecha', { ascending: false });
    if (!error && data) return data as Ingreso[];
  }
  return localStore.getIngresos(userEmail);
}

export async function insertIngreso(
  ingreso: Omit<Ingreso, 'id'>,
  userEmail?: string | null
): Promise<Ingreso> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ingresos')
      .insert([ingreso])
      .select()
      .single();
    if (!error && data) return data as Ingreso;
  }
  return localStore.addIngreso(ingreso, userEmail);
}

export async function removeIngreso(id: string, userEmail?: string | null): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.from('ingresos').delete().eq('id', id);
    return !error;
  }
  return localStore.deleteIngreso(id, userEmail);
}

export async function updateIngreso(
  id: string,
  updates: Partial<Ingreso>,
  userEmail?: string | null
): Promise<Ingreso | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ingresos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as Ingreso;

    return null;
  }
  return localStore.updateIngreso(id, updates, userEmail);
}

export async function updateExpense(
  id: string,
  updates: Partial<Expense>,
  userEmail?: string | null
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
  return localStore.updateExpense(id, updates, userEmail);
}
