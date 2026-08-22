'use client';

import React, { useState } from 'react';
import { Expense } from '@/types/expense';
import { Camera, Mic, Edit3, Trash2, AlertTriangle, Filter, Search, DollarSign } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onExpenseDeleted: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Alimentación: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Transporte: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Servicios: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Salud: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  Entretenimiento: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  Indumentaria: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  Tecnología: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  Hogar: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  Otros: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
};

export function ExpenseList({ expenses, onExpenseDeleted }: ExpenseListProps) {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.monto, 0);
  const anomalyCount = expenses.filter((e) => e.flag_anomalia).length;

  const filtered = expenses.filter((e) => {
    const matchCat = selectedCat === 'all' || e.categoria === selectedCat;
    const matchSearch =
      search === '' ||
      e.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      e.categoria.toLowerCase().includes(search.toLowerCase()) ||
      e.raw_text?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDelete = async (id?: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onExpenseDeleted(id);
      }
    } catch (e) {
      console.error('Error deleting expense:', e);
    }
  };

  const categories = Array.from(new Set(expenses.map((e) => e.categoria)));

  return (
    <div className="space-y-4">
      {/* STATS HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Total Gastado</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 flex items-center">
            <DollarSign className="w-5 h-5 text-indigo-500 inline" />
            {totalSpent.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Total Registros</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
            {expenses.length} <span className="text-xs font-normal text-zinc-500">gastos</span>
          </p>
        </div>

        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Anomalías Detectadas</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-5 h-5 inline text-rose-500" />
            {anomalyCount}
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar gasto o comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all ${
              selectedCat === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all ${
                selectedCat === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* EXPENSES LIST */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No se encontraron gastos</p>
          </div>
        ) : (
          filtered.map((exp) => {
            const badgeColor =
              CATEGORY_COLORS[exp.categoria] || CATEGORY_COLORS['Otros'];
            const formattedDate = new Date(exp.fecha).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div
                key={exp.id || Math.random()}
                className={`bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border rounded-2xl p-4 shadow-sm transition-all flex items-center justify-between group hover:border-indigo-400 dark:hover:border-indigo-600 ${
                  exp.flag_anomalia
                    ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      exp.fuente === 'foto'
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                        : exp.fuente === 'voz'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {exp.fuente === 'foto' && <Camera className="w-5 h-5" />}
                    {exp.fuente === 'voz' && <Mic className="w-5 h-5" />}
                    {exp.fuente === 'manual' && <Edit3 className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {exp.descripcion || exp.categoria}
                      </p>
                      {exp.flag_anomalia && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shrink-0 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Anomalía (Gasto Alto)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeColor}`}
                      >
                        {exp.categoria}
                      </span>
                      <span className="text-xs text-zinc-400">• {formattedDate}</span>
                      {exp.raw_text && (
                        <span className="text-[10px] text-zinc-400 truncate max-w-[150px] hidden md:inline">
                          "{exp.raw_text}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    ${exp.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>

                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar gasto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
