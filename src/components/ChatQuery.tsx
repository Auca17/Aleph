'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Expense } from '@/types/expense';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

interface ChatQueryProps {
  expenses?: Expense[];
  userEmail?: string;
}

export function ChatQuery({ expenses = [], userEmail }: ChatQueryProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy Pockit AI, tu agente financiero local impulsado por QVAC. Podés preguntarme sobre tus gastos, totales por categoría o explicaciones sobre anomalías.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isStreaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: textToSend
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInput('');
    setIsStreaming(true);

    const botMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: botMessageId, sender: 'bot', text: '' }
    ]);

    try {
      const res = await fetch('/api/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userEmail ? { 'x-pockit-user-email': userEmail } : {})
        },
        body: JSON.stringify({ pregunta: textToSend, expensesSnapshot: expenses })
      });

      if (!res.ok || !res.body) {
        throw new Error('Error al consultar el agente local');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, text: msg.text + chunk } : msg
          )
        );
      }
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'No se pudo generar respuesta';
      if (message.includes('Failed to fetch') || message.includes('fetch')) {
        message = 'No se pudo conectar con el endpoint local (/api/consulta). Asegurate de tener "npm run dev" activo y presionar "Preload Demo" para asegurar que los modelos estén cargados.';
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: `⚠️ ${message}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const quickPrompts = [
    '¿Qué gasté esta semana?',
    '¿Tengo alguna anomalía?'
  ];

  return (
    <div
      className="rounded-3xl p-5 flex flex-col"
      style={{
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--color-outline-variant)',
        height: '520px'
      }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
        <div className="flex items-center gap-2.5">
          {/* Bot avatar with Pockit logo */}
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>
            <Image src="/pockit-logo.jpeg" alt="Pockit AI" width={36} height={36} className="object-cover w-full h-full" />
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              Pockit AI
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--color-secondary)' }}
              />
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--color-neutral)' }}>
              Llama 3.2 1B · 100% Inferencia Local
            </p>
          </div>
        </div>
      </div>

      {/* MESSAGES CONTAINER */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'bot' && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-primary-container)' }}
              >
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className="max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed"
              style={
                msg.sender === 'user'
                  ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)' }
                  : { background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)', whiteSpace: 'pre-wrap' }
              }
            >
              {msg.text || (
                <span className="flex items-center gap-1.5" style={{ color: 'var(--color-neutral)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Razonando localmente...
                </span>
              )}
            </div>

            {msg.sender === 'user' && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}
              >
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* QUICK SUGGESTIONS */}
      <div className="pt-2 pb-3 grid grid-cols-2 gap-2">
        {quickPrompts.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={isStreaming}
            className="text-[11px] px-3 py-1.5 rounded-xl text-center truncate transition-all disabled:opacity-50 font-medium cursor-pointer"
            style={{ background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-primary-fixed)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-on-primary-container)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-container-low)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-on-surface-variant)';
            }}
            title={q}
          >
            {q}
          </button>
        ))}
      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative flex items-center"
      >
        <input
          type="text"
          placeholder="Preguntale a Pockit AI sobre tus gastos..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
          className="w-full pl-4 pr-11 py-2.5 rounded-2xl text-xs disabled:opacity-50 outline-none transition-all"
          style={{
            background: 'var(--color-surface-container-low)',
            border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-surface)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary-container)';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201, 138, 44, 0.2)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="absolute right-1.5 p-1.5 rounded-xl disabled:opacity-40 transition-all cursor-pointer"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
