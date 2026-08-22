'use client';

import React, { useState, useEffect } from 'react';
import { ExpenseCapture } from '@/components/ExpenseCapture';
import { ExpenseList } from '@/components/ExpenseList';
import { ChatQuery } from '@/components/ChatQuery';
import { Expense } from '@/types/expense';
import { Cpu, ShieldCheck, Flame, Loader2, RefreshCw } from 'lucide-react';

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<string | null>(null);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/gastos');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setExpenses(json.data);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/gastos')
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.data)) {
          setExpenses(json.data);
        }
      })
      .catch((err) => console.error('Error fetching expenses:', err))
      .finally(() => {
        if (active) setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-indigo-50/30 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-8">
      {/* TOP NAVBAR */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80 mb-8">
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

        {/* COMPLIANCE BADGES & WARMUP */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all disabled:opacity-50"
            title="Pre-cargar modelos para la grabación de la demo"
          >
            {isWarmingUp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Flame className="w-3.5 h-3.5 text-amber-500" />
            )}
            Preload Demo
          </button>
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

      {/* MAIN CONTENT GRID */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: CAPTURE & CHAT */}
        <div className="lg:col-span-5 space-y-6">
          <ExpenseCapture onExpenseAdded={handleExpenseAdded} />
          <ChatQuery />
        </div>

        {/* RIGHT COLUMN: EXPENSES LIST & ANALYTICS */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Registro y Outliers
            </h2>
            <button
              onClick={loadExpenses}
              disabled={isLoading}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-all"
              title="Recargar gastos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <ExpenseList
            expenses={expenses}
            onExpenseDeleted={handleExpenseDeleted}
          />
        </div>
      </main>
    </div>
  );
}
