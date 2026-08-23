'use client';

import React, { useState, useRef } from 'react';
import { Camera, Mic, Square, Upload, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Expense } from '@/types/expense';

interface ExpenseCaptureProps {
  onExpenseAdded: (expense: Expense) => void;
}

interface PhotoConfidence {
  level: 'alta' | 'media' | 'baja';
  label: string;
  reasons: string[];
}

interface PhotoAnalysis {
  monto: number;
  categoria: string;
  fecha: string;
  descripcion?: string;
  rawText: string;
}

const TARGET_SAMPLE_RATE = 16000;
const EXPENSE_CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Servicios',
  'Salud',
  'Entretenimiento',
  'Indumentaria',
  'Tecnología',
  'Hogar',
  'Otros'
];

function mergeAudioChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function downsampleBuffer(buffer: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (targetRate === sourceRate) return buffer;

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), buffer.length);
    let sum = 0;
    let count = 0;

    for (let j = start; j < end; j += 1) {
      sum += buffer[j];
      count += 1;
    }

    result[i] = count > 0 ? sum / count : 0;
  }

  return result;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, Number.isFinite(samples[i]) ? samples[i] : 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
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
  const [photoConfidence, setPhotoConfidence] = useState<PhotoConfidence | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysis | null>(null);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCategory, setPhotoCategory] = useState('Alimentación');
  const [photoAmount, setPhotoAmount] = useState('');

  // Manual inputs
  const [manualMonto, setManualMonto] = useState('');
  const [manualCat, setManualCat] = useState('Alimentación');
  const [manualDesc, setManualDesc] = useState('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const audioSampleRateRef = useRef(TARGET_SAMPLE_RATE);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setError(null);
      setSuccessInfo(null);
      setPhotoConfidence(null);
      setPhotoAnalysis(null);
      setPhotoTitle('');
      setPhotoAmount('');
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextConstructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error('Este navegador no soporta Web Audio API');
      }

      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      audioChunksRef.current = [];
      audioSampleRateRef.current = audioContext.sampleRate;
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      mediaStreamRef.current = stream;

      processor.onaudioprocess = (event) => {
        const channelData = event.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Permiso denegado';
      setError('No se pudo acceder al micrófono: ' + message);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    const processor = audioProcessorRef.current;
    const source = audioSourceRef.current;
    const audioContext = audioContextRef.current;
    const stream = mediaStreamRef.current;

    processor?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    void audioContext?.close();

    const merged = mergeAudioChunks(audioChunksRef.current);
    const downsampled = downsampleBuffer(
      merged,
      audioSampleRateRef.current,
      TARGET_SAMPLE_RATE
    );
    const audio = encodeWav(downsampled, TARGET_SAMPLE_RATE);

    setAudioBlob(audio);
    setAudioUrl(URL.createObjectURL(audio));
    setIsRecording(false);
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;
  };

  const handleAnalyzeImage = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setSuccessInfo(null);
    setPhotoConfidence(null);
    setPhotoAnalysis(null);
    setProcessStep('1/3 Ejecutando OCR local (OCR_LATIN)...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fuente', 'foto');
      formData.append('action', 'analyze');

      setTimeout(() => {
        setProcessStep('2/3 Detectando monto del ticket...');
      }, 1500);

      setTimeout(() => {
        setProcessStep('3/3 Calculando confianza...');
      }, 3000);

      const res = await fetch('/api/gastos', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al procesar la imagen');
      }

      const detectedAmount = Number(json.data?.monto ?? 0);
      const detectedCategory = json.data?.categoria || 'Alimentación';
      setPhotoAnalysis({
        monto: detectedAmount,
        categoria: detectedCategory,
        fecha: json.data?.fecha || new Date().toISOString().split('T')[0],
        descripcion: json.data?.descripcion,
        rawText: json.meta?.rawTextExtracted || ''
      });
      setPhotoAmount(detectedAmount > 0 ? String(detectedAmount) : '');
      setPhotoCategory(detectedCategory);
      setPhotoConfidence(json.meta?.photoConfidence ?? null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error durante la inferencia local';
      setError(message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleConfirmPhotoExpense = async () => {
    if (!photoAnalysis) return;
    if (!photoTitle.trim()) {
      setError('Poné un título para este ticket antes de guardarlo');
      return;
    }

    const confirmedAmount = Number(photoAmount);
    if (!Number.isFinite(confirmedAmount) || confirmedAmount <= 0) {
      setError('Confirmá un monto mayor a cero');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessStep('Guardando gasto confirmado...');

    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fuente: 'foto',
          text: photoAnalysis.rawText,
          monto: confirmedAmount,
          categoria: photoCategory,
          fecha: photoAnalysis.fecha,
          descripcion: photoTitle.trim()
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar el ticket');
      }

      onExpenseAdded(json.data);
      setPhotoConfidence(json.meta?.photoConfidence ?? photoConfidence);
      setSuccessInfo(
        `Gasto registrado: $${json.data.monto} en ${json.data.categoria}${
          json.data.flag_anomalia ? ' ⚠️ (Anomalía detectada)' : ''
        }`
      );
      setSelectedFile(null);
      setImagePreview(null);
      setPhotoTitle('');
      setPhotoAmount('');
      setPhotoAnalysis(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error guardando ticket';
      setError(message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleProcessAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setError(null);
    setPhotoConfidence(null);
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
      const message = err instanceof Error ? err.message : 'Error durante la transcripción local';
      setError(message);
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
      const message = err instanceof Error ? err.message : 'Error guardando gasto';
      setError(message);
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
              setPhotoConfidence(null);
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
              setPhotoConfidence(null);
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

      {photoConfidence && (
        <div
          className={`mb-4 p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
            photoConfidence.level === 'alta'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : photoConfidence.level === 'media'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
          }`}
        >
          {photoConfidence.level === 'alta' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">Monto del ticket: {photoConfidence.label}</p>
            <p className="mt-0.5 opacity-90">{photoConfidence.reasons.join('. ')}</p>
          </div>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Ticket preview"
                className="max-h-60 w-full object-contain mx-auto"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setSelectedFile(null);
                  setPhotoTitle('');
                  setPhotoAmount('');
                  setPhotoAnalysis(null);
                  setPhotoConfidence(null);
                }}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-md"
              >
                Cambiar foto
              </button>
            </div>
          )}

          {selectedFile && (
            <div className="space-y-3">
              {!photoAnalysis ? (
                <button
                  onClick={handleAnalyzeImage}
                  disabled={isProcessing}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{processStep || 'Analizando ticket...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analizar Ticket con QVAC</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Monto detectado
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={photoAmount}
                      onChange={(e) => setPhotoAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Supermercado, farmacia, cena..."
                      value={photoTitle}
                      onChange={(e) => setPhotoTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tipo de gasto
                    </label>
                    <select
                      value={photoCategory}
                      onChange={(e) => setPhotoCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {EXPENSE_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleConfirmPhotoExpense}
                    disabled={isProcessing}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{processStep || 'Guardando gasto...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar y Guardar</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
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
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Categoría
            </label>
            <select
              value={manualCat}
              onChange={(e) => setManualCat(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
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
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
