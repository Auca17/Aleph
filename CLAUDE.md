# CLAUDE.md — Contexto base del proyecto (hackathon QVAC, agosto 2026)

Este archivo es el punto de partida obligatorio para cualquier asistente de IA (Claude Code u otro) trabajando en este repo, en cualquier branch. Leerlo completo antes de tocar código.

## Qué estamos construyendo

Track: **QVAC (Tether) — Track 1, Local agents for operations work.**

Idea: app de gastos personales para alguien que hoy no lleva ninguna contabilidad (freelancer, monotributista). El usuario carga gastos por **voz o foto de ticket**; el agente los categoriza automáticamente y guarda el registro. Después, el usuario puede **preguntarle** en lenguaje natural ("¿qué gasté esta semana?", "¿por qué se disparó tal categoría?") y el agente responde con un resumen y marca anomalías/outliers.

Equipo: 4 personas. 2 frontend, 2 generalistas (Auk lidera, hace el pipeline de IA y el pitch).

## Reglas duras del track (NO NEGOCIABLES)

Rompemos cualquiera de estas y el proyecto se descarta directamente en la revisión:

- [ ] Toda la inferencia de IA corre local vía `@qvac/sdk` (o el servidor HTTP compatible con OpenAI de QVAC apuntado a localhost). **Cero llamadas a APIs de IA en la nube** (nada de OpenAI, Gemini, Claude API, etc. para inferencia del producto).
- [ ] La integración con QVAC tiene que ser código nuevo, escrito este fin de semana. No vale reciclar una integración QVAC de otro proyecto.
- [ ] No "pegar" QVAC en paralelo a una capa de IA cloud ya existente solo para calificar — QVAC tiene que hacer el trabajo real.
- [ ] No usar VisionPsy (no soportado todavía por el SDK) — usar las capacidades de multimodal/OCR del SDK en su lugar.
- [ ] No apoyarse en generación de imagen/video de QVAC — no suma puntos en este track y resta tiempo.
- [ ] Modelo: presupuestar RAM real. Un modelo de 4B en Q4 usa ~4GB — es el techo práctico en una laptop normal. Si el equipo tiene menos RAM, bajar a un modelo más chico.

## Requisitos de la entrega (obligatorios, sin excepción)

- [ ] Repo público en GitHub con licencia open source.
- [ ] README explicando qué construimos y qué capacidades/modelos de QVAC usamos.
- [ ] **Permalinks directos** a los archivos/líneas exactas donde corre la inferencia QVAC — es lo primero que miran los jueces.
- [ ] Video demo grabado mostrándolo corriendo local, de punta a punta.
- [ ] Detalle de modelo y hardware: qué modelo, qué cuantización, en qué máquina corrió, latencia aproximada.
- [ ] Instrucciones de setup que funcionen desde un clone limpio (`git clone` → correr, sin pasos ocultos).

## Higiene con asistentes de IA (esto es literal del brief del track)

Los jueces descartan sin más revisión: métodos de SDK alucinados, código muerto, un README que describe funcionalidad que no existe, o un demo que solo funciona con un input elegido a mano. Por eso:

- Ningún asistente de IA debe inventar métodos de `@qvac/sdk` que no existen — si no está en la doc, no existe. Doc: https://docs.qvac.tether.io/
- Probar SIEMPRE con inputs que no elegiste vos a mano (foto real mal sacada, audio real con ruido) antes de dar algo por terminado.
- Mantener la integración QVAC corta y legible — no hace falta un wrapper gigante, son pocas líneas bien puestas.
- Cualquier código generado por IA se corre y se verifica antes de mergear, sin excepción.

## Stack

- **Frontend:** Next.js + Tailwind
- **IA local:** `@qvac/sdk` (JS/TS) — text generation, OCR/multimodal, transcripción
- **Datos:** Supabase (solo persistencia — no toca la regla de inferencia local)
- **Corre todo local** (`npm run dev`) para desarrollo y para el demo grabado. No se hostea en Vercel para la parte de IA.

## Contrato de datos (no romper sin avisar al equipo)

```json
{
  "monto": 0,
  "categoria": "string",
  "fecha": "ISO-8601",
  "fuente": "voz | foto",
  "flag_anomalia": false
}
```

## Branches y merge

- `main` — protegida, solo se mergea código que corre.
- `feature/frontend-captura` — pantallas de carga (voz/foto) y lista de gastos.
- `feature/ai-pipeline` — OCR, transcripción, categorización, detección de anomalías (Auk).
- `feature/api-datos` — rutas API + schema Supabase + endpoint de consulta.
- Mergear seguido, en partes chicas — no dejar todo para el final. Conflictos los resuelve Auk.

## Links de referencia

- Docs QVAC: https://docs.qvac.tether.io/
- Requisitos de sistema: https://docs.qvac.tether.io/system-requirements/
- Modelos (Hugging Face): https://huggingface.co/qvac
- OCR: https://docs.qvac.tether.io/ai-capabilities/ocr/
- Multimodal: https://docs.qvac.tether.io/ai-capabilities/multimodal/
- Transcripción: https://docs.qvac.tether.io/ai-capabilities/transcription/
- Servidor HTTP compatible OpenAI: https://docs.qvac.tether.io/cli/http-server/
