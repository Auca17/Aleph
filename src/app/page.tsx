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
  Trash2
} from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gastos' | 'ingresos'>('gastos');

  // Check Auth Session
  useEffect(() => {
    const session = getSessionUser();
    if (!session) {
      router.push('/login');
    } else {
      setUser(session);
    }
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resGastos, resIngresos] = await Promise.all([
        fetch('/api/gastos').then((r) => r.json()),
        fetch('/api/ingresos').then((r) => r.json())
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
    let active = true;
    Promise.all([
      fetch('/api/gastos').then((r) => r.json()).catch(() => null),
      fetch('/api/ingresos').then((r) => r.json()).catch(() => null)
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
  }, []);

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
      await fetch(`/api/ingresos/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting income:', err);
    }
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
    } catch (e: unknown) {
      setWarmupStatus('⚠️ Error: ' + (e instanceof Error ? e.message : 'Error en warmup'));
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
            <ExpenseCapture onExpenseAdded={handleExpenseAdded} />
          ) : (
            <IncomeCapture onIncomeAdded={handleIncomeAdded} />
          )}

          <ChatQuery />
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
                {ingresos.map((ing) => (
                  <div
                    key={ing.id}
                    className="p-4 rounded-2xl flex items-center justify-between transition-all"
                    style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-outline-variant)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0" style={{ background: 'var(--color-secondary-fixed)', color: 'var(--color-secondary)' }}>
                        +
                      </div>
                      <div>
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

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold" style={{ color: 'var(--color-secondary)' }}>
                        + ${Number(ing.monto).toLocaleString('es-AR')}
                      </span>
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
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
