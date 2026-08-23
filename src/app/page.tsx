'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExpenseCapture } from '@/components/ExpenseCapture';
import { IncomeCapture } from '@/components/IncomeCapture';
import { ExpenseList } from '@/components/ExpenseList';
import { ChatQuery } from '@/components/ChatQuery';
import { Expense } from '@/types/expense';
import { Ingreso } from '@/types/ingreso';
import { getSessionUser, logoutUser, UserProfile } from '@/lib/auth';
import {
  Cpu,
  ShieldCheck,
  Flame,
  Loader2,
  RefreshCw,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  PlusCircle,
  Trash2,
  Edit3,
  Check,
  X
} from 'lucide-react';
import Image from 'next/image';

const INCOME_CATEGORIES = [
  'Freelance',
  'Honorarios',
  'Ventas',
  'Inversiones',
  'Servicios Profesionales',
  'Otros'
];

interface IncomeEditForm {
  monto: string;
  categoria: string;
  descripcion: string;
  fecha: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getUserHeaders(user: UserProfile | null): HeadersInit {
  return user?.email ? { 'x-pockit-user-email': user.email } : {};
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gastos' | 'ingresos'>('gastos');
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeEditForm, setIncomeEditForm] = useState<IncomeEditForm>({
    monto: '',
    categoria: 'Freelance',
    descripcion: '',
    fecha: ''
  });
  const [isSavingIncome, setIsSavingIncome] = useState(false);
  const [incomeEditError, setIncomeEditError] = useState<string | null>(null);

  // Check Auth Session
  useEffect(() => {
    void Promise.resolve().then(() => {
      const session = getSessionUser();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session);
    });
  }, [router]);

  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const headers = getUserHeaders(user);
      const [resGastos, resIngresos] = await Promise.all([
        fetch('/api/gastos', { headers }).then((r) => r.json()),
        fetch('/api/ingresos', { headers }).then((r) => r.json())
      ]);

      if (resGastos.success && Array.isArray(resGastos.data)) {
        setExpenses(resGastos.data);
      }
      if (resIngresos.success && Array.isArray(resIngresos.data)) {
        setIngresos(resIngresos.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    let active = true;
    const headers = getUserHeaders(user);
    Promise.all([
      fetch('/api/gastos', { headers }).then((r) => r.json()).catch(() => null),
      fetch('/api/ingresos', { headers }).then((r) => r.json()).catch(() => null)
    ]).then(([resGastos, resIngresos]) => {
      if (!active) return;
      if (resGastos?.success && Array.isArray(resGastos.data)) {
        setExpenses(resGastos.data);
      }
      if (resIngresos?.success && Array.isArray(resIngresos.data)) {
        setIngresos(resIngresos.data);
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const handleExpenseAdded = (newExpense: Expense) => {
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const handleExpenseDeleted = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleIncomeAdded = (newIncome: Ingreso) => {
    setIngresos((prev) => [newIncome, ...prev]);
  };

  const handleIncomeDeleted = async (id: string) => {
    setIngresos((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/ingresos/${id}`, {
        method: 'DELETE',
        headers: getUserHeaders(user)
      });
    } catch (err) {
      console.error('Error deleting income:', err);
    }
  };

  const startIncomeEdit = (income: Ingreso) => {
    setEditingIncomeId(income.id);
    setIncomeEditError(null);
    setIncomeEditForm({
      monto: String(income.monto),
      categoria: income.categoria || 'Otros',
      descripcion: income.descripcion || '',
      fecha: new Date(income.fecha).toISOString().split('T')[0]
    });
  };

  const cancelIncomeEdit = () => {
    setEditingIncomeId(null);
    setIncomeEditError(null);
  };

  const handleIncomeUpdated = (updatedIncome: Ingreso) => {
    setIngresos((prev) =>
      prev.map((income) => (income.id === updatedIncome.id ? updatedIncome : income))
    );
  };

  const saveIncomeEdit = async () => {
    if (!editingIncomeId) return;

    const parsedMonto = Number(incomeEditForm.monto);
    if (!Number.isFinite(parsedMonto) || parsedMonto <= 0) {
      setIncomeEditError('Ingresá un monto válido mayor a 0');
      return;
    }

    setIsSavingIncome(true);
    setIncomeEditError(null);

    try {
      const currentIncome = ingresos.find((income) => income.id === editingIncomeId);
      const res = await fetch(`/api/ingresos/${editingIncomeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getUserHeaders(user) },
        body: JSON.stringify({
          monto: parsedMonto,
          categoria: incomeEditForm.categoria,
          descripcion: incomeEditForm.descripcion,
          fecha: incomeEditForm.fecha,
          fuente: currentIncome?.fuente || 'manual'
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'No se pudo actualizar el ingreso');
      }

      handleIncomeUpdated(json.data);
      setEditingIncomeId(null);
    } catch (error: unknown) {
      setIncomeEditError(getErrorMessage(error, 'No se pudo actualizar el ingreso'));
    } finally {
      setIsSavingIncome(false);
    }
  };

  const handleExpenseUpdated = (updatedExpense: Expense) => {
    setExpenses((prev) =>
      prev.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
    );
  };

  const handleLogout = () => {
    logoutUser();
    router.push('/login');
  };

  const handleWarmup = async () => {
    setIsWarmingUp(true);
    setWarmupStatus('Precargando modelos QVAC (OCR, Whisper, Llama)...');
    try {
      const res = await fetch('/api/warmup');
      const json = await res.json();
      if (json.success) {
        setWarmupStatus('✓ Modelos precargados en memoria listos para la demo.');
      } else {
        setWarmupStatus('⚠️ Error en warmup: ' + (json.error || 'revisar logs'));
      }
    } catch (error: unknown) {
      setWarmupStatus('⚠️ Error: ' + getErrorMessage(error, 'no se pudo precargar'));
    } finally {
      setIsWarmingUp(false);
    }
  };

  // Calculations
  const totalGastos = expenses.reduce((acc, curr) => acc + Number(curr.monto || 0), 0);
  const totalIngresos = ingresos.reduce((acc, curr) => acc + Number(curr.monto || 0), 0);
  const balanceNeto = totalIngresos - totalGastos;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs" style={{ background: 'var(--color-background)', color: 'var(--color-neutral)' }}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" style={{ color: 'var(--color-primary-container)' }} />
        Verificando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>

      {/* ── TOP NAVBAR HEADER ── */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 mb-6" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>

        {/* LOGO + BRAND */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
            <Image src="/pockit-logo.jpeg" alt="Pockit logo" width={44} height={44} className="object-cover w-full h-full" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight leading-tight" style={{ color: 'var(--color-on-surface)' }}>
              Pockit
            </h1>
            <p className="text-xs leading-tight" style={{ color: 'var(--color-neutral)' }}>
              Agente financiero local · QVAC
            </p>
          </div>
        </div>

        {/* RIGHT CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Local Inference Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'var(--color-secondary-fixed)', color: 'var(--color-secondary)', border: '1px solid var(--color-secondary-container)' }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">100% Inferencia Local</span>
            <span className="xs:hidden">Local</span>
          </div>

          {/* SDK Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}>
            <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--color-tertiary-container)' }} />
            @qvac/sdk
          </div>

          {/* Preload Button */}
          <button
            onClick={handleWarmup}
            disabled={isWarmingUp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-container)', border: '1px solid var(--color-primary-container)' }}
            title="Pre-cargar modelos para la grabación de la demo"
          >
            {isWarmingUp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Flame className="w-3.5 h-3.5" style={{ color: 'var(--color-primary-container)' }} />
            )}
            Preload Demo
          </button>

          {/* USER CARD & LOGOUT */}
          <div className="flex items-center gap-2.5 pl-2.5" style={{ borderLeft: '1px solid var(--color-outline-variant)' }}>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar}
                alt={user.nombre}
                className="w-8 h-8 rounded-full object-cover"
                style={{ border: '2px solid var(--color-outline-variant)' }}
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold leading-tight" style={{ color: 'var(--color-on-surface)' }}>
                  {user.nombre}
                </p>
                <p className="text-[10px] leading-tight" style={{ color: 'var(--color-neutral)' }}>
                  {user.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl transition-all cursor-pointer"
              style={{ color: 'var(--color-neutral)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-container)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral)';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── WARMUP STATUS ALERT ── */}
      {warmupStatus && (
        <div className="max-w-7xl mx-auto mb-5 p-3 rounded-2xl text-xs flex items-center justify-between" style={{ background: 'var(--color-primary-fixed)', border: '1px solid var(--color-primary-container)', color: 'var(--color-on-primary-container)' }}>
          <span>{warmupStatus}</span>
          <button
            onClick={() => setWarmupStatus(null)}
            className="text-xs underline ml-4 hover:opacity-80"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* ── CASHFLOW KPI SUMMARY CARDS ── */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* TOTAL INGRESOS */}
        <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-outline-variant)' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>
              Ingresos Totales
            </p>
            <h3 className="text-2xl font-extrabold mt-1" style={{ color: 'var(--color-secondary)' }}>
              ${totalIngresos.toLocaleString('es-AR')}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-secondary-fixed)', color: 'var(--color-secondary)' }}>
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* TOTAL GASTOS */}
        <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-outline-variant)' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>
              Gastos Totales
            </p>
            <h3 className="text-2xl font-extrabold mt-1" style={{ color: 'var(--color-on-surface)' }}>
              ${totalGastos.toLocaleString('es-AR')}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* BALANCE NETO */}
        <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-outline-variant)' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-neutral)' }}>
              Balance Neto
            </p>
            <h3
              className="text-2xl font-extrabold mt-1"
              style={{ color: balanceNeto >= 0 ? 'var(--color-primary-container)' : 'var(--color-error)' }}
            >
              ${balanceNeto.toLocaleString('es-AR')}
            </h3>
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: balanceNeto >= 0 ? 'var(--color-primary-fixed)' : 'var(--color-error-container)',
              color: balanceNeto >= 0 ? 'var(--color-primary-container)' : 'var(--color-error)'
            }}
          >
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT GRID ── */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: CAPTURE TOGGLE & CHAT */}
        <div className="lg:col-span-5 space-y-5">

          {/* TOGGLE TAB FOR CAPTURE */}
          <div className="flex items-center p-1 rounded-2xl" style={{ background: 'var(--color-surface-container-high)' }}>
            <button
              onClick={() => setActiveTab('gastos')}
              className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
              style={
                activeTab === 'gastos'
                  ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                  : { color: 'var(--color-on-surface-variant)' }
              }
            >
              <Receipt className="w-3.5 h-3.5" />
              Cargar Gasto
            </button>
            <button
              onClick={() => setActiveTab('ingresos')}
              className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
              style={
                activeTab === 'ingresos'
                  ? { background: 'var(--color-secondary)', color: 'var(--color-on-secondary)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                  : { color: 'var(--color-on-surface-variant)' }
              }
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Cargar Ingreso
            </button>
          </div>

          {activeTab === 'gastos' ? (
            <ExpenseCapture onExpenseAdded={handleExpenseAdded} userEmail={user.email} />
          ) : (
            <IncomeCapture onIncomeAdded={handleIncomeAdded} userEmail={user.email} />
          )}

          <ChatQuery expenses={expenses} ingresos={ingresos} userEmail={user.email} />
        </div>

        {/* RIGHT COLUMN: EXPENSES & INGRESOS LIST */}
        <div className="lg:col-span-7 space-y-8">

          {/* GASTOS SECTION */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                <Receipt className="w-4 h-4" style={{ color: 'var(--color-primary-container)' }} />
                Registro de Gastos
              </h2>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="p-1.5 rounded-lg transition-all cursor-pointer"
                style={{ color: 'var(--color-neutral)' }}
                title="Recargar datos"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <ExpenseList
              expenses={expenses}
              onExpenseDeleted={handleExpenseDeleted}
              onExpenseUpdated={handleExpenseUpdated}
              userEmail={user.email}
            />
          </div>

          {/* INGRESOS SECTION */}
          <div className="pt-6" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
            <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
              Registro de Ingresos
            </h2>

            {ingresos.length === 0 ? (
              <div className="p-8 text-center rounded-2xl" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)' }}>
                <p className="text-xs" style={{ color: 'var(--color-neutral)' }}>No hay ingresos registrados aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ingresos.map((ing) => {
                  const isEditingIncome = editingIncomeId === ing.id;

                  return (
                    <div
                      key={ing.id}
                      className="p-4 rounded-2xl transition-all"
                      style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-outline-variant)' }}
                    >
                      {isEditingIncome ? (
                        <div className="space-y-3">
                          {incomeEditError && (
                            <div
                              className="text-xs rounded-xl px-3 py-2"
                              style={{ background: 'var(--color-error-container)', color: 'var(--color-error)', border: '1px solid rgba(186,26,26,0.3)' }}
                            >
                              {incomeEditError}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={incomeEditForm.descripcion}
                              onChange={(e) =>
                                setIncomeEditForm((prev) => ({ ...prev, descripcion: e.target.value }))
                              }
                              className="sm:col-span-2 px-3 py-2 rounded-xl text-xs outline-none transition-all"
                              style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                              placeholder="Descripción"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={incomeEditForm.monto}
                              onChange={(e) =>
                                setIncomeEditForm((prev) => ({ ...prev, monto: e.target.value }))
                              }
                              className="px-3 py-2 rounded-xl text-xs outline-none transition-all"
                              style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                              placeholder="Monto"
                            />
                            <input
                              type="date"
                              value={incomeEditForm.fecha}
                              onChange={(e) =>
                                setIncomeEditForm((prev) => ({ ...prev, fecha: e.target.value }))
                              }
                              className="px-3 py-2 rounded-xl text-xs outline-none transition-all"
                              style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                            <select
                              value={incomeEditForm.categoria}
                              onChange={(e) =>
                                setIncomeEditForm((prev) => ({ ...prev, categoria: e.target.value }))
                              }
                              className="px-3 py-2 rounded-xl text-xs outline-none transition-all"
                              style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                            >
                              {INCOME_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>

                            <div className="flex justify-end gap-2">
                              <button
                                onClick={cancelIncomeEdit}
                                disabled={isSavingIncome}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                                style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                              <button
                                onClick={saveIncomeEdit}
                                disabled={isSavingIncome}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                                style={{ background: 'var(--color-secondary)', color: 'var(--color-on-secondary)' }}
                              >
                                {isSavingIncome ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                {isSavingIncome ? 'Guardando...' : 'Guardar cambios'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0" style={{ background: 'var(--color-secondary-fixed)', color: 'var(--color-secondary)' }}>
                              +
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>
                                  {ing.descripcion || ing.categoria}
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md" style={{ background: 'var(--color-secondary-fixed)', color: 'var(--color-secondary)' }}>
                                  {ing.categoria}
                                </span>
                              </div>
                              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-neutral)' }}>
                                {new Date(ing.fecha).toLocaleDateString('es-AR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-extrabold" style={{ color: 'var(--color-secondary)' }}>
                              + ${Number(ing.monto).toLocaleString('es-AR')}
                            </span>
                            <button
                              onClick={() => startIncomeEdit(ing)}
                              className="p-1.5 rounded-lg transition-all cursor-pointer"
                              style={{ color: 'var(--color-neutral)' }}
                              title="Editar ingreso"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleIncomeDeleted(ing.id)}
                              className="p-1.5 rounded-lg transition-all cursor-pointer"
                              style={{ color: 'var(--color-neutral)' }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-container)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral)';
                                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              }}
                              title="Eliminar ingreso"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
