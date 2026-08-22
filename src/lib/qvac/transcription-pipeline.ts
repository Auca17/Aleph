import { loadModel, transcribe, WHISPER_TINY } from '@qvac/sdk';

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
      console.log('▸ [QVAC] Loading Whisper Model (WHISPER_TINY)...');
      const id = await loadModel({
        modelSrc: WHISPER_TINY,
        modelConfig: {
          audio_format: 'f32le',
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
    prompt: prompt || 'Gasto personal, monto en pesos, supermercado, farmacia, taxi, transporte, comida.'
  });

  return (text || '').trim();
}
