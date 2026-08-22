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
        modelSrc: LLAMA_3_2_1B_INST_Q4_0
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

function extractTag(tag: string, raw: string): string {
  const regex = new RegExp(`\\[\\[${tag}\\]\\]([\\s\\S]*?)\\[\\[\\/${tag}\\]\\]`, 'i');
  const match = raw.match(regex);
  return match ? match[1].trim() : '';
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
  } else if (typeof (result as any).text === 'string') {
    fullOutput = (result as any).text;
  }

  // Extract fields via delimiter tags
  const rawMonto = extractTag('MONTO', fullOutput).replace(/[^0-9.]/g, '');
  const parsedMonto = parseFloat(rawMonto) || 0;
  const rawCategoria = extractTag('CATEGORIA', fullOutput) || 'Otros';
  const rawFecha = extractTag('FECHA', fullOutput) || todayStr;
  const rawDescripcion = extractTag('DESCRIPCION', fullOutput) || rawText.slice(0, 40);

  return {
    monto: parsedMonto,
    categoria: rawCategoria,
    fecha: rawFecha,
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

  const expensesSummary = expenses
    .slice(0, 30)
    .map(
      (e) =>
        `- ${e.fecha}: $${e.monto} (${e.categoria}) - ${e.descripcion || 'Sin desc'}${
          e.flag_anomalia ? ' [ANOMALÍA / GASTO ALTO]' : ''
        }`
    )
    .join('\n');

  const systemPrompt = `Eres el asistente de inteligencia financiera local Aleph.
El usuario te hace preguntas sobre sus gastos personales en lenguaje natural.
Tienes acceso al siguiente registro de gastos:
${expensesSummary || 'No hay gastos registrados todavía.'}

Reglas:
1. Responde de forma clara, concisa y empática en español.
2. Si detectas gastos marcados como ANOMALÍA, menciónalos y explica el impacto.
3. Si el usuario pide totales o cálculos, realiza la suma con precisión.`;

  const history = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery }
  ];

  const result = completion({ modelId, history, stream: true });
  for await (const token of result.tokenStream) {
    yield token;
  }
}
