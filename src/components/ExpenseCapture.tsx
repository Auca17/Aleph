'use client';

import React, { useState, useRef } from 'react';
import { Camera, Mic, Square, Upload, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Expense } from '@/types/expense';

interface ExpenseCaptureProps {
  onExpenseAdded: (expense: Expense) => void;
}

export function ExpenseCapture({ onExpenseAdded }: ExpenseCaptureProps) {
  const [tab, setTab] = useState<'foto' | 'voz' | 'manual'>('foto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Manual inputs
  const [manualMonto, setManualMonto] = useState('');
  const [manualCat, setManualCat] = useState('Alimentación');
  const [manualDesc, setManualDesc] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setError(null);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audio = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audio);
        setAudioUrl(URL.createObjectURL(audio));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setError('No se pudo acceder al micrófono: ' + (err.message || 'Permiso denegado'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleProcessImage = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setProcessStep('1/3 Ejecutando OCR local (OCR_LATIN)...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fuente', 'foto');

      setTimeout(() => {
        setProcessStep('2/3 Categorizando con Llama 3.2 1B...');
      }, 1500);

      setTimeout(() => {
        setProcessStep('3/3 Verificando anomalías...');
      }, 3000);

      const res = await fetch('/api/gastos', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al procesar la imagen');
      }

      onExpenseAdded(json.data);
      setSuccessInfo(
        `Gasto registrado: $${json.data.monto} en ${json.data.categoria}${
          json.data.flag_anomalia ? ' ⚠️ (Anomalía detectada)' : ''
        }`
      );
      setSelectedFile(null);
      setImagePreview(null);
    } catch (err: any) {
      setError(err.message || 'Error durante la inferencia local');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleProcessAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setError(null);
    setProcessStep('1/3 Transcribiendo con Whisper local...');

    try {
      const formData = new FormData();
      const file = new File([audioBlob], 'audio-expense.wav', { type: 'audio/wav' });
      formData.append('file', file);
      formData.append('fuente', 'voz');

      setTimeout(() => {
        setProcessStep('2/3 Extrayendo monto y categoría...');
      }, 1500);

      setTimeout(() => {
        setProcessStep('3/3 Guardando registro...');
      }, 3000);

      const res = await fetch('/api/gastos', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al procesar el audio');
      }

      onExpenseAdded(json.data);
      setSuccessInfo(
        `Gasto registrado: $${json.data.monto} en ${json.data.categoria}${
          json.data.flag_anomalia ? ' ⚠️ (Anomalía detectada)' : ''
        }`
      );
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (err: any) {
      setError(err.message || 'Error durante la transcripción local');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMonto) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fuente: 'manual',
          monto: parseFloat(manualMonto),
          categoria: manualCat,
          descripcion: manualDesc
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error guardando gasto');
      }

      onExpenseAdded(json.data);
      setSuccessInfo(`Gasto manual registrado: $${json.data.monto}`);
      setManualMonto('');
      setManualDesc('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl shadow-zinc-200/50 dark:shadow-black/50 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            Cargar Gasto
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Inferencia local con QVAC (OCR, Whisper y Llama 3.2)
          </p>
        </div>

        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
          <button
            onClick={() => {
              setTab('foto');
              setError(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'foto'
                ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Foto Ticket
          </button>
          <button
            onClick={() => {
              setTab('voz');
              setError(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'voz'
                ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Voz
          </button>
          <button
            onClick={() => {
              setTab('manual');
              setError(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'manual'
                ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successInfo && (
        <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successInfo}</span>
          </div>
          <button
            onClick={() => setSuccessInfo(null)}
            className="text-xs underline hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* TAB FOTO */}
      {tab === 'foto' && (
        <div className="space-y-4">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-800/30 group"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Arrastrá o hacé clic para subir ticket
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                PNG, JPG, BMP • Extracción vía ONNX OCR local
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-black/5">
              <img
                src={imagePreview}
                alt="Ticket preview"
                className="max-h-60 w-full object-contain mx-auto"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setSelectedFile(null);
                }}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-md"
              >
                Cambiar foto
              </button>
            </div>
          )}

          {selectedFile && (
            <button
              onClick={handleProcessImage}
              disabled={isProcessing}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processStep || 'Procesando ticket...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Procesar Ticket con QVAC</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* TAB VOZ */}
      {tab === 'voz' && (
        <div className="space-y-4 text-center">
          <div className="py-8 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/30 ring-4 ring-rose-300 dark:ring-rose-900'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 hover:scale-105'
              }`}
            >
              {isRecording ? <Square className="w-7 h-7" /> : <Mic className="w-8 h-8" />}
            </button>
            <p className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {isRecording
                ? 'Grabando audio... Hablá claro (ej: "Gasté 4500 en la farmacia")'
                : 'Tocá para grabar nota de voz'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Transcripción en español vía Whisper local
            </p>
          </div>

          {audioUrl && !isRecording && (
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-between">
              <audio src={audioUrl} controls className="h-8 max-w-[220px]" />
              <button
                onClick={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                }}
                className="text-xs text-zinc-500 hover:text-rose-500 ml-2"
              >
                Descartar
              </button>
            </div>
          )}

          {audioBlob && !isRecording && (
            <button
              onClick={handleProcessAudio}
              disabled={isProcessing}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processStep || 'Transcribiendo audio...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Procesar Audio con QVAC</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* TAB MANUAL */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Monto ($)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={manualMonto}
              onChange={(e) => setManualMonto(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Categoría
            </label>
            <select
              value={manualCat}
              onChange={(e) => setManualCat(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option>Alimentación</option>
              <option>Transporte</option>
              <option>Servicios</option>
              <option>Salud</option>
              <option>Entretenimiento</option>
              <option>Indumentaria</option>
              <option>Tecnología</option>
              <option>Hogar</option>
              <option>Otros</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Descripción
            </label>
            <input
              type="text"
              placeholder="Ej: Café con medialunas"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-md transition-all disabled:opacity-50 mt-2"
          >
            {isProcessing ? 'Guardando...' : 'Guardar Gasto'}
          </button>
        </form>
      )}
    </div>
  );
}
