import { supabase, localStore } from '@/lib/supabase/client';

/**
 * Calculates whether an expense is an anomaly based on historical data.
 * Compares against the average of the last N expenses in the same category.
 * Flagged as anomaly if amount > 2x average (and at least 3 historical records exist).
 */
export async function calculateAnomaly(
  monto: number,
  categoria: string
): Promise<{ isAnomaly: boolean; average: number; count: number }> {
  let amounts: number[] = [];

  if (supabase) {
    const { data } = await supabase
      .from('gastos')
      .select('monto')
      .ilike('categoria', categoria)
      .order('fecha', { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      amounts = data.map((d) => Number(d.monto));
    }
  }

  // Fallback to local store if Supabase returned no data
  if (amounts.length === 0) {
    const localRecords = await localStore.getExpensesByCategory(categoria);
    amounts = localRecords.map((r) => r.monto);
  }

  if (amounts.length < 3) {
    return {
      isAnomaly: false,
      average: amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : monto,
      count: amounts.length
    };
  }

  const average = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
  const isAnomaly = monto > average * 2;

  return {
    isAnomaly,
    average: Math.round(average * 100) / 100,
    count: amounts.length
  };
}
