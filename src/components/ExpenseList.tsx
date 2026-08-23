'use client';

import React, { useState } from 'react';
import { Expense } from '@/types/expense';
import { Camera, Mic, Edit3, Trash2, AlertTriangle, Filter, Search, DollarSign } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onExpenseDeleted: (id: string) => void;
}

// Using warm-palette chip colors that align with the Pockit design system
const CATEGORY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  Alimentación: { bg: '#FFF3DC', color: '#845400', border: '#C98A2C' },
  Transporte:   { bg: '#E3F0FA', color: '#006491', border: '#4A9ED3' },
  Servicios:    { bg: '#E3F2E6', color: '#44664B', border: '#6B8F71' },
  Salud:        { bg: '#FDECEA', color: '#BA1A1A', border: '#FFDAD6' },
  Entretenimiento: { bg: '#EFE8F8', color: '#5B3E91', border: '#C4ADEA' },
  Indumentaria: { bg: '#FDE8F0', color: '#8B1D50', border: '#E8ADCC' },
  Tecnología:   { bg: '#E0F4F8', color: '#00546B', border: '#8ACFE0' },
  Hogar:        { bg: '#FEF0E3', color: '#7A3A00', border: '#E8A870' },
  Otros:        { bg: '#F3EDE8', color: '#514536', border: '#D6C4B1' },
};

// Bar colors for the distribution chart
const CATEGORY_BAR_COLOR: Record<string, string> = {
  Alimentación: '#C98A2C',
  Transporte:   '#4A9ED3',
  Servicios:    '#6B8F71',
  Salud:        '#BA1A1A',
  Entretenimiento: '#7C5CBF',
  Indumentaria: '#C0648A',
  Tecnología:   '#2A9BB5',
  Hogar:        '#D07A30',
  Otros:        '#7F756C',
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

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.categoria] = (acc[exp.categoria] || 0) + exp.monto;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  );

  const cardStyle = {
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-outline-variant)',
  };

  return (
    <div className="space-y-4">
      {/* STATS HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4" style={cardStyle}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-neutral)' }}>Total Gastado</p>
          <p className="text-2xl font-bold mt-1 flex items-center" style={{ color: 'var(--color-on-surface)' }}>
            <DollarSign className="w-5 h-5 inline" style={{ color: 'var(--color-primary-container)' }} />
            {totalSpent.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="rounded-2xl p-4" style={cardStyle}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-neutral)' }}>Total Registros</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-on-surface)' }}>
            {expenses.length}{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--color-neutral)' }}>gastos</span>
          </p>
        </div>

        <div className="rounded-2xl p-4" style={cardStyle}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-neutral)' }}>Anomalías Detectadas</p>
          <p className="text-2xl font-bold mt-1 flex items-center gap-1.5" style={{ color: 'var(--color-error)' }}>
            <AlertTriangle className="w-5 h-5 inline" />
            {anomalyCount}
          </p>
        </div>
      </div>

      {/* CATEGORY SPENDING BREAKDOWN */}
      {expenses.length > 0 && (
        <div className="rounded-2xl p-4" style={cardStyle}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
            Distribución de Gastos por Categoría
          </p>
          <div className="h-3 w-full rounded-full overflow-hidden flex" style={{ background: 'var(--color-surface-container-high)' }}>
            {sortedCategories.map(([cat, amount]) => {
              const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
              const barColor = CATEGORY_BAR_COLOR[cat] || '#7F756C';
              return (
                <div
                  key={cat}
                  style={{ width: `${pct}%`, background: barColor }}
                  className="h-full transition-all"
                  title={`${cat}: $${amount.toLocaleString('es-AR')} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {sortedCategories.map(([cat, amount]) => {
              const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
              const barColor = CATEGORY_BAR_COLOR[cat] || '#7F756C';
              return (
                <div key={cat} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: barColor }} />
                  <span className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>{cat}:</span>
                  <span>${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                  <span style={{ color: 'var(--color-neutral)' }}>({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="rounded-2xl p-3 flex flex-col sm:flex-row gap-2.5 items-center justify-between" style={cardStyle}>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-neutral)' }} />
          <input
            type="text"
            placeholder="Buscar gasto o comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none transition-all"
            style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-container)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-neutral)' }} />
          <button
            onClick={() => setSelectedCat('all')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all cursor-pointer"
            style={
              selectedCat === 'all'
                ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)' }
                : { background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }
            }
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all cursor-pointer"
              style={
                selectedCat === cat
                  ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)' }
                  : { background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* EXPENSES LIST */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)' }}>
            <p className="text-sm" style={{ color: 'var(--color-neutral)' }}>No se encontraron gastos</p>
          </div>
        ) : (
          filtered.map((exp, idx) => {
            const chipStyle = CATEGORY_STYLES[exp.categoria] || CATEGORY_STYLES['Otros'];
            const formattedDate = new Date(exp.fecha).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div
                key={exp.id || `expense-${idx}-${exp.fecha}`}
                className="rounded-2xl p-4 flex items-center justify-between group transition-all"
                style={{
                  background: exp.flag_anomalia ? 'rgba(186,26,26,0.04)' : 'var(--color-surface)',
                  boxShadow: 'var(--shadow-card)',
                  border: exp.flag_anomalia
                    ? '1px solid rgba(186,26,26,0.3)'
                    : '1px solid var(--color-outline-variant)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = exp.flag_anomalia ? 'rgba(186,26,26,0.5)' : 'var(--color-primary-container)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = exp.flag_anomalia ? 'rgba(186,26,26,0.3)' : 'var(--color-outline-variant)';
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: exp.fuente === 'foto'
                        ? '#EFE8F8'
                        : exp.fuente === 'voz'
                        ? '#E3F0FA'
                        : 'var(--color-surface-container-high)',
                      color: exp.fuente === 'foto'
                        ? '#5B3E91'
                        : exp.fuente === 'voz'
                        ? '#006491'
                        : 'var(--color-on-surface-variant)',
                    }}
                  >
                    {exp.fuente === 'foto' && <Camera className="w-5 h-5" />}
                    {exp.fuente === 'voz' && <Mic className="w-5 h-5" />}
                    {exp.fuente === 'manual' && <Edit3 className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>
                        {exp.descripcion || exp.categoria}
                      </p>
                      {exp.flag_anomalia && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 animate-pulse" style={{ background: 'var(--color-error-container)', color: 'var(--color-error)', border: '1px solid rgba(186,26,26,0.3)' }}>
                          <AlertTriangle className="w-3 h-3" />
                          Anomalía (Gasto Alto)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: chipStyle.bg, color: chipStyle.color, border: `1px solid ${chipStyle.border}` }}
                      >
                        {exp.categoria}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-neutral)' }}>· {formattedDate}</span>
                      {exp.raw_text && (
                        <span className="text-[10px] truncate max-w-[150px] hidden md:inline" style={{ color: 'var(--color-neutral)' }}>
                          &quot;{exp.raw_text}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>
                    ${exp.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>

                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    style={{ color: 'var(--color-neutral)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-container)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral)';
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
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
