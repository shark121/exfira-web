# Exfira — MVP Pipeline

## Overview

The MVP delivers the core value proposition end-to-end: a user types a prompt, PII is automatically detected and stripped before the message reaches any LLM, the model responds using anonymised tokens, and the response is rehydrated with the original values before being shown to the user. The model never sees real personal data at any point.

Everything is kept as simple as possible. No separate services, no Redis, no GPU, no custom models. One FastAPI app on one server doing all the work.

---

## Architecture Diagram

```
Browser  (Next.js Chat UI)
    │
    │ HTTPS
    ▼
Vercel  —  Next.js API Layer
    │  auth check, rate limit, forward to Python
    │
    │ Internal HTTP
    ▼
Hetzner CX32  —  FastAPI  (single Python service)
    │
    ├── 1. Presidio Analyzer
    │       spaCy en_core_web_lg  +  regex patterns
    │       Detects: names, orgs, emails, phones,
    │                credit cards, SSNs, IPs
    │
    ├── 2. Presidio Anonymizer
    │       Replaces PII with tokens
    │       Builds in-memory redaction dict
    │       { "<PERSON>": "John Doe",
    │         "<EMAIL_ADDRESS_1>": "john@acme.com" }
    │
    ├── 3. LiteLLM  (Python library, not a service)
    │       Sends redacted prompt to GPT-4o-mini
    │       LLM never sees real PII
    │
    └── 4. Rehydration
            Simple string replace from in-memory dict
            "<PERSON>" → "John Doe"
            Dict is discarded when request ends
    │
    │ Rehydrated response
    ▼
Vercel  →  Browser
```

---

## Request Lifecycle

```
User types:     "My name is John Doe, email john@acme.com. Summarise my account."

Step 1 — Detection
  Presidio finds:
    PERSON         →  "John Doe"
    EMAIL_ADDRESS  →  "john@acme.com"

Step 2 — Anonymisation
  Redacted prompt:  "My name is <PERSON>, email <EMAIL_ADDRESS_1>. Summarise my account."
  Vault (in-memory dict):
    {
      "<PERSON>":          "John Doe",
      "<EMAIL_ADDRESS_1>": "john@acme.com"
    }

Step 3 — LLM Call
  GPT-4o-mini receives:
    "My name is <PERSON>, email <EMAIL_ADDRESS_1>. Summarise my account."
  GPT-4o-mini responds:
    "Hello <PERSON>! I can see your account is linked to <EMAIL_ADDRESS_1>..."

Step 4 — Rehydration
  Response after replace:
    "Hello John Doe! I can see your account is linked to john@acme.com..."

Step 5 — Delivered to user
  User sees the full, natural response.
  The vault dict is discarded. Nothing is persisted.
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind | App Router, chat UI |
| Auth | NextAuth.js v5 | Email + password, JWT sessions |
| Database | Supabase free tier (PostgreSQL) | Users, workspaces, chat history |
| PII Detection | Microsoft Presidio | Analyzer + Anonymizer |
| NER Model | spaCy `en_core_web_lg` | Loaded at service startup |
| Regex Patterns | Presidio built-ins | Email, phone, SSN, card, IP |
| Redaction Vault | Python `dict` (in-memory) | Lives for the duration of one request only |
| Rehydration | Python `str.replace()` | Iterates over vault dict |
| LLM Library | LiteLLM (Python library) | Not a separate proxy service |
| LLM Provider | OpenAI GPT-4o-mini | Single model at MVP |
| Python Service | FastAPI | Single service, single endpoint |
| Hosting — Web | Vercel (free or Pro $20/month) | Next.js |
| Hosting — Python | Hetzner CX32 ($7.59/month) | FastAPI + Presidio + spaCy |

---

## Infrastructure

### Vercel
Hosts the Next.js application. Handles HTTPS, CDN, and deployments. Free tier is sufficient at MVP. Upgrade to Pro ($20/month) when you need team access or custom domains with SSL.

### Hetzner CX32 — $7.59/month
Runs the entire Python pipeline. Specs: 4 vCPU, 8GB RAM, 80GB SSD.

Memory usage breakdown:
- spaCy `en_core_web_lg` model: ~1.5GB
- Presidio Analyzer + Anonymizer: ~300MB
- FastAPI process overhead: ~200MB
- Headroom: ~6GB remaining

The spaCy model is loaded once at startup. Per-request inference is fast (~50–200ms for typical chat messages).

### No Redis
The redaction vault is a plain Python dictionary scoped to each request. Because the request is synchronous — detect, anonymise, call LLM, rehydrate, return — the dict never needs to outlive the HTTP request. This eliminates an entire service dependency at MVP.

### No GPU
spaCy `en_core_web_lg` uses a statistical model (not a transformer). It runs efficiently on CPU. This is the deliberate choice for MVP — the transformer model (`en_core_web_trf`) is more accurate but needs significantly more RAM and is slower on CPU. The large model is accurate enough for the common PII entity types.

---

## API Endpoint

**`POST /redact-and-chat`** — the single FastAPI endpoint powering the chat.

Request body:
```json
{
  "messages": [
    { "role": "user", "content": "My name is John Doe..." }
  ],
  "workspace_id": "abc123"
}
```

Response:
```json
{
  "response": "Hello John Doe! I can see your account...",
  "redactions": [
    { "entity_type": "PERSON", "original": "John Doe" },
    { "entity_type": "EMAIL_ADDRESS", "original": "john@acme.com" }
  ]
}
```

The `redactions` array is returned to the frontend so the UI can show the user what was protected. The original values are shown only to the user who submitted them — never logged.

---

## PII Entity Types Covered at MVP

| Category | Entity Types |
|---|---|
| Personal | PERSON (names) |
| Contact | EMAIL_ADDRESS, PHONE_NUMBER |
| Financial | CREDIT_CARD, IBAN_CODE, US_BANK_NUMBER |
| Identity | US_SSN, US_PASSPORT, US_DRIVER_LICENSE, UK_NHS |
| Network | IP_ADDRESS, URL |
| Location | LOCATION (via spaCy NER) |
| Organisation | NRP (nationality, religion, political group) |

---

## What Is Deliberately Excluded

| Feature | Excluded because |
|---|---|
| GLiNER | Adds RAM + latency. Presidio covers 80% of cases. |
| Ollama / self-hosted NER LLM | Not needed if not running a supplementary LLM call |
| LiteLLM as standalone proxy | Library call inside FastAPI is sufficient |
| Redis vault | In-memory dict is safe for synchronous requests |
| AES-256 vault encryption | Nothing to encrypt — vault dies with the request |
| Multiple LLM providers | GPT-4o-mini only. Model selector is V2. |
| ClickHouse | Python `logging` to stdout for now |
| OpenTelemetry | Sentry error monitoring only |
| Streaming responses | Buffer full response, rehydrate, return. Streaming with mid-stream token rehydration is V2. |
| Custom Presidio recognizers | Built-in recognizers only |
| Conversation memory redaction | Only the latest user message is redacted at MVP |

---

## Cost

| Item | Monthly cost |
|---|---|
| Vercel (free tier) | $0 |
| Hetzner CX32 | $7.59 |
| OpenAI API (GPT-4o-mini) | Pay per use — $0.15/1M input tokens |
| Supabase (free tier) | $0 |
| **Total fixed** | **$7.59/month** |

At 100,000 messages/month averaging 500 tokens each:
- 50M input tokens → ~$7.50 in LLM costs
- Total: ~$15/month to run the full product

---

## Build Phases

### Phase 1 — Chat UI (3–4 days)
Build the Next.js chat interface with mock responses. Get the UI feeling right before touching any backend. Components: message list, input bar, redaction badge, redaction detail panel.

### Phase 2 — FastAPI + Presidio (2–3 days)
Stand up the Hetzner server. Install Presidio, spaCy, and the `en_core_web_lg` model. Build the `/redact-and-chat` endpoint. Write unit tests for redaction and rehydration correctness covering edge cases (PII in different positions, repeated entities, no PII).

### Phase 3 — LLM Integration (1–2 days)
Add LiteLLM to the FastAPI service. Wire up GPT-4o-mini. Test the full loop: real prompt in, real redacted prompt to LLM, real rehydrated response out.

### Phase 4 — Wire Frontend to Backend (1–2 days)
Connect the Next.js API route to the FastAPI service. Render redaction badges in the UI. Show the user what was protected.

### Phase 5 — Auth + Accounts (2–3 days)
Add NextAuth, signup/login pages, email verification. Gate the `/chat` route behind authentication.

**Total estimated time: 9–14 days**

---

## Upgrade Path to V2

The MVP is designed so each component can be upgraded independently without rewriting the others.

- Replace in-memory dict with Redis → enables multi-turn conversation redaction across message history
- Add GLiNER alongside Presidio → improves detection of unusual entity types
- Add Ollama + Llama 3.2 3B → eliminates the need for any external API call in the detection step
- Promote LiteLLM to a standalone proxy → enables model routing, fallbacks, spend tracking
- Add ClickHouse → enables the observability dashboard
