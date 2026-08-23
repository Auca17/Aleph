'use client';

import React, { useState } from 'react';
import { Expense } from '@/types/expense';
import { Camera, Mic, Edit3, Trash2, AlertTriangle, Filter, Search, DollarSign, Check, X } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onExpenseDeleted: (id: string) => void;
  onExpenseUpdated: (expense: Expense) => void;
}

interface EditForm {
  monto: string;
  categoria: string;
  descripcion: string;
  fecha: string;
}

const EXPENSE_CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Servicios',
  'Salud',
  'Entretenimiento',
  'Indumentaria',
  'Tecnología',
  'Hogar',
  'Otros'
];

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

function needsReview(expense: Expense): boolean {
  return !expense.reviewed && (expense.monto <= 0 || expense.categoria === 'Otros');
}

export function ExpenseList({ expenses, onExpenseDeleted, onExpenseUpdated }: ExpenseListProps) {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    monto: '',
    categoria: 'Otros',
    descripcion: '',
    fecha: ''
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editingExpense = editingId
    ? expenses.find((expense) => expense.id === editingId)
    : undefined;

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.monto, 0);
  const anomalyCount = expenses.filter((e) => e.flag_anomalia).length;
  const reviewCount = expenses.filter(needsReview).length;

  const filtered = expenses.filter((e) => {
    const matchCat =
      selectedCat === 'all' ||
      (selectedCat === 'review' && needsReview(e)) ||
      (selectedCat === 'anomalies' && e.flag_anomalia) ||
      e.categoria === selectedCat;
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
      if (res.ok || res.status === 404) {
        onExpenseDeleted(id);
      }
    } catch (e) {
      console.error('Error deleting expense:', e);
    }
  };

  const startEdit = (expense: Expense) => {
    if (!expense.id) return;

    setEditingId(expense.id);
    setEditError(null);
    setEditForm({
      monto: String(expense.monto),
      categoria: expense.categoria,
      descripcion: expense.descripcion || '',
      fecha: new Date(expense.fecha).toISOString().split('T')[0]
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      if (!editingExpense) {
        throw new Error('Gasto no encontrado en la lista actual');
      }

      const res = await fetch(`/api/gastos/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: Number(editForm.monto),
          categoria: editForm.categoria,
          descripcion: editForm.descripcion,
          fecha: editForm.fecha,
          fuente: editingExpense.fuente,
          raw_text: editingExpense.raw_text,
          created_at: editingExpense.created_at,
          reviewed: true
        })
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo actualizar el gasto');
      }

      onExpenseUpdated(json.data);
      setEditingId(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el gasto';
      setEditError(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const categories = Array.from(new Set(expenses.map((e) => e.categoria)));
  const activeFilterLabel =
    selectedCat === 'review'
      ? 'Registros por corregir'
      : selectedCat === 'anomalies'
        ? 'Anomalías'
        : selectedCat === 'all'
          ? 'Todos los registros'
          : selectedCat;

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.categoria] = (acc[exp.categoria] || 0) + exp.monto;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-4">
      {/* STATS HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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

        <button
          type="button"
          onClick={() => setSelectedCat('review')}
          className={`text-left bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border rounded-2xl p-4 shadow-sm transition-all hover:border-amber-400 dark:hover:border-amber-600 ${
            selectedCat === 'review'
              ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-200/70 dark:ring-amber-900/50'
              : 'border-amber-200 dark:border-amber-900/70'
          }`}
          title="Ver registros por corregir"
        >
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Por Corregir</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1 flex items-center gap-1.5">
            <Edit3 className="w-5 h-5 inline text-amber-500" />
            {reviewCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCat('anomalies')}
          className={`text-left bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border rounded-2xl p-4 shadow-sm transition-all hover:border-rose-400 dark:hover:border-rose-700 ${
            selectedCat === 'anomalies'
              ? 'border-rose-400 dark:border-rose-700 ring-2 ring-rose-200/70 dark:ring-rose-900/50'
              : 'border-zinc-200 dark:border-zinc-800'
          }`}
          title="Ver anomalías detectadas"
        >
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Anomalías Detectadas</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-5 h-5 inline text-rose-500" />
            {anomalyCount}
          </p>
        </button>
      </div>

      {/* CATEGORY SPENDING BREAKDOWN */}
      {expenses.length > 0 && (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Distribución de Gastos por Categoría
          </p>
          <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
            {sortedCategories.map(([cat, amount]) => {
              const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
              const bgClass =
                cat === 'Alimentación'
                  ? 'bg-amber-500'
                  : cat === 'Transporte'
                  ? 'bg-blue-500'
                  : cat === 'Servicios'
                  ? 'bg-emerald-500'
                  : cat === 'Salud'
                  ? 'bg-rose-500'
                  : cat === 'Entretenimiento'
                  ? 'bg-purple-500'
                  : cat === 'Indumentaria'
                  ? 'bg-pink-500'
                  : cat === 'Tecnología'
                  ? 'bg-cyan-500'
                  : cat === 'Hogar'
                  ? 'bg-orange-500'
                  : 'bg-zinc-400';

              return (
                <div
                  key={cat}
                  style={{ width: `${pct}%` }}
                  className={`h-full ${bgClass} transition-all`}
                  title={`${cat}: $${amount.toLocaleString('es-AR')} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {sortedCategories.map(([cat, amount]) => {
              const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{cat}:</span>
                  <span>${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                  <span className="text-[10px] text-zinc-400">({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar gasto o comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="relative w-full sm:w-56">
          <Filter className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedCat === 'review' || selectedCat === 'anomalies' ? 'all' : selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(selectedCat === 'review' || selectedCat === 'anomalies') && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-4 py-3 text-xs">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            Viendo: {activeFilterLabel} ({filtered.length})
          </span>
          <button
            onClick={() => setSelectedCat('all')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar
          </button>
        </div>
      )}

      {/* EXPENSES LIST */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No se encontraron gastos</p>
          </div>
        ) : (
          filtered.map((exp) => {
            const isEditing = exp.id === editingId;
            const reviewNeeded = needsReview(exp);
            const badgeColor =
              CATEGORY_COLORS[exp.categoria] || CATEGORY_COLORS['Otros'];
            const formattedDate = new Date(exp.fecha).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div
                key={exp.id || `${exp.fecha}-${exp.categoria}-${exp.monto}`}
                className={`bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border rounded-2xl p-4 shadow-sm transition-all flex items-center justify-between group hover:border-indigo-400 dark:hover:border-indigo-600 ${
                  exp.flag_anomalia
                    ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/30 dark:bg-rose-950/20'
                  : reviewNeeded
                    ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/10'
                  : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {isEditing ? (
                  <div className="w-full space-y-3">
                    {editError && (
                      <div className="text-xs text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2">
                        {editError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={editForm.descripcion}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, descripcion: e.target.value }))
                        }
                        className="sm:col-span-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Título"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.monto}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, monto: e.target.value }))
                        }
                        className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Monto"
                      />
                      <input
                        type="date"
                        value={editForm.fecha}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, fecha: e.target.value }))
                        }
                        className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <select
                        value={editForm.categoria}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, categoria: e.target.value }))
                        }
                        className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {EXPENSE_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          disabled={isSavingEdit}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                        {reviewNeeded && (
                          <button
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                            title="Confirmar que el gasto está correcto"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Está bien
                          </button>
                        )}
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
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
                      {reviewNeeded && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                          <Edit3 className="w-3 h-3" />
                          Revisar
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
                          &quot;{exp.raw_text}&quot;
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
                    onClick={() => startEdit(exp)}
                    className={`p-1.5 rounded-lg transition-all ${
                      reviewNeeded
                        ? 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                        : 'text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                    }`}
                    title="Corregir gasto"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar gasto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
