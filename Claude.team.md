# CLAUDE.team.md — Reparto de trabajo (equipo de 4)

Complementa a `claude.md` (contexto base). Lee `claude.md` PRIMERO, luego este archivo.

---

## Qué ya existe en el repo (IMPORTANTE: leer antes de escribir cualquier código)

El setup base ya está implementado y buildea sin errores. **No reinventes estas piezas — úsalas.**

### Archivos de referencia obligatorios

| Archivo | Qué hace |
|---|---|
| `src/types/expense.ts` | Tipos TypeScript del contrato de datos — `Expense`, `ParsedExpense`, `ExpenseSource`. **Usar siempre estos tipos, no crear los propios.** |
| `src/lib/supabase/client.ts` | Helpers de Supabase: `fetchExpenses()`, `insertExpense()`, `removeExpense()`. Tiene fallback in-memory automático si no hay credenciales. |
| `src/lib/anomaly.ts` | Lógica de detección de anomalías en código (2x promedio). **No pedirle al LLM que detecte anomalías — ya existe aquí.** |
| `src/lib/qvac/ocr-pipeline.ts` | `processImageOcr(imagePath)` — OCR via `OCR_LATIN`. Singleton, modelo cargado una vez. |
| `src/lib/qvac/transcription-pipeline.ts` | `processAudioTranscription(audioFilePath)` — Whisper vía `WHISPER_TINY`. Singleton. |
| `src/lib/qvac/llm-pipeline.ts` | `parseAndCategorizeExpense(rawText)` y `answerExpenseQuery(query, expenses)`. LLM singleton. |
| `src/app/api/gastos/route.ts` | `GET` y `POST` para gastos. Ya conecta OCR/Whisper/LLM/Anomaly. |
| `src/app/api/gastos/[id]/route.ts` | `DELETE` por id. |
| `src/app/api/consulta/route.ts` | `POST` — streaming SSE del chat con el LLM. |
| `src/app/api/warmup/route.ts` | `GET` — precarga los 3 modelos QVAC en memoria. |

### Reglas de arquitectura que la IA de cada uno DEBE saber

1. **Toda API route que llame a QVAC debe tener `export const runtime = 'nodejs'` como primera línea.** Sin esto, Next.js puede correrla en Edge runtime y @qvac/sdk falla.
2. **Los modelos QVAC son singletons** — se cargan la primera vez que se llama a `getOcrModel()`, `getWhisperModel()` o `getLlmModel()`. No llamar a `loadModel()` directamente en route handlers.
3. **El LLM no parsea JSON crudo.** El parsing de categorización usa delimitadores `[[TAG]]valor[[/TAG]]` — ver `llm-pipeline.ts`. No modificar este patrón.
4. **`flag_anomalia` se calcula en `src/lib/anomaly.ts`**, nunca en el LLM ni en el frontend.
5. **`next.config.ts` ya tiene `serverExternalPackages: ['@qvac/sdk']`** — no modificar esto.

### Contrato de datos — tipo TypeScript real

```ts
// src/types/expense.ts
export type ExpenseSource = 'voz' | 'foto' | 'manual';

export interface Expense {
  id?: string;
  monto: number;
  categoria: string;       // "Alimentación" | "Transporte" | "Servicios" | "Salud" |
                           // "Entretenimiento" | "Indumentaria" | "Tecnología" | "Hogar" | "Otros"
  fecha: string;           // ISO-8601
  fuente: ExpenseSource;
  flag_anomalia: boolean;
  raw_text?: string;
  descripcion?: string;
  created_at?: string;
}
```

---

## Roles

- **[Auk]** — generalista, lidera, hace el pitch. Dueño de `feature/ai-pipeline`. Libre para destrabar a cualquiera, integra y resuelve conflictos de merge.
- **[Federico]** — generalista. Dueño de `feature/api-datos`.
- **[Ariel]** — frontend. Dueño de la mitad de `feature/frontend-captura`: pantallas de captura (voz + foto).
- **[Facundo]** — frontend. Dueño de la otra mitad de `feature/frontend-captura`: lista de gastos + chat de consulta.

---

## Timeline (arranque sábado 12PM, judging domingo 1PM)

### Bloque 1 — Setup (12:00-13:30, ~1.5h) — ✅ COMPLETADO
- **Auk:** ✅ Configuración base, `qvac.config.json`, `@qvac/sdk`, models pipelines listos.
- **Federico:** ✅ `supabase_schema.sql` creado con tabla `gastos`, índices y políticas RLS. Client configurado con fallback in-memory.
- **Ariel y Facundo:** ✅ Layout base de Next.js, `ExpenseCapture.tsx`, `ExpenseList.tsx` con barra de distribución por categoría y `ChatQuery.tsx`.
- ✅ **Estado**: El repo compila limpio (`npm run build` con 0 errores TS) y corre localmente.

### Bloque 2 — Build core (13:30-noche del sábado) — ✅ COMPLETADO
- **Auk:** ✅ Pipelines OCR (`OCR_LATIN`), Whisper (`WHISPER_TINY`) y LLM (`LLAMA_3_2_1B_INST_Q4_0`) con parsing delimitado `[[TAG]]`, normalización de categorías y fechas.
- **Federico:** ✅ Rutas API (`/api/gastos`, `/api/consulta`, `/api/warmup`) implementadas con `export const runtime = 'nodejs'`.
- **Ariel:** ✅ `ExpenseCapture.tsx` con soporte para tickets (foto) y voz (Web Audio API) y carga manual.
- **Facundo:** ✅ `ExpenseList.tsx` (con flag visual de anomalías + desglose porcentual) y `ChatQuery.tsx` (streaming SSE de respuestas).
- 🔄 **Sync status:** Merges de todas las ramas integrados en `main`, build limpio y 0 errores TypeScript.

### Bloque 3 — Integración real y Testing (domingo mañana) — ✅ COMPLETADO
- ✅ **Supabase Cloud Conectado y Verificado**: Variables en `.env.local`, operaciones `GET`, `POST` y `DELETE` validadas contra la base de datos real en Supabase.
- ✅ **Warmup y Modelos en Memoria**: Endpoint `/api/warmup` con los 3 modelos precargados (`OCR_LATIN`, `WHISPER_TINY`, `LLAMA_3_2_1B_INST_Q4_0`).
- ✅ **Pipeline Foto/OCR/LLM Validado**: Ticket real -> OCR -> Llama delimitado -> Anomaly -> Supabase.
- ✅ **Pipeline Audio/Whisper/LLM Validado**: Nota de voz WAV -> Whisper (`WHISPER_TINY`) -> Llama categorización -> Supabase.
- ✅ **Detección Estadística de Anomalías**: Cálculo determinístico en código (> 2x promedio de categoría con baseline >= 3) validado y verificado en la base de datos.
- ✅ **Chat / Streaming SSE Validado**: Consulta natural en `/api/consulta` respondiendo fluidamente con Llama-3.2-1B local procesando el historial de gastos y detectando outliers.

### Bloque 4 — Buffer + Pulido + Permalinks (domingo mediodía) — ✅ COMPLETADO
- ✅ **Permalinks en README.md actualizados**: Links directos a GitHub con números de línea exactos para los jueces.
- ✅ **README con Hardware/Latencia**: Sección completa con modelo, cuantización, RAM (~1.05 GB), latencias y arquitectura del sistema.
- ✅ **Sección de Arquitectura en README**: Diagrama textual del pipeline completo (Input → QVAC OCR/Whisper/LLM → Anomaly → Supabase → Chat).
- ✅ **Data Contract tipado**: Interface TypeScript documentada en README para los jueces.
- ✅ **Prompt Hardening**: System Prompt de Llama 3.2 1B optimizado para respuestas directas sobre gastos del usuario.
- ✅ **Bug crítico corregido**: Context overflow del LLM (`processPromptImpl: context overflow`) — `ctx_size` subido a 2048 y lista de gastos en chat capada a 10 registros para mantenerse dentro del context window.
- ✅ **Setup local sin pasos ocultos**: `npm install && npm run dev` y funciona out-of-the-box con fallback in-memory.
- ✅ **`.env.local` ignorado en git**: `.env*` está en `.gitignore` — credenciales no se commitean.

### Bloque 5 — Demo y Pitch (domingo 12:00-13:00)
- Grabar video demo de punta a punta (foto -> OCR -> categorización -> anomalía -> chat).
- Auk ensaya el pitch (Track 1: Local agents for operations work).

---

## Reglas de sincronización

- Merge chico y seguido > merge grande al final. Si algo anda, aunque sea a medias, se mergea.
- Nadie toca la rama de otro sin avisar — si hay que meter mano en `feature/ai-pipeline`, se avisa a Auk primero.
- El contrato de datos (`Expense` en `src/types/expense.ts`) no se cambia sin avisar a los 4 — todo el frontend y el backend dependen de que no se mueva.
- Si alguien se bloquea más de 20-30 min con algo, lo dice en el grupo — no se pierde tiempo solo.