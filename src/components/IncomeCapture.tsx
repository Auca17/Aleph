'use client';

import React, { useState } from 'react';
import { PlusCircle, DollarSign, Tag, FileText, Loader2, TrendingUp } from 'lucide-react';
import { Ingreso } from '@/types/ingreso';

interface IncomeCaptureProps {
  onIncomeAdded: (newIncome: Ingreso) => void;
}

export function IncomeCapture({ onIncomeAdded }: IncomeCaptureProps) {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Freelance');
  const [descripcion, setDescripcion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const categories = [
    'Freelance',
    'Honorarios',
    'Ventas',
    'Inversiones',
    'Servicios Profesionales',
    'Otros'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = parseFloat(monto);
    if (!monto || isNaN(parsedMonto) || parsedMonto <= 0) {
      setStatusMsg('⚠️ Ingrese un monto válido mayor a 0');
      return;
    }

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: parsedMonto,
          categoria,
          descripcion: descripcion || `Ingreso por ${categoria}`,
          fuente: 'manual',
          fecha: new Date().toISOString()
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        onIncomeAdded(json.data);
        setMonto('');
        setDescripcion('');
        setStatusMsg('✓ Ingreso registrado exitosamente');
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        setStatusMsg('⚠️ Error: ' + (json.error || 'No se pudo guardar el ingreso'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el ingreso';
      setStatusMsg('⚠️ Error: ' + msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-emerald-500/20 dark:border-emerald-950 rounded-3xl p-6 shadow-xl shadow-zinc-200/50 dark:shadow-black/50">
      <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Registrar Nuevo Ingreso
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Carga de cobranzas, facturación y entradas de dinero
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`mb-4 p-2.5 rounded-xl text-xs font-medium ${
            statusMsg.startsWith('✓')
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {statusMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* MONTO */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Monto ($ ARS)
            </label>
            <div className="relative flex items-center">
              <DollarSign className="absolute left-3 w-4 h-4 text-emerald-500" />
              <input
                type="number"
                step="0.01"
                required
                placeholder="150000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* CATEGORIA */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Categoría
            </label>
            <div className="relative flex items-center">
              <Tag className="absolute left-3 w-4 h-4 text-emerald-500" />
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50 appearance-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* DESCRIPCION */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
            Descripción / Cliente
          </label>
          <div className="relative flex items-center">
            <FileText className="absolute left-3 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Ej. Factura A Cliente X o Cobro proyecto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={isLoading}
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !monto}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              Guardar Ingreso
            </>
          )}
        </button>
      </form>
    </div>
  );
}
