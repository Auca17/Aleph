'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

export function ChatQuery() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy Aleph, tu agente financiero local impulsado por QVAC. Podés preguntarme sobre tus gastos, totales por categoría o explicaciones sobre anomalías.'
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: textToSend })
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
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl shadow-zinc-200/50 dark:shadow-black/50 flex flex-col h-[520px]">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
              Consultor Aleph AI
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Llama 3.2 1B • 100% Inferencia Local
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
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap'
              }`}
            >
              {msg.text || (
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Razonando localmente...
                </span>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
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
            className="text-[11px] px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center truncate transition-all disabled:opacity-50 font-medium"
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
          placeholder="Preguntale a Aleph sobre tus gastos..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
          className="w-full pl-4 pr-11 py-2.5 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-40 transition-all"
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
