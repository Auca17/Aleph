'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser } from '@/lib/auth';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Cpu, Zap } from 'lucide-react';
import Image from 'next/image';

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
      loginUser('demo@pockit.ai', 'Alex Pockit (Demo)');
      router.push('/');
    }, 500);
  };

  return (
    /* ── Warm cream background ── */
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#FFF8F4', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Decorative warm blobs */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201,138,44,0.10) 0%, transparent 65%)',
          transform: 'translate(35%, -35%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(68,102,75,0.08) 0%, transparent 65%)',
          transform: 'translate(-35%, 35%)',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201,138,44,0.05) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* ── LOGIN CARD ── */}
      <div
        className="relative w-full max-w-[420px] rounded-3xl p-8 flex flex-col z-10"
        style={{
          background: '#FFFFFF',
          boxShadow: '0px 8px 40px rgba(27, 27, 31, 0.10)',
          border: '1px solid #D6C4B1',
        }}
      >
        {/* BRANDING HEADER */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo container — just the coin purse, no background */}
          <div
            className="w-[80px] h-[80px] rounded-3xl overflow-hidden mb-4"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
          >
            <Image
              src="/pockit-logo.jpeg"
              alt="Pockit"
              width={80}
              height={80}
              className="object-cover w-full h-full"
              priority
            />
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: '#201B14' }}
          >
            Pockit
          </h1>
          <p
            className="text-sm mt-1.5 leading-relaxed"
            style={{ color: '#7F756C' }}
          >
            Agente financiero local para<br />autónomos y freelancers
          </p>
        </div>

        {/* ERROR BADGE */}
        {error && (
          <div
            className="mb-4 p-3 rounded-2xl text-xs text-center font-medium"
            style={{
              background: '#FFDAD6',
              color: '#BA1A1A',
              border: '1px solid rgba(186,26,26,0.25)',
            }}
          >
            {error}
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: '#514536' }}
            >
              Correo Electrónico
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4" style={{ color: '#837564' }} />
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  background: '#FEF1E6',
                  border: '1px solid #D6C4B1',
                  color: '#201B14',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#C98A2C';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,138,44,0.18)';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D6C4B1';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#FEF1E6';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: '#514536' }}
            >
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4" style={{ color: '#837564' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  background: '#FEF1E6',
                  border: '1px solid #D6C4B1',
                  color: '#201B14',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#C98A2C';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,138,44,0.18)';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D6C4B1';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#FEF1E6';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 transition-all cursor-pointer"
                style={{ color: '#837564' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#514536')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#837564')}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2 cursor-pointer"
            style={{
              background: '#845400',
              color: '#FFFFFF',
              boxShadow: '0 4px 16px rgba(132, 84, 0, 0.30)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#6E4600')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#845400')}
          >
            {isLoading ? (
              <span>Iniciando sesión...</span>
            ) : (
              <>
                Ingresar al Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* SEPARATOR */}
        <div className="relative my-6 flex items-center">
          <div className="flex-1" style={{ borderTop: '1px solid #D6C4B1' }} />
          <span
            className="px-3 text-[11px] font-medium uppercase tracking-wider"
            style={{ color: '#837564' }}
          >
            O bien
          </span>
          <div className="flex-1" style={{ borderTop: '1px solid #D6C4B1' }} />
        </div>

        {/* QUICK DEMO BUTTON */}
        <button
          onClick={handleQuickDemo}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm font-semibold"
          style={{
            background: '#FFDDB6',
            color: '#442900',
            border: '1px solid #C98A2C',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#FFD09A')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#FFDDB6')}
        >
          <Zap className="w-4 h-4" style={{ color: '#845400' }} />
          Acceso Rápido Demo (1-Click)
        </button>

        {/* FOOTER BADGES */}
        <div
          className="mt-7 pt-4 flex items-center justify-between text-[11px]"
          style={{ borderTop: '1px solid #D6C4B1', color: '#837564' }}
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#44664B' }} />
            100% Inferencia Local
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" style={{ color: '#4A9ED3' }} />
            @qvac/sdk
          </span>
        </div>
      </div>
    </div>
  );
}
