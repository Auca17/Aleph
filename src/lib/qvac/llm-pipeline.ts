import '@/lib/qvac/env';
import { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk';
import { ParsedExpense, Expense } from '@/types/expense';

let llmModelId: string | null = null;
let isLoading = false;
let loadPromise: Promise<string> | null = null;

export async function getLlmModel(): Promise<string> {
  if (llmModelId) return llmModelId;

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log('▸ [QVAC] Loading LLM Model (LLAMA_3_2_1B_INST_Q4_0)...');
      const id = await loadModel({
        modelSrc: LLAMA_3_2_1B_INST_Q4_0,
        modelConfig: {
          ctx_size: 2048,
          gpu_layers: 99
        }
      });
      llmModelId = id;
      console.log(`▸ [QVAC] LLM Model loaded. ID: ${id}`);
      return id;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

const VALID_CATEGORIES = [
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

function extractTag(tag: string, raw: string): string {
  const regex = new RegExp(`\\[\\[${tag}\\]\\]([\\s\\S]*?)\\[\\[\\/${tag}\\]\\]`, 'i');
  const match = raw.match(regex);
  return match ? match[1].trim() : '';
}

function normalizeCategory(rawCategory: string): string {
  if (!rawCategory) return 'Otros';
  const clean = rawCategory.trim();
  const match = VALID_CATEGORIES.find(
    (cat) => cat.toLowerCase() === clean.toLowerCase()
  );
  if (match) return match;
  for (const cat of VALID_CATEGORIES) {
    if (clean.toLowerCase().includes(cat.toLowerCase())) return cat;
  }
  return 'Otros';
}

function normalizeDate(rawDate: string, defaultDate: string): string {
  if (!rawDate) return defaultDate;
  const cleaned = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const ddmmyyyy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return defaultDate;
}

/**
 * Categorize raw text (from OCR or Voice) into structured expense fields using delimited tags.
 */
export async function parseAndCategorizeExpense(rawText: string): Promise<ParsedExpense> {
  const modelId = await getLlmModel();

  const systemPrompt = `Eres un asistente contable para finanzas personales y autónomos.
Tu tarea es analizar el texto extraído de un ticket o nota de voz en español y extraer los datos del gasto.
Las categorías permitidas son: Alimentación, Transporte, Servicios, Salud, Entretenimiento, Indumentaria, Tecnología, Hogar, Otros.

IMPORTANTE: Responde ÚNICAMENTE usando los siguientes delimitadores exactos sin texto adicional:
[[MONTO]]solo el numero sin simbolos[[/MONTO]]
[[CATEGORIA]]nombre de la categoria[[/CATEGORIA]]
[[FECHA]]YYYY-MM-DD[[/FECHA]]
[[DESCRIPCION]]breve descripcion del gasto[[/DESCRIPCION]]`;

  const todayStr = new Date().toISOString().split('T')[0];
  const userPrompt = `Fecha de hoy: ${todayStr}
Texto a procesar:
"""
${rawText}
"""`;

  const history = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = completion({ modelId, history, stream: false });
  let fullOutput = '';
  if (result.tokenStream) {
    for await (const token of result.tokenStream) {
      fullOutput += token;
    }
  } else if (result.text) {
    fullOutput = await result.text;
  }

  // Extract fields via delimiter tags & normalize
  const rawMonto = extractTag('MONTO', fullOutput).replace(/[^0-9.]/g, '');
  const parsedMonto = parseFloat(rawMonto) || 0;
  const rawCategoria = extractTag('CATEGORIA', fullOutput);
  const normalizedCategoria = normalizeCategory(rawCategoria);
  const rawFecha = extractTag('FECHA', fullOutput);
  const normalizedFecha = normalizeDate(rawFecha, todayStr);
  const rawDescripcion = extractTag('DESCRIPCION', fullOutput) || rawText.slice(0, 40);

  return {
    monto: parsedMonto,
    categoria: normalizedCategoria,
    fecha: normalizedFecha,
    descripcion: rawDescripcion
  };
}

/**
 * Natural language consultation over historical expenses.
 */
export async function* answerExpenseQuery(
  userQuery: string,
  expenses: Expense[]
): AsyncGenerator<string, void, unknown> {
  const modelId = await getLlmModel();

  // Cap to 5 most recent expenses, compact format to stay within context window
  const rows = expenses
    .slice(0, 5)
    .map(
      (e) =>
        `${e.fecha.slice(0, 10)} | $${e.monto} | ${e.categoria}${e.flag_anomalia ? ' [ALTO]' : ''}`
    )
    .join('\n');

  // Frame as a data analysis task to avoid safety refusals in small models
  const history = [
    {
      role: 'user' as const,
      content: `Analiza esta tabla de registros de gastos y responde la pregunta en español de forma breve:

TABLA:
fecha | monto | categoria
${rows || 'Sin registros.'}

PREGUNTA: ${userQuery}

RESPUESTA:`
    }
  ];

  const result = completion({ modelId, history, stream: true });
  for await (const token of result.tokenStream) {
    yield token;
  }
}
