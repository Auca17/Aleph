import '@/lib/qvac/env';
import { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk';
import { ParsedExpense, Expense, ExpenseSource } from '@/types/expense';

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

function normalizeCategory(rawCategory: string, rawText: string): string {
  const clean = rawCategory.trim();
  const exact = VALID_CATEGORIES.find(
    (category) => category.toLowerCase() === clean.toLowerCase()
  );
  if (exact) return exact;

  const text = `${clean} ${rawText}`.toLowerCase();
  if (/(farmacia|medic|salud|doctor|odont|hospital|clinica|clínica)/.test(text)) {
    return 'Salud';
  }
  if (/(sube|colectivo|tren|taxi|uber|cabify|transporte|nafta|combustible|peaje)/.test(text)) {
    return 'Transporte';
  }
  if (/(super|mercado|carrefour|coto|jumbo|dia|comida|bebida|gaseosa|cerveza|restaurante|cafe|café|panader|verduler|carnicer|almacen|almacén)/.test(text)) {
    return 'Alimentación';
  }
  if (/(luz|gas|agua|internet|telefono|teléfono|servicio|expensa|alquiler)/.test(text)) {
    return 'Servicios';
  }
  if (/(cine|bar|juego|netflix|spotify|salida|entretenimiento)/.test(text)) {
    return 'Entretenimiento';
  }
  if (/(ropa|zapat|remera|pantal|indumentaria)/.test(text)) {
    return 'Indumentaria';
  }
  if (/(tecnolog|celular|notebook|computadora|cargador|auricular)/.test(text)) {
    return 'Tecnología';
  }
  if (/(hogar|mueble|limpieza|ferreter|cocina)/.test(text)) {
    return 'Hogar';
  }

  return 'Otros';
}

function parseAmountToken(token: string): number | null {
  const normalized = token.replace(/[^\d.,]/g, '');
  if (!normalized) return null;

  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const lastSeparator = Math.max(lastDot, lastComma);
  let numeric = normalized;

  if (lastSeparator >= 0) {
    const separator = normalized[lastSeparator];
    const decimals = normalized.slice(lastSeparator + 1);
    const integer = normalized.slice(0, lastSeparator).replace(/[.,]/g, '');

    if (decimals.length === 3 && integer.length <= 3) {
      numeric = `${integer}${decimals}`;
    } else if (decimals.length > 0 && decimals.length <= 2) {
      numeric = `${integer}.${decimals}`;
    } else {
      numeric = normalized.replace(/[.,]/g, '');
    }

    if (separator === ',' && decimals.length <= 2) {
      numeric = numeric.replace(',', '.');
    }
  }

  const amount = Number.parseFloat(numeric);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;
  return amount;
}

function extractAmounts(text: string): number[] {
  const ocrNormalized = text
    .replace(/([0-9])[oO]/g, (_match, digit: string) => `${digit}0`)
    .replace(/[oO]([0-9])/g, (_match, digit: string) => `0${digit}`);
  const matches = ocrNormalized.match(/\d+(?:[.,]\d+)*/g) || [];

  return matches
    .map(parseAmountToken)
    .filter((amount): amount is number => amount !== null);
}

function isReceiptLikeText(text: string): boolean {
  return /\b(ticket|factura|cuit|cuil|consumidor|supermercado|carrefour|coto|jumbo|dia|compra|pago|pagado|efectivo|tarjeta|total|subtotal|iva)\b/i.test(
    text
  );
}

function isReceiptMetadataLine(line: string): boolean {
  return /\b(cuit|cuil|dni|doc|tel|telefono|teléfono|factura|fecha|hora|cajero|cliente|consumidor|iva|ing\.?|brutos|cae|cod|codigo|código|art|nro|p\.?\s*v\.?|pto)\b/i.test(
    line
  );
}

function hasReceiptTotalLabel(line: string): boolean {
  return /\b(total|tot|importe|monto|suma\s+de\s+sus\s+pagos|total\s+a\s+pagar)\b|t[o0]ta[il1]|t[o0]t/i.test(
    line
  );
}

function extractLastAmountNearTotalLine(lines: string[], lookAhead = 2): number | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!hasReceiptTotalLabel(line) || /subtotal/i.test(line)) continue;

    const sameLineAmounts = extractAmounts(line);
    if (sameLineAmounts.length > 0) return sameLineAmounts[sameLineAmounts.length - 1];

    for (let offset = 1; offset <= lookAhead; offset += 1) {
      const nearbyLine = lines[index + offset] || '';
      if (isReceiptMetadataLine(nearbyLine)) continue;

      const nearbyAmounts = extractAmounts(nearbyLine);
      if (nearbyAmounts.length > 0) return nearbyAmounts[nearbyAmounts.length - 1];
    }
  }

  return null;
}

function extractPaymentTotal(lines: string[]): number | null {
  const paymentAmounts = lines
    .filter((line) => /\b(pagado|pago|abonado|efectivo|tarjeta|visa|master|debito|débito|credito|crédito)\b/i.test(line))
    .flatMap(extractAmounts);

  if (paymentAmounts.length === 0) return null;
  return paymentAmounts.reduce((sum, amount) => sum + amount, 0);
}

function extractLikelyPriceAmounts(lines: string[]): number[] {
  return lines
    .filter((line) => !isReceiptMetadataLine(line))
    .filter((line) => !/\b(compra|consumidor|ayuda|visita|customerreceipt)\b/i.test(line))
    .filter((line) => /[$€]|\d+[.,]\d{2,3}\b/.test(line))
    .flatMap(extractAmounts)
    .filter((amount) => amount < 1_000_000);
}

const SPANISH_SMALL_NUMBERS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29
};

const SPANISH_TENS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90
};

const SPANISH_HUNDREDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900
};

function extractSpanishWordAmount(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let total = 0;
  let current = 0;
  let sawNumberWord = false;

  for (const token of tokens) {
    if (token === 'y') continue;

    if (SPANISH_SMALL_NUMBERS[token] !== undefined) {
      current += SPANISH_SMALL_NUMBERS[token];
      sawNumberWord = true;
      continue;
    }

    if (SPANISH_TENS[token] !== undefined) {
      current += SPANISH_TENS[token];
      sawNumberWord = true;
      continue;
    }

    if (SPANISH_HUNDREDS[token] !== undefined) {
      current += SPANISH_HUNDREDS[token];
      sawNumberWord = true;
      continue;
    }

    if (token === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
      sawNumberWord = true;
    }
  }

  const amount = total + current;
  if (!sawNumberWord || amount <= 0 || amount > 10_000_000) return null;
  return amount;
}

function extractVoiceAmount(rawText: string): number | null {
  const numericAmounts = extractAmounts(rawText);
  if (numericAmounts.length > 0) return Math.max(...numericAmounts);

  return extractSpanishWordAmount(rawText);
}

function extractAmount(rawText: string, llmAmount: number, source?: ExpenseSource): number {
  if (source === 'voz') {
    const voiceAmount = extractVoiceAmount(rawText);
    if (voiceAmount !== null) return voiceAmount;
    if (llmAmount > 0) return llmAmount;
    return 0;
  }

  const lines = rawText.split(/\r?\n/);
  const receiptLike = isReceiptLikeText(rawText);
  const receiptTotal = extractLastAmountNearTotalLine(lines);
  if (receiptTotal !== null) return receiptTotal;

  const paymentTotal = extractPaymentTotal(lines);
  if (paymentTotal !== null) return paymentTotal;

  const amounts = extractLikelyPriceAmounts(lines);
  if (amounts.length > 0) return Math.max(...amounts);

  if (receiptLike) return 0;
  if (llmAmount > 0) return llmAmount;
  return 0;
}

function normalizeDate(rawDate: string, defaultDate: string): string {
  const clean = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return defaultDate;
}

/**
 * Categorize raw text (from OCR or Voice) into structured expense fields using delimited tags.
 */
export async function parseAndCategorizeExpense(
  rawText: string,
  source?: ExpenseSource
): Promise<ParsedExpense> {
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

  const llmMonto = parseAmountToken(extractTag('MONTO', fullOutput)) || 0;
  const rawCategoria = extractTag('CATEGORIA', fullOutput);
  const rawFecha = extractTag('FECHA', fullOutput);
  const rawDescripcion = extractTag('DESCRIPCION', fullOutput) || rawText.slice(0, 40);

  return {
    monto: extractAmount(rawText, llmMonto, source),
    categoria: normalizeCategory(rawCategoria, rawText),
    fecha: normalizeDate(rawFecha, todayStr),
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
