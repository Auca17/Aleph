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

### Bloque 1 — Setup (12:00-13:30, ~1.5h)
- **Auk:** confirmar que `loadModel()` corre en la laptop de demo (`node quickstart.js` del quickstart QVAC). El `qvac.config.json` ya existe en el repo.
- **Federico:** levantar Supabase, crear tabla `gastos` con el schema (ver `src/types/expense.ts`), generar credenciales y compartirlas. Las variables necesarias son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en un `.env.local`. Sin ellas, el app funciona igual con el store in-memory.
- **Ariel y Facundo:** revisar los componentes existentes (`src/components/`) y el `src/app/page.tsx`. El layout base ya existe — continuarlo con datos mockeados.
- ✅ Fin de bloque: todos con el repo corriendo local (`npm run dev`) sin errores.

### Bloque 2 — Build core (13:30-hasta bien entrada la noche del sábado, el grueso del tiempo)
- **Auk:** ajustar y testear los tres pipelines en `src/lib/qvac/` con inputs reales (foto de ticket mal sacada, audio con ruido). El código base ya está — probarlo y corregir lo que no ande en la laptop de demo.
- **Federico:** si las rutas API base ya existen, el foco está en conectar correctamente con Supabase real y verificar que la tabla recibe los datos. Mockear la parte de IA si Auk no terminó — las API routes ya tienen esa lógica.
- **Ariel:** `ExpenseCapture.tsx` ya existe — revisarlo, completar la grabación de audio con Web API y la conversión a WAV, y probar el submit real contra `/api/gastos`.
- **Facundo:** `ExpenseList.tsx` y `ChatQuery.tsx` ya existen — revisarlos, conectar contra las API routes reales, y probar el streaming de `/api/consulta`.
- **Sync obligatorio cada 3-4h:** cada uno mergea a `main` lo que tenga andando, aunque sea parcial. Nada de guardar cambios grandes para el final.

### Bloque 3 — Integración real (mañana del domingo, primeras horas)
- Reemplazar todos los mocks (frontend y de Federico) por las llamadas reales al pipeline de Auk.
- Correr los tests manuales obligatorios: foto de ticket real mal sacada, audio con ruido, consulta contra datos reales, `git clone` limpio.
- Auk resuelve cualquier conflicto de merge que aparezca.

### Bloque 4 — Buffer + pulido (últimas 2-3h antes del corte)
- Nada de features nuevas. Solo bugs visibles y pulido de lo que se va a mostrar en el demo.
- Completar el README con permalinks reales a los archivos de inferencia QVAC, modelo/hardware usado y setup desde clone limpio.
- Usar el botón **"Preload Demo"** de la UI (llama a `GET /api/warmup`) para precargar los 3 modelos antes de grabar.

### Bloque 5 — Demo y pitch (última hora)
- Grabar el video demo de punta a punta mostrando el flujo real: subir foto → OCR → categorización → ver en lista → preguntar en chat.
- Auk ensaya el pitch al menos 2 veces cronometrado.
- Alguien del equipo (el que tenga margen) intenta el Vault Guardian en este bloque o en ratos muertos de bloques anteriores — nunca a costa de tiempo de desarrollo.

---

## Reglas de sincronización

- Merge chico y seguido > merge grande al final. Si algo anda, aunque sea a medias, se mergea.
- Nadie toca la rama de otro sin avisar — si hay que meter mano en `feature/ai-pipeline`, se avisa a Auk primero.
- El contrato de datos (`Expense` en `src/types/expense.ts`) no se cambia sin avisar a los 4 — todo el frontend y el backend dependen de que no se mueva.
- Si alguien se bloquea más de 20-30 min con algo, lo dice en el grupo — no se pierde tiempo solo.