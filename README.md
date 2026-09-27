# INFORGE

## AI Information Intelligence & Communication Engine

**INFORMATION → INTELLIGENCE → ACTION**

INFORGE is not just a text generator. It ingests information, structures the underlying claims and context, surfaces uncertainty/conflicts, creates a communication plan, and transforms the same verified context into audience- and channel-specific outputs.

### Existing experience preserved
The cinematic INFORGE landing page, dark intelligence-lab visual identity, About page, Team placeholders, Engine page, and core narrative are retained. This upgrade adds working intelligence and transformation capabilities instead of replacing the UI.

## Working capabilities

### Input
- TXT / Markdown / CSV / JSON
- PDF
- DOCX
- Images (ready for vision/OCR adapter)
- URL adapter can be added without changing the transformation contract

### Intelligence
- Source ingestion
- Entity extraction
- Claim extraction
- Evidence references
- Known / Unknown / Conflicting
- Timeline field
- Communication Decision Engine
- Content Passport
- Human-review flag
- Model gateway

### Transformation outputs
- LinkedIn
- X / Thread
- Advisory
- Executive Summary
- Presentation + speaker notes
- Video script / storyboard / subtitles / visual recommendations
- Infographic brief

### Trust and change layer
- Source traceability
- AI transformation metadata
- Human review
- Semantic comparison endpoint
- Version/change detection contract

## Run locally

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add OPENAI_API_KEY to .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Backend health: `http://localhost:8000/health`

## Model gateway

The backend uses an OpenAI-compatible `/chat/completions` gateway. Configure:

```env
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

The gateway abstraction allows another OpenAI-compatible provider/model to be used later without changing the frontend transformation contract.

Without an API key, ingestion and deterministic analysis still work, but AI generation intentionally returns `configuration_required` rather than pretending that a model generated the content.

## API

- `GET /health`
- `POST /api/v1/analyze`
- `POST /api/v1/transform`
- `POST /api/v1/compare`

## Architecture direction

```text
INPUT
  ↓
INGEST / PARSE / OCR
  ↓
UNDERSTAND
  ↓
CLAIMS + ENTITIES + EVENTS
  ↓
EVIDENCE / CONFLICT / UNCERTAINTY
  ↓
LIVING INFORMATION CONTEXT
  ↓
COMMUNICATION DECISION ENGINE
  ↓
TRANSFORMATION
  ↓
VALIDATION / SEMANTIC DRIFT
  ↓
CONTENT PASSPORT
  ↓
HUMAN REVIEW
  ↓
PUBLISH / VERSION / CHANGE DETECTION
```

The current implementation establishes the real API contracts and model gateway. Production adapters such as OCR/ASR, persistent Postgres/pgvector storage, background workers, URL retrieval, and external publishing can be plugged into the same contracts.
"# INFORGE" 
