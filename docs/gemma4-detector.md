# Exfira — Gemma 4 as PII Detector

## Context

The MVP pipeline uses **Microsoft Presidio** (backed by spaCy `en_core_web_lg` + regex patterns) as the PII detection layer. Presidio is reliable for the entity types it was built for, but it misses context-dependent PII — things like custom identifiers, job titles that double as identifiers, or sensitive free-text that isn't a named entity.

This document describes how we replace the Presidio Analyzer + spaCy stack with **Gemma 4** running locally via Ollama, while keeping the rest of the MVP pipeline (vault, LLM call, rehydration) completely unchanged.

---

## What Changes, What Stays

```
Browser  (Next.js Chat UI)
    │
    ▼
Vercel  —  Next.js API Layer
    │
    ▼
Hetzner  —  FastAPI

    ├── 1. PII Detection   ← REPLACED
    │       BEFORE: Presidio Analyzer + spaCy en_core_web_lg
    │       AFTER:  Gemma 4 (via Ollama, local inference)
    │
    ├── 2. Anonymization   ← unchanged (but simpler — see below)
    │       Token replacement using spans returned by Gemma 4
    │       Builds in-memory vault
    │
    ├── 3. LiteLLM         ← unchanged
    │       Sends redacted prompt to GPT-4o-mini
    │
    └── 4. Rehydration     ← unchanged
            str.replace() from vault
```

Steps 2, 3, and 4 do not change. The only swap is in Step 1.

---

## Why Gemma 4

| Reason | Detail |
|---|---|
| Context-aware detection | A language model understands that "call me at the number above" refers to a phone number even without regex |
| Flexible entity coverage | Gemma 4 can detect entity types we define in the prompt, not just Presidio's built-in list |
| No NER training required | Detection is prompt-driven — adding a new entity type means editing a string, not retraining a model |
| Local inference | Runs on the Hetzner server via Ollama — no external API call for detection, no PII ever leaves the machine at detection time |
| Removes the spaCy dependency | Eliminates the 1.5 GB `en_core_web_lg` model load and its startup time |

The tradeoff is latency. Gemma 4 inference on CPU is slower than spaCy (~200–800ms vs ~50–200ms for typical messages). On a machine with a GPU this gap closes significantly. At MVP volumes this is acceptable.

---

## Detection Prompt Design

Gemma 4 is given a structured prompt that asks it to return a JSON array of detected entities. The model acts as a pure extractor — it does not rephrase, summarise, or answer the user.

### System prompt (sent once)

```
You are a PII detection engine. Your only job is to find personally identifiable information in text.

Given a piece of text, return a JSON array of all PII spans found. Each object must have:
  - "text":        the exact substring as it appears in the input
  - "entity_type": one of PERSON, EMAIL_ADDRESS, PHONE_NUMBER, CREDIT_CARD,
                   IBAN_CODE, US_BANK_NUMBER, US_SSN, US_PASSPORT,
                   US_DRIVER_LICENSE, UK_NHS, IP_ADDRESS, URL,
                   LOCATION, NRP, MEDICAL_LICENSE, DATE_OF_BIRTH,
                   FINANCIAL_ACCOUNT, CUSTOM_ID

Return only valid JSON. No explanation. No markdown. If no PII is found, return [].
```

### User message (per request)

```
Text: """<user's raw message>"""
```

### Expected Gemma 4 output

```json
[
  { "text": "John Doe",        "entity_type": "PERSON" },
  { "text": "john@acme.com",   "entity_type": "EMAIL_ADDRESS" },
  { "text": "07911 123456",    "entity_type": "PHONE_NUMBER" }
]
```

---

## New `GemmaDetector` class

The `Redactor` class in `redactor.py` is split into two responsibilities:

- **`GemmaDetector`** — calls Ollama, parses the JSON response, returns a list of `(text, entity_type)` tuples
- **`Redactor`** — unchanged tokenization logic; takes detected spans and builds the vault

```python
# detector.py  (new file)

import json
import httpx
import logging

logger = logging.getLogger("exfira")

OLLAMA_URL = "http://localhost:11434/api/chat"
GEMMA_MODEL = "gemma4"  # model tag as installed in Ollama

SYSTEM_PROMPT = """You are a PII detection engine. Your only job is to find personally
identifiable information in text.

Given a piece of text, return a JSON array of all PII spans found. Each object must have:
  - "text":        the exact substring as it appears in the input
  - "entity_type": one of PERSON, EMAIL_ADDRESS, PHONE_NUMBER, CREDIT_CARD,
                   IBAN_CODE, US_BANK_NUMBER, US_SSN, US_PASSPORT,
                   US_DRIVER_LICENSE, UK_NHS, IP_ADDRESS, URL,
                   LOCATION, NRP, MEDICAL_LICENSE, DATE_OF_BIRTH,
                   FINANCIAL_ACCOUNT, CUSTOM_ID

Return only valid JSON. No explanation. No markdown. If no PII is found, return []."""


class GemmaDetector:
    def __init__(self, model: str = GEMMA_MODEL, ollama_url: str = OLLAMA_URL):
        self._model = model
        self._url = ollama_url

    async def detect(self, text: str) -> list[dict]:
        """
        Returns a list of {"text": ..., "entity_type": ...} dicts.
        """
        payload = {
            "model": self._model,
            "stream": False,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f'Text: """{text}"""'},
            ],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self._url, json=payload)
            resp.raise_for_status()

        raw = resp.json()["message"]["content"].strip()

        try:
            entities = json.loads(raw)
            if not isinstance(entities, list):
                raise ValueError("expected a JSON array")
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("Gemma 4 returned unparseable output: %s | raw=%s", e, raw[:200])
            return []

        return entities
```

---

## Updated `Redactor` class

`redactor.py` stops importing Presidio. Instead it receives pre-detected spans.

```python
# redactor.py  (updated)

class Redactor:
    def redact(
        self,
        text: str,
        detected: list[dict],   # output from GemmaDetector.detect()
    ) -> tuple[str, dict]:
        """
        Given raw text and Gemma 4's detected entities, build the vault
        and return the redacted string.
        """
        if not detected:
            return text, {}

        vault: dict[str, tuple[str, str, str]] = {}
        counters: dict[str, int] = {}
        value_to_token: dict[str, str] = {}

        for item in detected:
            original = item["text"]
            entity_type = item["entity_type"]

            if original in value_to_token:
                continue

            count = counters.get(entity_type, 0)
            token = f"<{entity_type}>" if count == 0 else f"<{entity_type}_{count}>"
            counters[entity_type] = count + 1

            value_to_token[original] = token
            vault[token] = (token, original, entity_type)

        redacted = text
        # Replace longest matches first to avoid partial overlaps
        for original, token in sorted(value_to_token.items(), key=lambda x: -len(x[0])):
            redacted = redacted.replace(original, token)

        return redacted, vault

    def rehydrate(self, text: str, vault: dict) -> str:
        for token, (_, original, _) in vault.items():
            text = text.replace(token, original)
        return text
```

---

## Updated request flow in `main.py`

```python
# Step 1 — Detect (Gemma 4)
t1 = time.perf_counter()
detected = await detector.detect(original_text)
detection_ms = (time.perf_counter() - t1) * 1000

# Step 2 — Anonymize (unchanged logic)
redacted_text, vault = redactor.redact(original_text, detected)
```

`detector` is a `GemmaDetector` instance created at startup alongside `redactor`.

---

## Ollama Setup on Hetzner

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull Gemma 4 (choose the variant that fits RAM)
ollama pull gemma4         # full model
ollama pull gemma4:2b      # if RAM is tight

# Verify
ollama run gemma4 "Return []"
```

Ollama runs as a systemd service on `localhost:11434`. It is not exposed to the internet.

### Memory on CX32 (4 vCPU, 8 GB RAM)

| Component | Before (Presidio) | After (Gemma 4) |
|---|---|---|
| spaCy `en_core_web_lg` | ~1.5 GB | — |
| Presidio Analyzer/Anonymizer | ~300 MB | — |
| Ollama + Gemma 4 (2B) | — | ~1.5–2 GB |
| Ollama + Gemma 4 (full) | — | ~5–6 GB |
| FastAPI process | ~200 MB | ~200 MB |

The 2B variant is a safe fit. The full model is tight on CX32 but workable if nothing else is running. Upgrade to CX42 (16 GB, $16.90/month) to run the full model comfortably.

---

## Latency Expectations

| Scenario | Detection latency |
|---|---|
| spaCy `en_core_web_lg` (MVP baseline) | 50–200ms |
| Gemma 4 2B on CPU (CX32) | 300–800ms |
| Gemma 4 full on CPU (CX32) | 800–2000ms |
| Gemma 4 full on GPU (A10 or similar) | 50–150ms |

For the short term, the 2B model on CPU is acceptable at low traffic. Detection latency is not user-visible in the same way as LLM latency because it happens before the LLM call, not instead of it — the total request time goes up, not the perceived "thinking" time.

---

## Entity Types Covered

Gemma 4 inherits all MVP entity types and gains a few that Presidio handles poorly:

| Category | Entity Types |
|---|---|
| Personal | PERSON, DATE_OF_BIRTH |
| Contact | EMAIL_ADDRESS, PHONE_NUMBER |
| Financial | CREDIT_CARD, IBAN_CODE, US_BANK_NUMBER, FINANCIAL_ACCOUNT |
| Identity | US_SSN, US_PASSPORT, US_DRIVER_LICENSE, UK_NHS, MEDICAL_LICENSE |
| Network | IP_ADDRESS, URL |
| Location | LOCATION |
| Organisation | NRP |
| Catch-all | CUSTOM_ID (account numbers, reference codes, internal IDs) |

---

## What Is Deliberately Excluded (unchanged from MVP)

- Redis vault — not needed while requests are synchronous
- Multi-turn redaction — only the latest user message is redacted
- Streaming — full response buffered before rehydration
- GPU hosting — optional upgrade, not required to ship

---

## Migration Steps

1. Install Ollama on the Hetzner server and pull `gemma4:2b`
2. Add `httpx` to `requirements.txt` (remove `presidio-analyzer`, `presidio-anonymizer`, `spacy`)
3. Create `detector.py` with `GemmaDetector`
4. Update `redactor.py` — remove Presidio imports, add `detected` parameter to `redact()`
5. Update `main.py` lifespan to instantiate `GemmaDetector`; update the `/redact-and-chat` handler to call `detector.detect()` then `redactor.redact()`
6. Run existing redaction unit tests against the new stack; update fixtures where Gemma 4 catches entities Presidio missed

---

## Rollback

If Gemma 4 produces unacceptable false-positive or false-negative rates before deployment, revert to the Presidio stack by restoring the original `redactor.py` and adding back `presidio-analyzer`, `presidio-anonymizer`, and `spacy` to requirements. Both implementations satisfy the same interface from `main.py`'s perspective.
