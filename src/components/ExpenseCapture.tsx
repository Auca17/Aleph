'use client';

import React, { useState, useRef } from 'react';
import { Camera, Mic, Square, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
      
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audio = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audio);
        setAudioUrl(URL.createObjectURL(audio));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Permiso denegado';
      setError('No se pudo acceder al micrófono: ' + msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error durante la inferencia local';
      setError(msg);
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
      const ext = audioBlob.type.includes('webm')
        ? 'webm'
        : audioBlob.type.includes('mp4')
        ? 'mp4'
        : audioBlob.type.includes('ogg')
        ? 'ogg'
        : 'wav';

      const file = new File([audioBlob], `audio-expense.${ext}`, { type: audioBlob.type });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error durante la transcripción local';
      setError(msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error guardando gasto';
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const tabStyle = (active: boolean) => active
    ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-container)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
    : { color: 'var(--color-on-surface-variant)' };

  const inputStyle = {
    background: 'var(--color-surface-container-low)',
    border: '1px solid var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
  };

  return (
    <div
      className="rounded-3xl p-5 transition-all"
      style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-outline-variant)' }}
    >
      {/* TITLE + TAB SWITCHER */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            Cargar Gasto
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-neutral)' }}>
            Inferencia local con QVAC (OCR, Whisper y Llama 3.2)
          </p>
        </div>

        <div className="flex p-1 rounded-xl gap-0.5" style={{ background: 'var(--color-surface-container-high)' }}>
          {(['foto', 'voz', 'manual'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              style={tabStyle(tab === t)}
            >
              {t === 'foto' && <Camera className="w-3.5 h-3.5" />}
              {t === 'voz' && <Mic className="w-3.5 h-3.5" />}
              {t === 'foto' ? 'Foto' : t === 'voz' ? 'Voz' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl text-xs flex items-center gap-2" style={{ background: 'var(--color-error-container)', border: '1px solid rgba(186,26,26,0.3)', color: 'var(--color-error)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS */}
      {successInfo && (
        <div className="mb-4 p-3.5 rounded-xl text-xs flex items-center justify-between" style={{ background: 'var(--color-secondary-fixed)', border: '1px solid var(--color-secondary-container)', color: 'var(--color-secondary)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successInfo}</span>
          </div>
          <button onClick={() => setSuccessInfo(null)} className="text-xs underline hover:opacity-80 ml-4">
            Cerrar
          </button>
        </div>
      )}

      {/* TAB: FOTO */}
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
              className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary-container)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-outline-variant)')}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                Arrastrá o hacé clic para subir ticket
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-neutral)' }}>
                PNG, JPG, BMP · Extracción vía ONNX OCR local
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-outline-variant)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Ticket preview"
                className="max-h-60 w-full object-contain mx-auto"
              />
              <button
                onClick={() => { setImagePreview(null); setSelectedFile(null); }}
                className="absolute top-2 right-2 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-md"
                style={{ background: 'rgba(32,27,20,0.75)' }}
              >
                Cambiar foto
              </button>
            </div>
          )}

          {selectedFile && (
            <button
              onClick={handleProcessImage}
              disabled={isProcessing}
              className="w-full py-3 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processStep || 'Procesando ticket...'}</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Procesar Ticket con QVAC</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* TAB: VOZ */}
      {tab === 'voz' && (
        <div className="space-y-4 text-center">
          <div className="py-8 rounded-2xl flex flex-col items-center justify-center" style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)' }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                isRecording ? 'animate-pulse' : 'hover:scale-105'
              }`}
              style={
                isRecording
                  ? { background: 'var(--color-error)', color: 'var(--color-on-error)', outline: '4px solid rgba(186,26,26,0.3)' }
                  : { background: 'var(--color-primary)', color: 'var(--color-on-primary)' }
              }
            >
              {isRecording ? <Square className="w-7 h-7" /> : <Mic className="w-8 h-8" />}
            </button>
            <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
              {isRecording
                ? 'Grabando audio... Hablá claro (ej: "Gasté 4500 en la farmacia")'
                : 'Tocá para grabar nota de voz'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-neutral)' }}>
              Transcripción en español vía Whisper local
            </p>
          </div>

          {audioUrl && !isRecording && (
            <div className="p-3 rounded-xl flex items-center justify-between" style={{ background: 'var(--color-surface-container-high)' }}>
              <audio src={audioUrl} controls className="h-8 max-w-[220px]" />
              <button
                onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                className="text-xs ml-2 hover:opacity-80"
                style={{ color: 'var(--color-neutral)' }}
              >
                Descartar
              </button>
            </div>
          )}

          {audioBlob && !isRecording && (
            <button
              onClick={handleProcessAudio}
              disabled={isProcessing}
              className="w-full py-3 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processStep || 'Transcribiendo audio...'}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Procesar Audio con QVAC</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* TAB: MANUAL */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Monto ($)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={manualMonto}
              onChange={(e) => setManualMonto(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-container)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,138,44,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Categoría
            </label>
            <select
              value={manualCat}
              onChange={(e) => setManualCat(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-container)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
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
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Descripción
            </label>
            <input
              type="text"
              placeholder="Ej: Café con medialunas"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-container)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,138,44,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-2.5 font-semibold rounded-xl text-sm transition-all disabled:opacity-50 mt-2 cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
          >
            {isProcessing ? 'Guardando...' : 'Guardar Gasto'}
          </button>
        </form>
      )}
    </div>
  );
}
