# Pockit — Local Operations Agent for Personal Finances (QVAC Hackathon 2026)

> **Track 1: Local agents for operations work — QVAC (Tether)**  
> 100% On-Device AI Inference with `@qvac/sdk`. Zero cloud AI calls.

Pockit is an intelligent personal expense manager built for freelancers and autonomous workers who lack formal accounting. The user captures expenses through **voice notes** or **receipt photos**; Pockit transcribes, performs OCR, categorizes expenses, detects financial outliers/anomalies deterministically in code, and provides conversational financial consultation via local streaming LLM inference.

---

## 🚀 QVAC Capabilities & Models Used

All AI inference runs **locally on the user's device** via `@qvac/sdk`. Zero cloud AI calls.

| Capability | Engine / Model | Quantization | Hardware Footprint | Approx. Latency |
|---|---|---|---|---|
| **OCR (Receipt Scanning)** | `OCR_LATIN` (ONNX Runtime) | — | ~100 MB RAM | 2–5s per image |
| **Voice Transcription (ASR)** | `WHISPER_TINY` (whisper.cpp) | FP16 | ~150 MB RAM | 1–3s per clip |
| **Categorization & Chat** | `LLAMA_3_2_1B_INST_Q4_0` (llama.cpp) | Q4_0 | ~800 MB RAM | 3–8s first token |

**Total In-Memory AI Footprint:** ~1.05 GB RAM — fits on any standard consumer laptop.  
**Test Hardware:** Windows 11, GPU-accelerated inference via llama.cpp + ONNX Runtime.

---

## 🔍 Direct Permalinks to QVAC Inference Code

As required by the track guidelines, here are the exact entrypoints where QVAC inference executes:

1. **OCR Pipeline (`OCR_LATIN`)**:  
   👉 [`src/lib/qvac/ocr-pipeline.ts`](src/lib/qvac/ocr-pipeline.ts#L40-L55) · [GitHub Link](https://github.com/Auca17/Pockit/blob/main/src/lib/qvac/ocr-pipeline.ts#L40-L55)  
   *Uses `loadModel` with `OCR_LATIN` and `ocr()` to extract text from receipt images locally.*

2. **Transcription Pipeline (`WHISPER_TINY`)**:  
   👉 [`src/lib/qvac/transcription-pipeline.ts`](src/lib/qvac/transcription-pipeline.ts#L43-L57) · [GitHub Link](https://github.com/Auca17/Pockit/blob/main/src/lib/qvac/transcription-pipeline.ts#L43-L57)  
   *Uses `loadModel` with `WHISPER_TINY` and `transcribe()` for Spanish voice note transcription.*

3. **LLM Categorization & Natural Language Chat (`LLAMA_3_2_1B_INST_Q4_0`)**:  
   👉 [`src/lib/qvac/llm-pipeline.ts`](src/lib/qvac/llm-pipeline.ts#L83-L133) · [GitHub Link](https://github.com/Auca17/Pockit/blob/main/src/lib/qvac/llm-pipeline.ts#L83-L133)  
   *Uses `loadModel` + `completion()` with delimited tag parsing `[[TAG]]..[[/TAG]]` for structured categorization.*  
   👉 Chat streaming: [`src/lib/qvac/llm-pipeline.ts`](src/lib/qvac/llm-pipeline.ts#L138-L174) · [GitHub Link](https://github.com/Auca17/Pockit/blob/main/src/lib/qvac/llm-pipeline.ts#L138-L174)  
   *Streaming token generator using `completion({ stream: true })` for real-time SSE responses.*

4. **Deterministic Anomaly Detection** (no LLM — code only):  
   👉 [`src/lib/anomaly.ts`](src/lib/anomaly.ts#L8-L49) · [GitHub Link](https://github.com/Auca17/Pockit/blob/main/src/lib/anomaly.ts#L8-L49)  
   *Calculates statistical outliers (> 2× category average, baseline ≥ 3 records) in code, avoiding LLM hallucinations.*

---

## 🎥 Demo Video

> 📽️ [Watch the full demo on YouTube / Drive — E2E: Photo → OCR → Categorization → Anomaly → Chat]  
> *(Link to be added before judging submission)*

The demo shows the complete pipeline running **100% locally** with no internet for AI:
- Taking a photo of a receipt → OCR extraction → LLM categorization → anomaly detection → persisted to Supabase
- Recording a voice note → Whisper transcription → LLM extraction → saved
- Asking the chat agent "¿Cuánto gasté en transporte esta semana?" → streaming local LLM response

---

## 💻 Clean Clone Setup & Running Locally

### Prerequisites
- **Node.js**: `>= v22.17.0`
- **npm**: `>= v10.9.0`
- **RAM**: At least 2 GB free (models need ~1.05 GB)

### 1. Clone repository
```bash
git clone https://github.com/Auca17/Pockit.git
cd Pockit
```

### 2. Install dependencies
```bash
npm install
```

### 3. (Optional) Setup Supabase cloud persistence
If you want cloud persistence, create `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
Then execute the SQL schema in [`supabase_schema.sql`](supabase_schema.sql) in the Supabase SQL Editor.  
**Without credentials, Pockit works automatically with a built-in in-memory fallback store — no setup required.**

### 4. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Preload AI models
On first request, models download and load (~30–90s). To preload before a demo:
- Click **"Preload Demo"** button in the UI header, OR
- Call `GET http://localhost:3000/api/warmup`

---

## 🏗️ Architecture

```
User Input (Photo/Voice/Manual)
    ↓
[Next.js Frontend — React, Tailwind]
    ↓ multipart/form-data or JSON
[API Route /api/gastos — Node.js runtime]
    ↓ local inference (no internet for AI)
    ├── OCR_LATIN       → raw text from receipt image
    ├── WHISPER_TINY    → transcription from voice clip
    └── LLAMA_3_2_1B   → [[TAG]] delimited categorization
    ↓ deterministic code (src/lib/anomaly.ts)
    └── flag_anomalia: amount > 2× category average
    ↓
[Supabase (cloud persistence) OR in-memory fallback]
    ↓
[API Route /api/consulta — streaming SSE]
    └── LLAMA_3_2_1B → real-time token stream → ChatQuery.tsx
```

---

## 📊 Data Contract

```typescript
interface Expense {
  id?: string;
  monto: number;           // e.g. 4500.00
  categoria: string;       // "Alimentación" | "Transporte" | "Servicios" | "Salud" |
                           // "Entretenimiento" | "Indumentaria" | "Tecnología" | "Hogar" | "Otros"
  fecha: string;           // ISO-8601
  fuente: "voz" | "foto" | "manual";
  flag_anomalia: boolean;  // calculated deterministically in code, never by LLM
  raw_text?: string;       // original OCR / transcription output
  descripcion?: string;
  created_at?: string;
}
```

---

## 🛡️ License

MIT License — Open Source
