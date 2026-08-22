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
  } catch (e: unknown) {
    results.ocr = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }

  try {
    const whisperId = await getWhisperModel();
    results.whisper = `Ready (ID: ${whisperId})`;
  } catch (e: unknown) {
    results.whisper = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }

  try {
    const llmId = await getLlmModel();
    results.llm = `Ready (ID: ${llmId})`;
  } catch (e: unknown) {
    results.llm = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }

  return NextResponse.json({
    success: true,
    status: 'Warmup completed',
    models: results
  });
}
