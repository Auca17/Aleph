# Aleph — Local Operations Agent for Personal Finances (QVAC Hackathon 2026)

> **Track 1: Local agents for operations work — QVAC (Tether)**  
> 100% On-Device AI Inference with `@qvac/sdk`. Zero cloud AI calls.

Aleph is an intelligent personal expense manager built for freelancers and autonomous workers who lack formal accounting. The user captures expenses through **voice notes** or **receipt photos**; Aleph transcribes, performs OCR, categorizes expenses, detects financial outliers/anomalies deterministically in code, and provides conversational financial consultation via local streaming LLM inference.

---

## 🚀 QVAC Capabilities & Models Used

All AI inference runs locally on the user's device via `@qvac/sdk`:

| Capability | Engine / Model | Hardware Footprint | Purpose |
|---|---|---|---|
| **OCR (Optical Character Recognition)** | `OCR_LATIN` (ONNX Runtime) | ~100 MB RAM | Text extraction from paper & digital receipts |
| **Voice Transcription (ASR)** | `WHISPER_TINY` (whisper.cpp) | ~150 MB RAM | Spanish voice note transcription |
| **Categorization & Consultation** | `LLAMA_3_2_1B_INST_Q4_0` (llama.cpp) | ~800 MB RAM | Delimited tag parsing and streaming financial insights |

**Total In-Memory AI Footprint:** ~1.05 GB RAM (fits comfortably on standard consumer laptops).

---

## 🔍 Direct Permalinks to QVAC Inference Code

As required by the track guidelines, here are the direct entrypoints where QVAC inference executes:

1. **OCR Pipeline (`OCR_LATIN`)**:  
   👉 [`src/lib/qvac/ocr-pipeline.ts`](file:///c:/Users/feder/OneDrive/Desktop/Aleph/src/lib/qvac/ocr-pipeline.ts#L40-L55)  
   *Uses `loadModel` with `OCR_LATIN` and `ocr()` function.*

2. **Transcription Pipeline (`WHISPER_TINY`)**:  
   👉 [`src/lib/qvac/transcription-pipeline.ts`](file:///c:/Users/feder/OneDrive/Desktop/Aleph/src/lib/qvac/transcription-pipeline.ts#L43-L57)  
   *Uses `loadModel` with `WHISPER_TINY` and `transcribe()` function.*

3. **LLM Categorization & Natural Language Chat (`LLAMA_3_2_1B_INST_Q4_0`)**:  
   👉 [`src/lib/qvac/llm-pipeline.ts`](file:///c:/Users/feder/OneDrive/Desktop/Aleph/src/lib/qvac/llm-pipeline.ts#L42-L130)  
   *Uses `loadModel` with `LLAMA_3_2_1B_INST_Q4_0` and `completion()` with streaming token iterator and delimited parsing.*

4. **Deterministic Anomaly Detection**:  
   👉 [`src/lib/anomaly.ts`](file:///c:/Users/feder/OneDrive/Desktop/Aleph/src/lib/anomaly.ts#L8-L48)  
   *Calculates statistical outliers (2x category average) in code, avoiding LLM hallucinations.*

---

## 💻 Clean Clone Setup & Running Locally

### Prerequisites
- **Node.js**: `>= v22.17.0`
- **npm**: `>= v10.9.0`

### 1. Clone repository
```bash
git clone https://github.com/Auca17/Aleph.git
cd Aleph
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Supabase (Optional)
If using Supabase cloud persistence, add your credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
Execute the SQL schema in [`supabase_schema.sql`](file:///c:/Users/feder/OneDrive/Desktop/Aleph/supabase_schema.sql) in the Supabase SQL Editor.  
*Note: If no env vars are set, Aleph works automatically with an in-memory fallback store.*

### 4. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

*(Optional)* To preload QVAC models ahead of recording a demo video, click the **"Preload Demo"** button on the UI header or call `GET /api/warmup`.

---

## 📊 Data Contract

```json
{
  "monto": 4500.00,
  "categoria": "Alimentación",
  "fecha": "2026-08-22T14:00:00.000Z",
  "fuente": "voz",
  "flag_anomalia": false
}
```

---

## 🛡️ License

MIT License — Open Source
