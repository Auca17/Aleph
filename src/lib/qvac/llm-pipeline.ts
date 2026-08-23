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

function isCurrentWeekExpense(expense: Expense): boolean {
  const expenseDate = new Date(expense.fecha);
  if (Number.isNaN(expenseDate.getTime())) return false;

  const { start, end } = getCurrentWeekRange();
  return expenseDate >= start && expenseDate < end;
}

function expenseNeedsReview(expense: Expense): boolean {
  return !expense.reviewed && (Number(expense.monto || 0) <= 0 || expense.categoria === 'Otros');
}

function getExpenseAmount(expense: Expense): number {
  const amount = Number(expense.monto || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildScopeLabel(isWeekQuery: boolean): string {
  return isWeekQuery ? 'esta semana' : 'en los registros cargados';
}

function buildExpenseRows(expenses: Expense[]): string {
  if (expenses.length === 0) return '- Sin registros.';

  return expenses
    .map((expense) => {
      const label = expense.descripcion || expense.categoria || 'Gasto';
      const date = expense.fecha
        ? new Date(expense.fecha).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short'
          })
        : 'sin fecha';
      return `- ${label}: ${formatCurrency(getExpenseAmount(expense))} (${expense.categoria}, ${date})`;
    })
    .join('\n');
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
    'mas grande',
    'mas grandes',
    'mayor',
    'mayores',
    'gastos grandes',
    'gastos caros',
    'mas caro',
    'mas caros',
    'top',
    'ranking'
  ]);
}

function isTopCategoryQuery(normalizedQuery: string): boolean {
  return normalizedQuery.includes('categoria') && containsAny(normalizedQuery, [
    'mas gaste',
    'mas gasto',
    'mas se gasto',
    'mayor gasto',
    'mayor total',
    'principal',
    'top'
  ]);
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

function isReviewQuery(normalizedQuery: string): boolean {
  return containsAny(normalizedQuery, ['corregir', 'revision', 'revisar', 'pendiente', 'pendientes']);
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
    'gaste',
    'gasto',
    'gastos',
    'total',
    'semana',
    'categoria',
    'categorias',
    'anomalia',
    'anomalias',
    'corregir',
    'revision',
    'menor',
    'menores',
    'mayor',
    'mayores',
    'menos de',
    'mas de'
  ].some((term) => normalizedQuery.includes(term));
}

function buildExactExpenseAnswer(userQuery: string, expenses: Expense[]): string {
  const normalizedQuery = normalizeQueryText(userQuery);
  const isWeekQuery = normalizedQuery.includes('semana');
  const scopedExpenses = isWeekQuery ? expenses.filter(isCurrentWeekExpense) : expenses;
  const scopeLabel = buildScopeLabel(isWeekQuery);
  const total = scopedExpenses.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);
  const anomalies = scopedExpenses.filter((expense) => expense.flag_anomalia);
  const pendingReview = scopedExpenses.filter(expenseNeedsReview);
  const requestedCategory = getRequestedCategory(normalizedQuery, scopedExpenses);
  const amountFilter = getAmountFilter(normalizedQuery);

  if (normalizedQuery.includes('anomalia')) {
    if (anomalies.length === 0) {
      return `No hay anomalías detectadas ${scopeLabel}. Revisé ${scopedExpenses.length} ${pluralize(scopedExpenses.length, 'registro', 'registros')} por un total de ${formatCurrency(total)}.`;
    }

    const anomalyTotal = anomalies.reduce((acc, expense) => acc + getExpenseAmount(expense), 0);

    return `Sí: encontré ${anomalies.length} ${pluralize(anomalies.length, 'anomalía', 'anomalías')} ${scopeLabel}.\n\n${buildExpenseRows(anomalies)}\n\nMonto marcado como anómalo: ${formatCurrency(anomalyTotal)}. Total analizado: ${formatCurrency(total)}.`;
  }

  if (scopedExpenses.length === 0) {
    return `No hay gastos registrados ${scopeLabel}.`;
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
    const requestedLimit = getRequestedExpenseLimit(normalizedQuery, 5);
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

  const reviewText = pendingReview.length > 0
    ? `\n\nAdemás, hay ${pendingReview.length} registro${pendingReview.length === 1 ? '' : 's'} por revisar.`
    : '';

  return `Según los ${scopedExpenses.length} registros visibles, gastaste ${formatCurrency(total)} ${scopeLabel}.\n\nPor categoría:\n${buildCategorySummary(scopedExpenses)}${reviewText}`;
}

export async function* answerExpenseQuery(
  userQuery: string,
  expenses: Expense[]
): AsyncGenerator<string, void, unknown> {
  const normalizedQuery = normalizeQueryText(userQuery);

  if (shouldAnswerWithExactSummary(normalizedQuery)) {
    yield buildExactExpenseAnswer(userQuery, expenses);
    return;
  }

  const modelId = await getLlmModel();
  const total = expenses.reduce((acc, expense) => acc + Number(expense.monto || 0), 0);

  const history = [
    {
      role: 'user' as const,
      content: `Analiza estos registros de gastos y responde en español de forma breve.
Usa solo los datos provistos. No inventes montos ni categorías. Si necesitás mencionar totales, usa los totales ya calculados.

TOTAL_GASTOS_EXACTO: ${formatCurrency(total)}
TOTAL_REGISTROS: ${expenses.length}

TOTALES_POR_CATEGORIA:
${buildCategorySummary(expenses)}

REGISTROS_RECIENTES:
fecha | monto | categoria | descripcion
${buildRecentRows(expenses)}

PREGUNTA: ${userQuery}

RESPUESTA:`
    }
  ];

  const result = completion({ modelId, history, stream: true });
  for await (const token of result.tokenStream) {
    yield token;
  }
}
