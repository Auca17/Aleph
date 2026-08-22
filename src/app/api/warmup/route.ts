export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getOcrModel } from '@/lib/qvac/ocr-pipeline';
import { getWhisperModel } from '@/lib/qvac/transcription-pipeline';
import { getLlmModel } from '@/lib/qvac/llm-pipeline';

export async function GET() {
  const results: Record<string, string> = {};

  try {
    const ocrId = await getOcrModel();
    results.ocr = `Ready (ID: ${ocrId})`;
  } catch (e: any) {
    results.ocr = `Error: ${e.message}`;
  }

  try {
    const whisperId = await getWhisperModel();
    results.whisper = `Ready (ID: ${whisperId})`;
  } catch (e: any) {
    results.whisper = `Error: ${e.message}`;
  }

  try {
    const llmId = await getLlmModel();
    results.llm = `Ready (ID: ${llmId})`;
  } catch (e: any) {
    results.llm = `Error: ${e.message}`;
  }

  return NextResponse.json({
    success: true,
    status: 'Warmup completed',
    models: results
  });
}
