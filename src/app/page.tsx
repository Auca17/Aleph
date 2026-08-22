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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-xs">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Verificando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-indigo-50/30 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-8">
      {/* TOP NAVBAR HEADER */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-500/30">
            א
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                Aleph
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                QVAC Track 1
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Agente local de finanzas personales para autónomos y freelancers
            </p>
          </div>
        </div>

        {/* RIGHT CONTROLS & USER PROFILE */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Inferencia Local
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            @qvac/sdk
          </div>

          <button
            onClick={handleWarmup}
            disabled={isWarmingUp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            title="Pre-cargar modelos para la grabación de la demo"
          >
            {isWarmingUp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Flame className="w-3.5 h-3.5 text-amber-500" />
            )}
            Preload Demo
          </button>

          {/* USER CARD & LOGOUT */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar}
                alt={user.nombre}
                className="w-8 h-8 rounded-full border border-indigo-500/30 object-cover"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                  {user.nombre}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* WARMUP STATUS ALERT */}
      {warmupStatus && (
        <div className="max-w-7xl mx-auto mb-6 p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
          <span>{warmupStatus}</span>
          <button
            onClick={() => setWarmupStatus(null)}
            className="text-xs underline ml-4 hover:opacity-80"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* CASHFLOW KPI SUMMARY CARDS */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* TOTAL INGRESOS */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-emerald-500/20 dark:border-emerald-950 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Ingresos Totales
            </p>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              $ {totalIngresos.toLocaleString('es-AR')}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* TOTAL GASTOS */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-indigo-500/20 dark:border-indigo-950 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Gastos Totales
            </p>
            <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              $ {totalGastos.toLocaleString('es-AR')}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* BALANCE NETO */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Flujo de Caja (Balance)
            </p>
            <h3
              className={`text-xl font-black mt-1 ${
                balanceNeto >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              $ {balanceNeto.toLocaleString('es-AR')}
            </h3>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              balanceNeto >= 0
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
            }`}
          >
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* MAIN CONTENT GRID */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: CAPTURE TOGGLE & CHAT */}
        <div className="lg:col-span-5 space-y-6">
          {/* TOGGLE TAB FOR CAPTURE */}
          <div className="flex items-center p-1 bg-zinc-200/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-2xl">
            <button
              onClick={() => setActiveTab('gastos')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'gastos'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Cargar Gasto (IA Local)
            </button>
            <button
              onClick={() => setActiveTab('ingresos')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ingresos'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
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
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                Registro de Gastos y Outliers
              </h2>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-all cursor-pointer"
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
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Registro de Ingresos
            </h2>

            {ingresos.length === 0 ? (
              <div className="p-8 text-center bg-white/60 dark:bg-zinc-900/60 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">No hay ingresos registrados aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ingresos.map((ing) => (
                  <div
                    key={ing.id}
                    className="p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-emerald-500/20 dark:border-emerald-950/60 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                        +
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {ing.descripcion || ing.categoria}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {ing.categoria}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(ing.fecha).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        + $ {Number(ing.monto).toLocaleString('es-AR')}
                      </span>
                      <button
                        onClick={() => handleIncomeDeleted(ing.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-all cursor-pointer"
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
