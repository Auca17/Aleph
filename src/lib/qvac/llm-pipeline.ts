import '@/lib/qvac/env';
import { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk';
import { ParsedExpense, Expense, ExpenseSource } from '@/types/expense';
import { Ingreso } from '@/types/ingreso';

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
function normalizeQueryText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatCurrency(value: number): string {
  const normalizedValue = Number.isFinite(value) ? value : 0;
  const absoluteValue = Math.abs(normalizedValue);
  const hasDecimals = !Number.isInteger(absoluteValue);
  const formattedValue = absoluteValue.toLocaleString('es-AR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });

  return `${normalizedValue < 0 ? '-' : ''}$${formattedValue}`;
}

function getCurrentWeekRange(): { start: Date; end: Date } {
  const start = new Date();
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dayFromMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function getCurrentMonthRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  return { start, end };
}

function isDateInRange(dateValue: string, range: { start: Date; end: Date }): boolean {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  return date >= range.start && date < range.end;
}

function getScopedRecords<T extends { fecha: string }>(
  records: T[],
  normalizedQuery: string
): { records: T[]; label: string } {
  if (normalizedQuery.includes('semana')) {
    return {
      records: records.filter((record) => isDateInRange(record.fecha, getCurrentWeekRange())),
      label: 'esta semana'
    };
  }

  if (normalizedQuery.includes('mes')) {
    return {
      records: records.filter((record) => isDateInRange(record.fecha, getCurrentMonthRange())),
      label: 'este mes'
    };
  }

  return { records, label: 'en los registros cargados' };
}

function getRecordDateLabel(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'sin fecha';

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short'
  });
}

function expenseNeedsReview(expense: Expense): boolean {
  return !expense.reviewed && (Number(expense.monto || 0) <= 0 || expense.categoria === 'Otros');
}

function getExpenseAmount(expense: Expense): number {
  const amount = Number(expense.monto || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getIncomeAmount(income: Ingreso): number {
  const amount = Number(income.monto || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildExpenseRows(expenses: Expense[]): string {
  if (expenses.length === 0) return '- Sin registros.';

  return expenses
    .map((expense) => {
      const label = expense.descripcion || expense.categoria || 'Gasto';
      const date = getRecordDateLabel(expense.fecha);
      return `- ${label}: ${formatCurrency(getExpenseAmount(expense))} (${expense.categoria}, ${date})`;
    })
    .join('\n');
}

function buildIncomeRows(incomes: Ingreso[]): string {
  if (incomes.length === 0) return '- Sin registros.';

  return incomes
    .map((income) => {
      const label = income.descripcion || income.categoria || 'Ingreso';
      const date = getRecordDateLabel(income.fecha);
      return `- ${label}: ${formatCurrency(getIncomeAmount(income))} (${income.categoria}, ${date})`;
    })
    .join('\n');
}

function getSearchTerms(normalizedQuery: string): string[] {
  const stopWords = new Set([
    'a',
    'al',
    'algo',
    'con',
    'cual',
    'cuales',
    'cuanto',
    'cuantos',
    'de',
    'del',
    'el',
    'en',
    'esta',
    'este',
    'fue',
    'gaste',
    'gasto',
    'gastos',
    'hice',
    'ingrese',
    'ingreso',
    'ingresos',
    'la',
    'las',
    'lo',
    'los',
    'mas',
    'me',
    'mi',
    'mis',
    'por',
    'que',
    'semana',
    'son',
    'tenes',
    'tengo',
    'total',
    'traeme',
    'un',
    'una'
  ]);

  return normalizedQuery
    .replace(/[¿?¡!.,:;()]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
    .filter((term) => !/^\d/.test(term))
    .filter((term) => !stopWords.has(term));
}

function findMatchingExpenses(normalizedQuery: string, expenses: Expense[]): Expense[] {
  const terms = getSearchTerms(normalizedQuery);
  if (terms.length === 0) return [];

  return expenses.filter((expense) => {
    const haystack = normalizeQueryText(
      `${expense.descripcion || ''} ${expense.categoria || ''} ${expense.raw_text || ''}`
    );
    return terms.some((term) => haystack.includes(term));
  });
}

function findMatchingIncomes(normalizedQuery: string, incomes: Ingreso[]): Ingreso[] {
  const terms = getSearchTerms(normalizedQuery);
  if (terms.length === 0) return [];

  return incomes.filter((income) => {
    const haystack = normalizeQueryText(`${income.descripcion || ''} ${income.categoria || ''}`);
    return terms.some((term) => haystack.includes(term));
  });
}

function buildCategorySummary(expenses: Expense[]): string {
  const sortedTotals = getCategoryTotals(expenses);

  if (sortedTotals.length === 0) return '- Sin categorías registradas.';

  return sortedTotals
    .map(([category, total]) => `- ${category}: ${formatCurrency(total)}`)
    .join('\n');
}

function getCategoryTotals(expenses: Expense[]): Array<[string, number]> {
  const totals = expenses.reduce<Record<string, number>>((acc, expense) => {
    const category = expense.categoria || 'Otros';
    acc[category] = (acc[category] || 0) + getExpenseAmount(expense);
    return acc;
  }, {});

  return Object.entries(totals)
    .sort(([, totalA], [, totalB]) => totalB - totalA);
}

function getIncomeCategoryTotals(incomes: Ingreso[]): Array<[string, number]> {
  const totals = incomes.reduce<Record<string, number>>((acc, income) => {
    const category = income.categoria || 'Otros';
    acc[category] = (acc[category] || 0) + getIncomeAmount(income);
    return acc;
  }, {});

  return Object.entries(totals)
    .sort(([, totalA], [, totalB]) => totalB - totalA);
}

function buildIncomeCategorySummary(incomes: Ingreso[]): string {
  const sortedTotals = getIncomeCategoryTotals(incomes);

  if (sortedTotals.length === 0) return '- Sin categorías registradas.';

  return sortedTotals
    .map(([category, total]) => `- ${category}: ${formatCurrency(total)}`)
    .join('\n');
}

function buildRecentRows(expenses: Expense[]): string {
  if (expenses.length === 0) return 'Sin registros.';

  return expenses
    .slice(0, 20)
    .map((expense) => {
      const date = expense.fecha.slice(0, 10);
      const description = expense.descripcion ? ` | ${expense.descripcion}` : '';
      const anomaly = expense.flag_anomalia ? ' | ANOMALIA' : '';
      return `${date} | ${formatCurrency(getExpenseAmount(expense))} | ${expense.categoria}${description}${anomaly}`;
    })
    .join('\n');
}

function getRequestedCategory(normalizedQuery: string, expenses: Expense[]): string | null {
  const availableCategories = Array.from(new Set(expenses.map((expense) => expense.categoria).filter(Boolean)));

  for (const category of availableCategories) {
    if (normalizedQuery.includes(normalizeQueryText(category))) {
      return category;
    }
  }

  const aliases: Array<{ category: string; terms: string[] }> = [
    { category: 'Alimentación', terms: ['alimentacion', 'comida', 'supermercado', 'cafe', 'restaurant', 'restaurante'] },
    { category: 'Transporte', terms: ['transporte', 'sube', 'colectivo', 'tren', 'taxi', 'uber'] },
    { category: 'Otros', terms: ['otros', 'otro'] }
  ];

  const match = aliases.find(({ terms }) => containsAny(normalizedQuery, terms));
  return match?.category || null;
}

function isLargestExpensesQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, [
    'lo mas caro',
    'mas grande',
    'mas grandes',
    'mayor',
    'mayores',
    'gastos grandes',
    'gastos caros',
    'mas caro',
    'mas caros',
    'pague',
    'pago mas alto',
    'top',
    'ranking'
  ]);
}

function isIncomeQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, [
    'ingreso',
    'ingresos',
    'ingrese',
    'ingresaste',
    'entro',
    'entraron',
    'entro plata',
    'plata que entro',
    'cobre',
    'cobro',
    'cobros',
    'cobranza',
    'cobranzas',
    'entrada',
    'entradas',
    'honorario',
    'honorarios',
    'freelance',
    'ventas',
    'inversiones',
    'sueldo'
  ]);
}

function isBalanceQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, [
    'balance',
    'saldo',
    'me queda',
    'queda',
    'resta',
    'diferencia',
    'resultado',
    'situacion'
  ]);
}

function isAverageQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, ['promedio', 'media', 'gasto promedio', 'ingreso promedio']);
}

function isTopCategoryQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, ['categoria', 'se me fue', 'comiendo', 'fue mas plata']) && containsAny(normalizedQuery, [
    'mas gaste',
    'mas gasto',
    'mas se gasto',
    'mas plata',
    'mayor gasto',
    'mayor total',
    'se me fue',
    'comiendo',
    'principal',
    'top'
  ]);
}

function isTopIncomeCategoryQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, ['categoria', 'plata', 'ingreso', 'ingresos', 'entro']) && containsAny(normalizedQuery, [
    'mayor parte',
    'mas ingresos',
    'mas ingreso',
    'mayor ingreso',
    'mayor total',
    'principal',
    'viene',
    'vienen',
    'proviene',
    'provienen'
  ]);
}

function isCombinedTopCategoryQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, ['gaste', 'gasto', 'gastos']) &&
    isIncomeQuery(normalizedQuery) &&
    containsAny(normalizedQuery, ['categoria', 'mas', 'mayor parte', 'mayor']);
}

function buildCombinedTopCategoryAnswer(
  expenses: Expense[],
  incomes: Ingreso[],
  normalizedQuery: string
): string {
  const scopedExpenses = getScopedRecords(expenses, normalizedQuery);
  const scopedIncomes = getScopedRecords(incomes, normalizedQuery);
  const totalExpenses = scopedExpenses.records.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);
  const totalIncomes = scopedIncomes.records.reduce((acc, income) => acc + getIncomeAmount(income), 0);
  const [topExpenseCategory] = getCategoryTotals(scopedExpenses.records);
  const [topIncomeCategory] = getIncomeCategoryTotals(scopedIncomes.records);
  const label = scopedExpenses.label === scopedIncomes.label ? scopedExpenses.label : 'en los registros cargados';

  if (!topExpenseCategory && !topIncomeCategory) {
    return `No hay gastos ni ingresos registrados ${label}.`;
  }

  const expenseText = topExpenseCategory
    ? `Gastos: la categoría donde más gastaste fue ${topExpenseCategory[0]}, con ${formatCurrency(topExpenseCategory[1])}${totalExpenses > 0 ? ` (${Math.round((topExpenseCategory[1] / totalExpenses) * 100)}% del total de gastos)` : ''}.`
    : 'Gastos: no hay gastos registrados.';

  const incomeText = topIncomeCategory
    ? `Ingresos: la categoría que más aportó fue ${topIncomeCategory[0]}, con ${formatCurrency(topIncomeCategory[1])}${totalIncomes > 0 ? ` (${Math.round((topIncomeCategory[1] / totalIncomes) * 100)}% del total de ingresos)` : ''}.`
    : 'Ingresos: no hay ingresos registrados.';

  return `${expenseText}\n\n${incomeText}`;
}

function isDateQuery(normalizedQuery: string): boolean {
  return /\b\d{1,2}\b/.test(normalizedQuery) && containsAny(normalizedQuery, [
    'ene',
    'enero',
    'feb',
    'febrero',
    'mar',
    'marzo',
    'abr',
    'abril',
    'may',
    'mayo',
    'jun',
    'junio',
    'jul',
    'julio',
    'ago',
    'agosto',
    'sep',
    'septiembre',
    'oct',
    'octubre',
    'nov',
    'noviembre',
    'dic',
    'diciembre'
  ]);
}

function getRequestedDate(normalizedQuery: string): { day: number; month: number } | null {
  const months: Record<string, number> = {
    ene: 0,
    enero: 0,
    feb: 1,
    febrero: 1,
    mar: 2,
    marzo: 2,
    abr: 3,
    abril: 3,
    may: 4,
    mayo: 4,
    jun: 5,
    junio: 5,
    jul: 6,
    julio: 6,
    ago: 7,
    agosto: 7,
    sep: 8,
    septiembre: 8,
    oct: 9,
    octubre: 9,
    nov: 10,
    noviembre: 10,
    dic: 11,
    diciembre: 11
  };
  const dayMatch = normalizedQuery.match(/\b([0-2]?\d|3[0-1])\b/);
  if (!dayMatch) return null;

  const monthEntry = Object.entries(months).find(([month]) => normalizedQuery.includes(month));
  if (!monthEntry) return null;

  return { day: Number(dayMatch[1]), month: monthEntry[1] };
}

function isSameRequestedDate(dateValue: string, requestedDate: { day: number; month: number }): boolean {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  return date.getDate() === requestedDate.day && date.getMonth() === requestedDate.month;
}

function getRequestedExpenseLimit(normalizedQuery: string, fallback: number): number {
  const numericMatch = normalizedQuery.match(/\b([1-9]|10)\b/);
  if (numericMatch) return Number(numericMatch[1]);

  const wordNumbers: Record<string, number> = {
    uno: 1,
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10
  };

  const wordMatch = Object.entries(wordNumbers).find(([word]) =>
    normalizedQuery.includes(word)
  );

  return wordMatch ? wordMatch[1] : fallback;
}

function getLargestQueryFallbackLimit(normalizedQuery: string): number {
  return containsAny(normalizedQuery, [
    'lo mas caro',
    'el mas caro',
    'la mas cara',
    'que fue',
    'cual fue',
    'mayor gasto',
    'mayor ingreso'
  ])
    ? 1
    : 5;
}

function isReviewQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, ['corregir', 'revision', 'revisar', 'pendiente', 'pendientes']);
}

function isAnomalyQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, [
    'anomalia',
    'anomalias',
    'raro',
    'raros',
    'extrano',
    'extranos',
    'sospechoso',
    'sospechosos',
    'inusual',
    'inusuales',
    'fuera de lo normal'
  ]);
}

function parseAmountFromQuery(normalizedQuery: string): number | null {
  const match = normalizedQuery.match(/(?:\$|\bars\b|\bpesos\b)?\s*(\d{1,3}(?:\.\d{3})+|\d+(?:[,.]\d+)?)/);
  if (!match) return null;

  const rawAmount = match[1];
  const normalizedAmount = rawAmount.includes('.') && /^\d{1,3}(?:\.\d{3})+$/.test(rawAmount)
    ? rawAmount.replace(/\./g, '')
    : rawAmount.replace(',', '.');
  const amount = Number(normalizedAmount);

  return Number.isFinite(amount) ? amount : null;
}

function getAmountFilter(normalizedQuery: string): { operator: 'under' | 'over'; amount: number } | null {
  const amount = parseAmountFromQuery(normalizedQuery);
  if (amount === null) return null;

  if (containsAny(normalizedQuery, ['menor', 'menores', 'menos de', 'debajo de', 'abajo de', 'bajo '])) {
    return { operator: 'under', amount };
  }

  if (containsAny(normalizedQuery, ['mayor', 'mayores', 'mas de', 'encima de', 'arriba de', 'superior'])) {
    return { operator: 'over', amount };
  }

  return null;
}

function shouldAnswerWithExactSummary(normalizedQuery: string): boolean {
  return [
    'balance',
    'saldo',
    'queda',
    'gaste',
    'gasto',
    'gastos',
    'pague',
    'pagar',
    'plata',
    'se me fue',
    'comiendo',
    'ingrese',
    'ingreso',
    'ingresos',
    'entro',
    'entraron',
    'cobre',
    'cobro',
    'entrada',
    'entradas',
    'promedio',
    'total',
    'semana',
    'mes',
    'categoria',
    'categorias',
    'anomalia',
    'anomalias',
    'raro',
    'raros',
    'extrano',
    'extranos',
    'sospechoso',
    'inusual',
    'corregir',
    'revision',
    'menor',
    'menores',
    'mayor',
    'mayores',
    'menos de',
    'mas de',
    'sube',
    'internet',
    'freelance',
    'honorarios',
    'ventas',
    'inversiones'
  ].some((term) => normalizedQuery.includes(term));
}

function buildBalanceAnswer(
  expenses: Expense[],
  incomes: Ingreso[],
  normalizedQuery: string
): string {
  const scopedExpenses = getScopedRecords(expenses, normalizedQuery);
  const scopedIncomes = getScopedRecords(incomes, normalizedQuery);
  const totalExpenses = scopedExpenses.records.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);
  const totalIncomes = scopedIncomes.records.reduce((acc, income) => acc + getIncomeAmount(income), 0);
  const balance = totalIncomes - totalExpenses;
  const label = scopedExpenses.label === scopedIncomes.label ? scopedExpenses.label : 'en los registros cargados';

  return `Tu balance ${label} es ${formatCurrency(balance)}.\n\nIngresos: ${formatCurrency(totalIncomes)} (${scopedIncomes.records.length} ${pluralize(scopedIncomes.records.length, 'registro', 'registros')})\nGastos: ${formatCurrency(totalExpenses)} (${scopedExpenses.records.length} ${pluralize(scopedExpenses.records.length, 'registro', 'registros')})`;
}

function buildExactIncomeAnswer(userQuery: string, incomes: Ingreso[]): string {
  const normalizedQuery = normalizeQueryText(userQuery);
  const { records: scopedIncomes, label: scopeLabel } = getScopedRecords(incomes, normalizedQuery);
  const total = scopedIncomes.reduce((acc, income) => acc + getIncomeAmount(income), 0);
  const amountFilter = getAmountFilter(normalizedQuery);
  const matchingIncomes = findMatchingIncomes(normalizedQuery, scopedIncomes);
  const requestedDate = isDateQuery(normalizedQuery) ? getRequestedDate(normalizedQuery) : null;

  if (scopedIncomes.length === 0) {
    return `No hay ingresos registrados ${scopeLabel}.`;
  }

  if (requestedDate) {
    const dateIncomes = scopedIncomes.filter((income) =>
      isSameRequestedDate(income.fecha, requestedDate)
    );
    const dateTotal = dateIncomes.reduce((acc, income) => acc + getIncomeAmount(income), 0);

    if (dateIncomes.length === 0) {
      return `No encontré ingresos para esa fecha ${scopeLabel}.`;
    }

    return `Para esa fecha encontré ${dateIncomes.length} ${pluralize(dateIncomes.length, 'ingreso', 'ingresos')}, por un total de ${formatCurrency(dateTotal)}:\n\n${buildIncomeRows(dateIncomes)}`;
  }

  if (matchingIncomes.length > 0) {
    const matchingTotal = matchingIncomes.reduce((acc, income) => acc + getIncomeAmount(income), 0);
    return `Encontré ${matchingIncomes.length} ${pluralize(matchingIncomes.length, 'ingreso relacionado', 'ingresos relacionados')} ${scopeLabel}, por un total de ${formatCurrency(matchingTotal)}:\n\n${buildIncomeRows(matchingIncomes)}`;
  }

  if (isTopIncomeCategoryQuery(normalizedQuery)) {
    const [topCategory] = getIncomeCategoryTotals(scopedIncomes);
    if (!topCategory) {
      return `No hay categorías con ingresos registrados ${scopeLabel}.`;
    }

    const [category, categoryTotal] = topCategory;
    const percentage = total > 0 ? Math.round((categoryTotal / total) * 100) : 0;
    const categoryIncomes = scopedIncomes.filter(
      (income) => normalizeQueryText(income.categoria) === normalizeQueryText(category)
    );

    return `La mayor parte de tus ingresos ${scopeLabel} viene de ${category}: ${formatCurrency(categoryTotal)} (${percentage}% del total).\n\nRegistros de esa categoría:\n${buildIncomeRows(categoryIncomes)}`;
  }

  if (amountFilter) {
    const filteredIncomes = scopedIncomes
      .filter((income) =>
        amountFilter.operator === 'under'
          ? getIncomeAmount(income) < amountFilter.amount
          : getIncomeAmount(income) > amountFilter.amount
      )
      .sort((incomeA, incomeB) => getIncomeAmount(incomeB) - getIncomeAmount(incomeA));
    const filteredTotal = filteredIncomes.reduce((acc, income) => acc + getIncomeAmount(income), 0);
    const comparisonLabel = amountFilter.operator === 'under' ? 'menores a' : 'mayores a';

    if (filteredIncomes.length === 0) {
      return `No encontré ingresos ${comparisonLabel} ${formatCurrency(amountFilter.amount)} ${scopeLabel}.`;
    }

    return `Encontré ${filteredIncomes.length} ${pluralize(filteredIncomes.length, 'ingreso', 'ingresos')} ${comparisonLabel} ${formatCurrency(amountFilter.amount)} ${scopeLabel}, por un total de ${formatCurrency(filteredTotal)}:\n\n${buildIncomeRows(filteredIncomes)}`;
  }

  if (isLargestExpensesQuery(normalizedQuery)) {
    const requestedLimit = getRequestedExpenseLimit(
      normalizedQuery,
      getLargestQueryFallbackLimit(normalizedQuery)
    );
    const topIncomes = [...scopedIncomes]
      .sort((incomeA, incomeB) => getIncomeAmount(incomeB) - getIncomeAmount(incomeA))
      .slice(0, Math.min(requestedLimit, scopedIncomes.length));

    return `Tus ${topIncomes.length} ${pluralize(topIncomes.length, 'ingreso más grande', 'ingresos más grandes')} ${scopeLabel} son:\n\n${buildIncomeRows(topIncomes)}\n\nTotal de ingresos analizado: ${formatCurrency(total)}.`;
  }

  if (isAverageQuery(normalizedQuery)) {
    const average = scopedIncomes.length > 0 ? total / scopedIncomes.length : 0;
    return `Tu ingreso promedio ${scopeLabel} es ${formatCurrency(average)}, calculado sobre ${scopedIncomes.length} ${pluralize(scopedIncomes.length, 'registro', 'registros')}.`;
  }

  return `Según los ${scopedIncomes.length} registros visibles, ingresaste ${formatCurrency(total)} ${scopeLabel}.\n\nPor categoría:\n${buildIncomeCategorySummary(scopedIncomes)}`;
}

function buildExactExpenseAnswer(userQuery: string, expenses: Expense[]): string {
  const normalizedQuery = normalizeQueryText(userQuery);
  const { records: scopedExpenses, label: scopeLabel } = getScopedRecords(expenses, normalizedQuery);
  const total = scopedExpenses.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);
  const anomalies = scopedExpenses.filter((expense) => expense.flag_anomalia);
  const pendingReview = scopedExpenses.filter(expenseNeedsReview);
  const requestedCategory = getRequestedCategory(normalizedQuery, scopedExpenses);
  const amountFilter = getAmountFilter(normalizedQuery);
  const requestedDate = isDateQuery(normalizedQuery) ? getRequestedDate(normalizedQuery) : null;
  const matchingExpenses = findMatchingExpenses(normalizedQuery, scopedExpenses);

  if (isAnomalyQuery(normalizedQuery)) {
    if (anomalies.length === 0) {
      return `No hay anomalías detectadas ${scopeLabel}. Revisé ${scopedExpenses.length} ${pluralize(scopedExpenses.length, 'registro', 'registros')} por un total de ${formatCurrency(total)}.`;
    }

    const anomalyTotal = anomalies.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);

    return `Sí: encontré ${anomalies.length} ${pluralize(anomalies.length, 'anomalía', 'anomalías')} ${scopeLabel}.\n\n${buildExpenseRows(anomalies)}\n\nMonto marcado como anómalo: ${formatCurrency(anomalyTotal)}. Total analizado: ${formatCurrency(total)}.`;
  }

  if (scopedExpenses.length === 0) {
    return `No hay gastos registrados ${scopeLabel}.`;
  }

  if (requestedDate) {
    const dateExpenses = scopedExpenses.filter((expense) =>
      isSameRequestedDate(expense.fecha, requestedDate)
    );
    const dateTotal = dateExpenses.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);

    if (dateExpenses.length === 0) {
      return `No encontré gastos para esa fecha ${scopeLabel}.`;
    }

    return `Para esa fecha encontré ${dateExpenses.length} ${pluralize(dateExpenses.length, 'gasto', 'gastos')}, por un total de ${formatCurrency(dateTotal)}:\n\n${buildExpenseRows(dateExpenses)}`;
  }

  if (matchingExpenses.length > 0 && matchingExpenses.length < scopedExpenses.length) {
    const matchingTotal = matchingExpenses.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);
    return `Encontré ${matchingExpenses.length} ${pluralize(matchingExpenses.length, 'gasto relacionado', 'gastos relacionados')} ${scopeLabel}, por un total de ${formatCurrency(matchingTotal)}:\n\n${buildExpenseRows(matchingExpenses)}`;
  }

  if (amountFilter) {
    const filteredExpenses = scopedExpenses
      .filter((expense) =>
        amountFilter.operator === 'under'
          ? getExpenseAmount(expense) < amountFilter.amount
          : getExpenseAmount(expense) > amountFilter.amount
      )
      .sort((expenseA, expenseB) => getExpenseAmount(expenseB) - getExpenseAmount(expenseA));
    const filteredTotal = filteredExpenses.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);
    const comparisonLabel = amountFilter.operator === 'under' ? 'menores a' : 'mayores a';

    if (filteredExpenses.length === 0) {
      return `No encontré gastos ${comparisonLabel} ${formatCurrency(amountFilter.amount)} ${scopeLabel}.`;
    }

    return `Encontré ${filteredExpenses.length} ${pluralize(filteredExpenses.length, 'gasto', 'gastos')} ${comparisonLabel} ${formatCurrency(amountFilter.amount)} ${scopeLabel}, por un total de ${formatCurrency(filteredTotal)}:\n\n${buildExpenseRows(filteredExpenses)}`;
  }

  if (isLargestExpensesQuery(normalizedQuery)) {
    const requestedLimit = getRequestedExpenseLimit(
      normalizedQuery,
      getLargestQueryFallbackLimit(normalizedQuery)
    );
    const topExpenses = [...scopedExpenses]
      .sort((expenseA, expenseB) => getExpenseAmount(expenseB) - getExpenseAmount(expenseA))
      .slice(0, Math.min(requestedLimit, scopedExpenses.length));

    return `Tus ${topExpenses.length} ${pluralize(topExpenses.length, 'gasto más grande', 'gastos más grandes')} ${scopeLabel} son:\n\n${buildExpenseRows(topExpenses)}\n\nTotal general analizado: ${formatCurrency(total)}.`;
  }

  if (isTopCategoryQuery(normalizedQuery)) {
    const [topCategory] = getCategoryTotals(scopedExpenses);
    if (!topCategory) {
      return `No hay categorías con gastos registrados ${scopeLabel}.`;
    }

    const [category, categoryTotal] = topCategory;
    const percentage = total > 0 ? Math.round((categoryTotal / total) * 100) : 0;

    return `La categoría en la que más gastaste ${scopeLabel} fue ${category}: ${formatCurrency(categoryTotal)} (${percentage}% del total).`;
  }

  if (isReviewQuery(normalizedQuery)) {
    if (pendingReview.length === 0) {
      return `No tenés registros pendientes de revisión ${scopeLabel}.`;
    }

    return `Tenés ${pendingReview.length} ${pluralize(pendingReview.length, 'registro pendiente', 'registros pendientes')} de revisión ${scopeLabel}:\n\n${buildExpenseRows(pendingReview)}`;
  }

  if (requestedCategory) {
    const categoryExpenses = scopedExpenses.filter(
      (expense) => normalizeQueryText(expense.categoria) === normalizeQueryText(requestedCategory)
    );
    const categoryTotal = categoryExpenses.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);

    if (categoryExpenses.length === 0) {
      return `No encontré gastos de ${requestedCategory} ${scopeLabel}.`;
    }

    return `En ${requestedCategory} tenés ${categoryExpenses.length} ${pluralize(categoryExpenses.length, 'gasto', 'gastos')} ${scopeLabel}, por un total de ${formatCurrency(categoryTotal)}:\n\n${buildExpenseRows(categoryExpenses)}`;
  }

  if (isAverageQuery(normalizedQuery)) {
    const average = scopedExpenses.length > 0 ? total / scopedExpenses.length : 0;
    return `Tu gasto promedio ${scopeLabel} es ${formatCurrency(average)}, calculado sobre ${scopedExpenses.length} ${pluralize(scopedExpenses.length, 'registro', 'registros')}.`;
  }

  const reviewText = pendingReview.length > 0
    ? `\n\nAdemás, hay ${pendingReview.length} registro${pendingReview.length === 1 ? '' : 's'} por revisar.`
    : '';

  return `Según los ${scopedExpenses.length} registros visibles, gastaste ${formatCurrency(total)} ${scopeLabel}.\n\nPor categoría:\n${buildCategorySummary(scopedExpenses)}${reviewText}`;
}

export async function* answerExpenseQuery(
  userQuery: string,
  expenses: Expense[],
  incomes: Ingreso[] = []
): AsyncGenerator<string, void, unknown> {
  const normalizedQuery = normalizeQueryText(userQuery);

  if (shouldAnswerWithExactSummary(normalizedQuery)) {
    if (isBalanceQuery(normalizedQuery)) {
      yield buildBalanceAnswer(expenses, incomes, normalizedQuery);
      return;
    }

    if (isCombinedTopCategoryQuery(normalizedQuery)) {
      yield buildCombinedTopCategoryAnswer(expenses, incomes, normalizedQuery);
      return;
    }

    if (isIncomeQuery(normalizedQuery)) {
      yield buildExactIncomeAnswer(userQuery, incomes);
      return;
    }

    yield buildExactExpenseAnswer(userQuery, expenses);
    return;
  }

  const modelId = await getLlmModel();
  const total = expenses.reduce((acc, expense) => acc + Number(expense.monto || 0), 0);
  const totalIncomes = incomes.reduce((acc, income) => acc + getIncomeAmount(income), 0);
  const balance = totalIncomes - total;

  const history = [
    {
      role: 'user' as const,
      content: `Analiza estos registros financieros y responde en español de forma breve.
Usa solo los datos provistos. No inventes montos, categorías ni fechas. Si necesitás mencionar totales, usa los totales ya calculados.

TOTAL_GASTOS_EXACTO: ${formatCurrency(total)}
TOTAL_INGRESOS_EXACTO: ${formatCurrency(totalIncomes)}
BALANCE_EXACTO: ${formatCurrency(balance)}
TOTAL_REGISTROS_GASTOS: ${expenses.length}
TOTAL_REGISTROS_INGRESOS: ${incomes.length}

GASTOS_POR_CATEGORIA:
${buildCategorySummary(expenses)}

INGRESOS_POR_CATEGORIA:
${buildIncomeCategorySummary(incomes)}

REGISTROS_RECIENTES:
fecha | monto | categoria | descripcion
${buildRecentRows(expenses)}

INGRESOS_RECIENTES:
fecha | monto | categoria | descripcion
${buildIncomeRows(incomes)}

PREGUNTA: ${userQuery}

RESPUESTA:`
    }
  ];

  const result = completion({ modelId, history, stream: true });
  for await (const token of result.tokenStream) {
    yield token;
  }
}
