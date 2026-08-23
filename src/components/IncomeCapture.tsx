'use client';

import React, { useState } from 'react';
import { PlusCircle, DollarSign, Tag, FileText, Loader2, TrendingUp } from 'lucide-react';
import { Ingreso } from '@/types/ingreso';

interface IncomeCaptureProps {
  onIncomeAdded: (newIncome: Ingreso) => void;
  userEmail?: string;
}

export function IncomeCapture({ onIncomeAdded, userEmail }: IncomeCaptureProps) {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Freelance');
  const [descripcion, setDescripcion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const userHeaders: Record<string, string> = userEmail
    ? { 'x-pockit-user-email': userEmail }
    : {};

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
        headers: { 'Content-Type': 'application/json', ...userHeaders },
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

  const inputStyle = {
    background: 'var(--color-surface-container-low)',
    border: '1px solid var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
  };

  const focusStyle = (el: HTMLInputElement | HTMLSelectElement) => {
    el.style.borderColor = 'var(--color-secondary-container)';
    el.style.boxShadow = '0 0 0 2px rgba(107,143,113,0.2)';
  };
  const blurStyle = (el: HTMLInputElement | HTMLSelectElement) => {
    el.style.borderColor = 'var(--color-outline-variant)';
    el.style.boxShadow = 'none';
  };

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--color-outline-variant)',
      }}
    >
      {/* HEADER */}
      <div className="flex items-center gap-2.5 mb-5 pb-4" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: 'var(--color-secondary)', color: 'var(--color-on-secondary)' }}
        >
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>
            Registrar Nuevo Ingreso
          </h3>
          <p className="text-[11px]" style={{ color: 'var(--color-neutral)' }}>
            Carga de cobranzas, facturación y entradas de dinero
          </p>
        </div>
      </div>

      {/* STATUS MESSAGE */}
      {statusMsg && (
        <div
          className="mb-4 p-2.5 rounded-xl text-xs font-medium"
          style={
            statusMsg.startsWith('✓')
              ? { background: 'var(--color-secondary-fixed)', color: 'var(--color-secondary)', border: '1px solid var(--color-secondary-container)' }
              : { background: 'var(--color-error-container)', color: 'var(--color-error)', border: '1px solid rgba(186,26,26,0.3)' }
          }
        >
          {statusMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* MONTO */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Monto ($ ARS)
            </label>
            <div className="relative flex items-center">
              <DollarSign className="absolute left-3 w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
              <input
                type="number"
                step="0.01"
                required
                placeholder="150000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium outline-none transition-all disabled:opacity-50"
                style={inputStyle}
                onFocus={(e) => focusStyle(e.currentTarget)}
                onBlur={(e) => blurStyle(e.currentTarget)}
              />
            </div>
          </div>

          {/* CATEGORIA */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Categoría
            </label>
            <div className="relative flex items-center">
              <Tag className="absolute left-3 w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
                style={inputStyle}
                onFocus={(e) => focusStyle(e.currentTarget)}
                onBlur={(e) => blurStyle(e.currentTarget)}
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
          <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            Descripción / Cliente
          </label>
          <div className="relative flex items-center">
            <FileText className="absolute left-3 w-4 h-4" style={{ color: 'var(--color-neutral)' }} />
            <input
              type="text"
              placeholder="Ej. Factura A Cliente X o Cobro proyecto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={isLoading}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none transition-all disabled:opacity-50"
              style={inputStyle}
              onFocus={(e) => focusStyle(e.currentTarget)}
              onBlur={(e) => blurStyle(e.currentTarget)}
            />
          </div>
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={isLoading || !monto}
          className="w-full py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          style={{ background: 'var(--color-secondary)', color: 'var(--color-on-secondary)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.9')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
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
