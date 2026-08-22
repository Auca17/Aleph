'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser } from '@/lib/auth';
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor ingresá tu email');
      return;
    }
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      loginUser(email);
      router.push('/');
    }, 600);
  };

  const handleQuickDemo = () => {
    setIsLoading(true);
    setError(null);
    setTimeout(() => {
      loginUser('demo@aleph.ai', 'Alex Aleph (Demo)');
      router.push('/');
    }, 500);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 p-4 overflow-hidden">
      {/* GLOWING ORBS BACKGROUND */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* LOGIN CARD */}
      <div className="relative w-full max-w-md bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800/90 rounded-3xl p-8 shadow-2xl shadow-black/80 flex flex-col z-10">
        {/* BRANDING HEADER */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-500 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/30 mb-3 border border-white/20">
            א
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Aleph AI
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Track 1
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
            Agente financiero local inteligente para autónomos, freelancers y emprendedores.
          </p>
        </div>

        {/* ERROR BADGE */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800/80 rounded-2xl text-xs text-red-200 text-center animate-shake">
            {error}
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/90 border border-zinc-700/80 rounded-2xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-2.5 bg-zinc-800/90 border border-zinc-700/80 rounded-2xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-zinc-400 hover:text-zinc-200 transition-all"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                Iniciando sesión...
              </span>
            ) : (
              <>
                Ingresar al Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* SEPARATOR */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800" />
          </div>
          <span className="relative px-3 bg-zinc-900 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
            O bien
          </span>
        </div>

        {/* QUICK DEMO LOGIN BUTTON */}
        <button
          onClick={handleQuickDemo}
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-zinc-800/90 hover:bg-zinc-800 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Acceso Rápido Demo (1-Click)
        </button>

        {/* FOOTER BADGES */}
        <div className="mt-8 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            100% Inferencia Local
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            @qvac/sdk
          </span>
        </div>
      </div>
    </div>
  );
}
