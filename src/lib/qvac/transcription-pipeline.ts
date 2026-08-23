import '@/lib/qvac/env';
import { loadModel, transcribe, WHISPER_BASE_Q8_0 } from '@qvac/sdk';

let whisperModelId: string | null = null;
let isLoading = false;
let loadPromise: Promise<string> | null = null;

export async function getWhisperModel(): Promise<string> {
  if (whisperModelId) return whisperModelId;

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log('▸ [QVAC] Loading Whisper Model (WHISPER_BASE_Q8_0)...');
      const id = await loadModel({
        modelSrc: WHISPER_BASE_Q8_0,
        modelConfig: {
          audio_format: 's16le',
          strategy: 'greedy',
          n_threads: 4,
          language: 'es',
          translate: false,
          no_timestamps: true,
          single_segment: true,
          temperature: 0.0,
          suppress_blank: true
        }
      });
      whisperModelId = id;
      console.log(`▸ [QVAC] Whisper Model loaded. ID: ${id}`);
      return id;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export async function processAudioTranscription(
  audioFilePath: string,
  prompt?: string
): Promise<string> {
  const modelId = await getWhisperModel();

  console.log(`▸ [QVAC] Transcribing audio: ${audioFilePath}`);
  const text = await transcribe({
    modelId,
    audioChunk: audioFilePath,
    prompt:
      prompt ||
      'Notas de voz cortas de gastos personales en español de Argentina. Ejemplos: gasté 500 pesos en farmacia; pagué 1200 de transporte; compré comida por 4500 pesos.'
  });

  return (text || '').trim();
}
