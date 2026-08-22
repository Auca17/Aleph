import { loadModel, ocr, OCR_LATIN } from '@qvac/sdk';

let ocrModelId: string | null = null;
let isLoading = false;
let loadPromise: Promise<string> | null = null;

export async function getOcrModel(): Promise<string> {
  if (ocrModelId) return ocrModelId;

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log('▸ [QVAC] Loading OCR Model (OCR_LATIN)...');
      const id = await loadModel({
        modelSrc: OCR_LATIN,
        modelConfig: {
          langList: ['es', 'en'],
          magRatio: 1.5,
          defaultRotationAngles: [90, 180, 270],
          contrastRetry: true,
          lowConfidenceThreshold: 0.4,
          recognizerBatchSize: 1
        }
      });
      ocrModelId = id;
      console.log(`▸ [QVAC] OCR Model loaded. ID: ${id}`);
      return id;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export async function processImageOcr(imagePath: string): Promise<string> {
  const modelId = await getOcrModel();
  
  console.log(`▸ [QVAC] Running OCR on: ${imagePath}`);
  const { blocks } = ocr({
    modelId,
    image: imagePath,
    options: {
      paragraph: false
    }
  });

  const resultBlocks = await blocks;
  const extractedLines = resultBlocks.map((b) => b.text.trim()).filter(Boolean);
  return extractedLines.join('\n');
}
