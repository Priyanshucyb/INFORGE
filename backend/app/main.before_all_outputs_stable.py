from __future__ import annotations

import base64
import io
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    from docx import Document
except Exception:
    Document = None

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

try:
    import pytesseract
    from PIL import Image
except Exception:
    pytesseract = None
    Image = None

load_dotenv()

app = FastAPI(title="INFORGE API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
VISION_MODEL = os.getenv("VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_text_from_bytes(filename: str, data: bytes) -> tuple[str, str, dict[str, Any]]:
    ext = os.path.splitext(filename.lower())[1]
    meta: dict[str, Any] = {"filename": filename, "size_bytes": len(data)}
    if ext in {".txt", ".md", ".csv", ".json"}:
        return data.decode("utf-8", errors="ignore"), "text", meta
    if ext == ".pdf":
        if PdfReader is None:
            raise HTTPException(500, "PDF parser is not installed.")
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        meta["pages"] = len(reader.pages)
        return text, "pdf", meta
    if ext == ".docx":
        if Document is None:
            raise HTTPException(500, "DOCX parser is not installed.")
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        tables = []
        for table in doc.tables:
            for row in table.rows:
                tables.append(" | ".join(cell.text.strip() for cell in row.cells))
        meta["paragraphs"] = len(paragraphs)
        return "\n".join(paragraphs + tables), "docx", meta
    if ext in {".png", ".jpg", ".jpeg", ".webp"}:
        return "", "image", meta
    return data.decode("utf-8", errors="ignore"), "text", meta


def ocr_image(data: bytes) -> tuple[str, str]:
    if pytesseract is None or Image is None:
        return "", "ocr_unavailable"
    try:
        image = Image.open(io.BytesIO(data))
        text = pytesseract.image_to_string(image)
        return text, "tesseract"
    except Exception:
        return "", "ocr_failed"


async def fetch_url(url: str) -> tuple[str, dict[str, Any]]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(400, "Only valid http/https URLs are supported.")
    headers = {"User-Agent": "INFORGE/3.0 (+content-analysis)"}
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        content_type = r.headers.get("content-type", "")
        if "html" in content_type and BeautifulSoup:
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg"]):
                tag.decompose()
            title = soup.title.get_text(" ", strip=True) if soup.title else parsed.netloc
            text = soup.get_text(" ", strip=True)
            return text, {"name": title[:160], "url": str(r.url), "type": "url", "status": "processed"}
        return r.text, {"name": parsed.netloc, "url": str(r.url), "type": "url", "status": "processed"}


def heuristic_analysis(text: str, sources: list[dict[str, Any]], mode: str) -> dict[str, Any]:
    cleaned = clean_text(text)
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
    claims = []
    for s in sentences[:30]:
        claims.append({"id": uid("claim"), "text": s[:700], "status": "known", "confidence": 0.75, "evidence": [x.get("name") for x in sources]})
    if not claims:
        claims = [{"id": uid("claim"), "text": "No machine-readable text was extracted; OCR or another source is required.", "status": "unknown", "confidence": 0.15, "evidence": []}]
    words = re.findall(r"\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})*\b", cleaned)
    entities = list(dict.fromkeys(words))[:40]
    return {
        "project": sources[0].get("name", "INFORGE SOURCE") if sources else "INFORGE SOURCE",
        "mode": mode,
        "sources": sources,
        "stats": {"entities": len(entities), "claims": len(claims), "events": max(1, min(12, len(sentences) // 3 or 1))},
        "entities": [{"name": e, "type": "entity"} for e in entities],
        "claims": claims,
        "known": [c["text"] for c in claims if c["status"] == "known"][:10],
        "unknown": ["Claims requiring additional evidence are surfaced instead of invented."] if not cleaned else [],
        "conflicting": [],
        "timeline": [],
        "communication_plan": [
            {"type": "Executive Summary", "reason": "Concise decision context."},
            {"type": "LinkedIn Post", "reason": "Professional external communication."},
            {"type": "X Thread", "reason": "Sequential short-form explanation."},
            {"type": "Advisory", "reason": "Action-oriented communication."},
            {"type": "Presentation", "reason": "Structured stakeholder briefing."},
            {"type": "Video", "reason": "Narrated visual explanation."},
            {"type": "Infographic", "reason": "Visual summary of facts and relationships."},
        ],
        "passport": {
            "id": uid("passport"), "ai_generated": False,
            "human_review_required": True, "evidence_traceability": True,
            "source_count": len(sources), "last_verified": now(),
        },
        "engine": {"provider": "heuristic-fallback", "verification": "limited"},
    }


SYSTEM_PROMPT = """You are INFORGE, an information intelligence and communication engine.
Do not invent facts. Preserve uncertainty, source attribution, dates, and conflicting evidence.
A confidence score is an evidence-confidence indicator, NOT a probability of truth. Never use 1.0/100% unless the source explicitly warrants certainty; normally keep it below 0.99.
When multiple sources disagree, put the competing claims in conflicting and preserve both source references.
Separate source-backed facts from unknowns and conflicts. Return strict JSON only.
"""


def json_from_model(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


async def llm_json(prompt: str, model: Optional[str] = None) -> dict[str, Any]:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    url = f"{OPENAI_BASE_URL}/chat/completions"
    payload = {
        "model": model or OPENAI_MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
    }
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(url, headers=headers, json=payload)

        if r.status_code >= 400:
            print("\n===== MODEL GATEWAY ERROR =====")
            print("STATUS:", r.status_code)
            print("RESPONSE:", r.text[:5000])
            print("MODEL:", payload.get("model"))
            print("PROMPT LENGTH:", len(prompt))
            print("================================\n")
            r.raise_for_status()

        return json_from_model(r.json()["choices"][0]["message"]["content"])


async def vision_ocr(data: bytes, filename: str) -> tuple[str, str]:
    if not OPENAI_API_KEY:
        return "", "vision_not_configured"

    b64 = base64.b64encode(data).decode("ascii")

    ext = os.path.splitext(filename)[1].lower()
    mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(ext, "image/png")

    payload = {
        "model": VISION_MODEL,
        "temperature": 0,
        "max_tokens": 800,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an OCR extraction service. "
                    "Read the image carefully and extract ALL visible text exactly. "
                    "Do not summarize. Do not invent or correct text."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extract every readable word, number, date, heading, "
                            "currency value and sentence from this image. "
                            "Return ONLY the extracted text."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime};base64,{b64}"
                        },
                    },
                ],
            },
        ],
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )

            if r.status_code >= 400:
                print("VISION ERROR:", r.status_code, r.text[:1000])
                return "", f"vision_http_{r.status_code}"

            response = r.json()
            content = response["choices"][0]["message"]["content"]

            if isinstance(content, list):
                content = " ".join(
                    x.get("text", "")
                    for x in content
                    if isinstance(x, dict)
                )

            return str(content).strip(), "vision"

    except Exception as exc:
        print("VISION EXCEPTION:", repr(exc))
        return "", "vision_failed"


class TransformRequest(BaseModel):
    source_context: str
    output_type: str
    audience: str = "Adaptive"
    tone: str = "Professional"
    language: str = "English"
    detail: str = "Medium"
    objective: str = "Inform"
    style: str = "Clear"
    mode: str = "AUTO"


@app.get("/health")
def health():
    return {"status": "ok", "service": "inforge-api", "version": "3.0.0", "llm_configured": bool(OPENAI_API_KEY), "model": OPENAI_MODEL if OPENAI_API_KEY else None, "timestamp": now()}


@app.post("/api/v1/analyze")
async def analyze(
    files: list[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(default=None),
    url: str = Form(default=""),
    mode: str = Form("AUTO"),
):
    incoming = list(files)
    if file is not None:
        incoming.append(file)
    if not incoming and not url.strip():
        raise HTTPException(400, "Upload at least one source or provide a URL.")

    source_texts: list[str] = []
    sources: list[dict[str, Any]] = []
    ingestion_notes: list[str] = []

    for upload in incoming:
        data = await upload.read()
        name = upload.filename or "uploaded-source"
        text, source_type, meta = extract_text_from_bytes(name, data)
        if source_type == "image" and not text.strip():
            text, method = ocr_image(data)
            if not text.strip():
                text, method = await vision_ocr(data, name)
            meta["ocr"] = method
        text = clean_text(text)
        if text:
            source_texts.append(f"SOURCE: {name}\n{text}")
        else:
            ingestion_notes.append(f"{name}: no machine-readable text extracted")
        sources.append({"id": uid("src"), "name": name, "type": source_type, "status": "processed", **meta})

    if url.strip():
        try:
            text, meta = await fetch_url(url.strip())
            text = clean_text(text)
            if text:
                source_texts.append(f"SOURCE: {meta['name']}\n{text}")
            sources.append({"id": uid("src"), **meta})
        except Exception as exc:
            ingestion_notes.append(f"URL ingestion failed: {exc}")

    combined = "\n\n--- SOURCE BOUNDARY ---\n\n".join(source_texts)
    base = heuristic_analysis(combined, sources, mode)
    base["ingestion"] = "accepted"
    base["ingestion_notes"] = ingestion_notes
    base["source_text_preview"] = combined[:1200]

    if OPENAI_API_KEY and combined.strip():
        prompt = f"""Analyze the supplied sources for INFORGE.
MODE: {mode}

{combined[:50000]}

Return JSON with:
- context_summary
- sources (preserve source names)
- entities
- claims: id,text,status(known|unknown|conflicting),confidence,evidence
- known
- unknown
- conflicting: explicitly list competing claims and source names
- timeline: date,event,source
- communication_plan
- contradiction_graph: nodes and edges
- temporal_notes
- content_passport with source_ids, generated_at, model and human_review_required
Do not invent facts. Keep claims traceable to sources."""
        try:
            model_data = await llm_json(prompt)
            base.update(model_data)

            # Normalize model claim references such as C0/C1/C2
            # into human-readable claim text while preserving IDs
            # inside the claims array for traceability.
            claim_map = {}
            for claim in base.get("claims", []):
                if isinstance(claim, dict):
                    claim_id = claim.get("id") or claim.get("claim_id")
                    if claim_id:
                        claim_map[str(claim_id)] = claim

            def resolve_claim_item(item):
                # Models may return claim references as:
                # "C1", "1", or numeric values such as 1.
                if isinstance(item, (str, int, float)):
                    key = str(item)

                    if key in claim_map:
                        return claim_map[key].get("text", item)

                    # Support C-prefixed references such as C1 -> 1
                    if isinstance(item, str) and item.startswith("C"):
                        numeric_key = item[1:]
                        if numeric_key in claim_map:
                            return claim_map[numeric_key].get("text", item)

                return item

            if isinstance(base.get("known"), list):
                base["known"] = [resolve_claim_item(x) for x in base["known"]]

            if isinstance(base.get("unknown"), list):
                base["unknown"] = [resolve_claim_item(x) for x in base["unknown"]]

            if isinstance(base.get("conflicting"), list):
                normalized_conflicts = []
                for item in base["conflicting"]:
                    if isinstance(item, str) and item in claim_map:
                        claim = claim_map[item]
                        normalized_conflicts.append({
                            "claim_id": item,
                            "text": claim.get("text", item),
                            "source": ", ".join(map(str, claim.get("evidence", []))) or "Source evidence"
                        })
                    else:
                        normalized_conflicts.append(item)
                base["conflicting"] = normalized_conflicts

            base["engine"] = {"provider": "openai-compatible", "model": OPENAI_MODEL, "verification": "model-assisted"}
            base["passport"]["ai_generated"] = True
            base["passport"]["model"] = OPENAI_MODEL
            base["passport"]["generated_at"] = now()
        except Exception as exc:
            base["engine"]["llm_error"] = str(exc)

    return base


@app.post("/api/v1/transform")
async def transform(req: TransformRequest):
    if not req.source_context.strip():
        raise HTTPException(400, "source_context is required")
    if not OPENAI_API_KEY:
        return {"id": uid("output"), "output_type": req.output_type, "status": "configuration_required", "message": "Configure OPENAI_API_KEY to generate this output with the model gateway.", "controls": req.model_dump(), "content": "", "passport": {"human_review_required": True, "ai_generated": False}}
    format_rules = {
    "LINKEDIN": """
Create a COMPLETE, COPY-PASTE-READY LinkedIn post that looks and reads like a genuinely written professional LinkedIn post.

LENGTH:
- Target approximately 350-500 words when the source contains enough information.
- Do not artificially shorten the post.
- Do not repeat facts merely to increase length.

OPENING:
- Start with a strong, thought-provoking FACTUAL hook.
- The first 1-2 sentences should make the reader want to continue.
- Do not begin with "On [date]..." unless the date itself is the central subject.
- The hook must be supported by the supplied information.
- Never use fake excitement, sensationalism or marketing language.

VISUAL / LINKEDIN STYLE:
- Use generous paragraph spacing.
- Use short paragraphs, normally 1-3 sentences.
- Use Unicode emojis sparingly and purposefully:
  ☀️ for energy/technology
  📌 for important details
  ⚠️ for unresolved items
  💰 for financial discrepancies
  📅 for dates/timeline
  🔎 for verification/evidence
- Use readable bullet points with "•".
- Important numbers and dates may be emphasized using plain text structure.
- DO NOT use Markdown syntax.
- NEVER output "**", "__", "#", "##", backticks, Markdown tables or Markdown links.
- Do not use labels such as "Hook:", "Content:", "LinkedIn Post:", "Structured Output:" or "JSON:".
- The generated text must look clean if directly pasted into LinkedIn.

STORY STRUCTURE:
1. Strong factual opening hook.
2. Short context paragraph.
3. A visually separated section explaining the confirmed core information.
4. Important numbers, dates and milestones using bullets.
5. A separate unresolved-items section.
6. A separate conflict/discrepancy section when conflicting evidence exists.
7. Explain why the information matters ONLY using implications directly supported by the source material.
8. End with a concise factual takeaway.
9. Add 4-6 relevant hashtags.

MAKE IT FEEL HUMAN:
- Vary sentence length.
- Avoid repetitive "The source states..." language.
- Avoid sounding like an executive report.
- Do not compress many facts into one long sentence.
- Use natural transitions.
- Prefer clear, confident writing while preserving uncertainty.
- The reader should be able to scan the post quickly.

TRUST / EVIDENCE RULES:
- Use ONLY source-backed information.
- Preserve the exact certainty level of the source.
- Clearly distinguish confirmed, reported, estimated, planned, unresolved and conflicting information.
- When two sources disagree, show both figures and identify the source associated with each figure.
- Never choose a disputed figure as the correct one unless the source evidence establishes that.
- Never invent outcomes, achievements, benefits, risks, causes or recommendations.
- Do not turn a scheduled event into a completed event.
- Do not turn an estimate into a confirmed amount.
- Do not claim that something "will improve", "will increase", "will reduce", "will impact" or "will lead to" something unless that relationship is explicitly supported.
- Do not use words such as "exciting", "revolutionary", "successful", "major", "strong", "promising", "transformative" or "game-changing" unless the source itself explicitly supports that characterization.

INFORGE-SPECIFIC COMMUNICATION:
Where appropriate, naturally surface the distinction between:
- What is known
- What remains unknown
- What conflicts between sources

Do this as part of the story, not as a generic AI-analysis template.

FINAL QUALITY CHECK:
Before returning the post:
- Remove all Markdown formatting.
- Remove internal claim IDs such as C1, C2, C3.
- Remove duplicate facts.
- Ensure paragraphs are visually separated.
- Ensure bullets are readable.
- Ensure hashtags are at the end.
- Ensure the final result can be copied directly into LinkedIn without cleanup.

The result must feel like a polished, human-written LinkedIn post — not an AI-generated report or compressed executive summary.
""",

    "X / THREAD": """
Create a complete X/Twitter thread.
- 6-8 posts.
- Each post should normally stay within approximately 280 characters.
- Number them naturally as 1/7, 2/7, etc.
- Strong factual opening.
- One clear idea per post.
- Include important numbers, dates, uncertainties and conflicts.
- Final post should contain the factual takeaway.
- No unsupported hype.
""",

    "ADVISORY": """
Create a detailed professional advisory of approximately 400-600 words.

Use a clear structure:
- Situation
- Confirmed information
- Key dates/numbers
- Unresolved items
- Conflicting information
- Risks or implications supported by the sources
- Recommended verification/action points
- Closing status

Do not invent recommendations that require facts not present in the source.
""",

    "EXECUTIVE SUMMARY": """
Create a detailed executive summary of approximately 350-500 words.

Use:
- Executive overview
- Key facts
- Important numbers
- Timeline
- Unresolved items
- Conflicting information
- Decision considerations
- Final factual takeaway

Keep it concise but substantial. Do not turn it into a one-paragraph summary.
""",

    "PRESENTATION": """
Create a professional 7-9 slide presentation outline.

For every slide provide:
- Slide title
- 3-6 concise bullets
- Speaker notes

Use a logical story:
context → key facts → evidence → timeline → unresolved issues → conflicts → implications → next steps.

Do not invent facts.
""",

    "VIDEO": """
Create a detailed 8-10 scene video script.

For every scene provide:
- Scene number
- Approximate duration
- Visual direction
- Narration
- On-screen text/subtitles

The narration should feel natural when spoken aloud.
Preserve uncertainty and conflicting information.
Do not add unsupported dramatic claims.
""",

    "INFOGRAPHIC": """
Create a detailed infographic content specification.

Include:
- Main headline
- Short factual subheadline
- 5-8 visual sections
- Key numbers
- Important dates
- Confirmed facts
- Unknown/unresolved items
- Conflicting information
- Practical takeaway
- Source/trust note

Make it visually scannable and information-dense without inventing facts.
"""
}

    prompt = f"""Transform verified information into a directly usable {req.output_type}.
    Audience: {req.audience}; Language: {req.language}; Tone: {req.tone}; Objective: {req.objective}; Detail: {req.detail}; Mode: {req.mode}.

    OUTPUT-SPECIFIC FORMAT REQUIREMENTS:
    {format_rules.get(req.output_type, "")}

    Use only source-backed information. Preserve uncertainty and conflicts. Never invent facts.
    Do not add unsupported praise, excitement, urgency, certainty, causality, sentiment, marketing language, or subjective framing. Do not describe progress as "exciting", "successful", "promising", "major", "strong", or similar unless the supplied sources explicitly support that characterization.
    When the source only states that something is planned, scheduled, estimated, reported, disputed, unknown, or unresolved, preserve that exact level of certainty in the output.
    For Presentation return slides + speaker notes. For Video return scenes, narration, subtitles and visual recommendations. For Infographic return headline, sections and data points. For X use a thread if necessary.
    IMPORTANT: Internal claim IDs such as C0, C1, C2, C3 or [C1] are for internal traceability only. NEVER expose these IDs in user-facing content, headings, bullets, posts, slides, scripts, or structured_output. Use the actual human-readable claim text or source description instead.
    Return JSON with title, content, structured_output, used_claims, warnings, affected_claims.
    SOURCE CONTEXT:
    {req.source_context[:40000]}"""
    try:
        result = await llm_json(prompt)

        # Remove internal claim references from user-facing generated content.
        # Claim IDs remain available in used_claims / passport for traceability.
        def clean_claim_refs(value):
            if isinstance(value, str):
                text = value

                # Remove internal claim references.
                text = re.sub(r"\\s*\\[?C\\d+\\]?\\s*", " ", text)

                # Remove Markdown formatting so content is clean when
                # displayed and copied directly to a platform.
                text = re.sub(r"\\*\\*(.*?)\\*\\*", r"\\1", text)
                text = re.sub(r"__(.*?)__", r"\\1", text)
                # Remove single-asterisk emphasis safely.
                # Avoid variable-length look-behind because Python rejects it.
                text = re.sub(r"\\*([^*\\n]+)\\*", r"\\1", text)
                text = re.sub(r"`([^`]*)`", r"\\1", text)

                # Remove common generation labels if the model adds them.
                text = re.sub(
                    r"(?im)^\\s*(Hook|Content|LinkedIn Post|Structured Output|JSON)\\s*:\\s*",
                    "",
                    text
                )

                # Normalize excessive whitespace while preserving paragraph breaks.
                text = re.sub(r"[ \\t]+", " ", text)
                text = re.sub(r"\\n{3,}", "\\n\\n", text)

                return text.strip()

            if isinstance(value, list):
                return [clean_claim_refs(x) for x in value]

            if isinstance(value, dict):
                return {k: clean_claim_refs(v) for k, v in value.items()}

            return value

        if "content" in result:
            result["content"] = clean_claim_refs(result["content"])

        if "structured_output" in result:
            result["structured_output"] = clean_claim_refs(result["structured_output"])

        return {
            "id": uid("output"),
            "output_type": req.output_type,
            "status": "generated",
            "model": OPENAI_MODEL,
            "controls": req.model_dump(),
            **result,
            "passport": {
                "human_review_required": True,
                "ai_generated": True,
                "generated_at": now(),
                "model": OPENAI_MODEL
            }
        }
    except Exception as exc:
        raise HTTPException(502, f"Model gateway error: {exc}")


@app.post("/api/v1/compare")
async def compare(old_text: str = Form(...), new_text: str = Form(...)):
    if not OPENAI_API_KEY:
        return {"status": "configuration_required", "changes": [], "message": "Configure OPENAI_API_KEY for semantic change detection."}
    prompt = f"""Compare OLD and NEW information. Return JSON with changed_claims, added_claims, removed_claims, conflicts, affected_outputs and summary. Preserve exact old/new values and dates. Do not invent.
OLD:\n{old_text[:25000]}\n\nNEW:\n{new_text[:25000]}"""
    try:
        return await llm_json(prompt)
    except Exception as exc:
        raise HTTPException(502, f"Comparison error: {exc}")
