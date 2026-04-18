# Exfira — Long-Term Production Pipeline

## Overview

At full maturity, Exfira operates as a multi-service AI governance platform. Every component of the PII pipeline — detection, anonymisation, token vaulting, and rehydration — runs entirely on self-hosted infrastructure with no external API calls required. The user's data never leaves your servers unredacted at any point. The main LLM response call is the only operation that reaches an external provider, and it only ever receives the anonymised version of the user's prompt.

The architecture is split into discrete services that scale, upgrade, and fail independently. The web layer (Next.js on Vercel) handles auth, billing, and the chat UI. The Python layer on Hetzner handles all intelligence — detection, routing, and rehydration. A GPU server handles the self-hosted LLM option for workspaces that require full data sovereignty.

---

## Architecture Diagram

```
Browser  (Next.js Chat UI)
    │
    │ HTTPS
    ▼
Vercel  —  Next.js API Layer
    │
    │  • JWT auth validation
    │  • Workspace policy lookup (from Supabase)
    │  • Rate limiting per plan
    │  • Billing enforcement (token quota check)
    │  • Audit event emission
    │
    │ Internal HTTP
    ▼
Hetzner CX42  —  FastAPI PII Service
    │
    ├── Layer 1:  Presidio Analyzer
    │     spaCy en_core_web_lg  +  en_core_web_trf (transformer)
    │     50+ built-in entity recognisers
    │     Custom recognisers per industry (medical, financial, legal)
    │     Parallel execution with Layer 2
    │
    ├── Layer 2:  GLiNER medium
    │     Zero-shot NER — detects any entity type by label
    │     Handles novel/domain-specific entities that Presidio misses
    │     Runs in parallel with Layer 1
    │
    ├── Layer 3:  Ollama  (self-hosted, no external API)
    │     Model: Llama 3.2 3B (Q4 quantised, ~2GB RAM)
    │     Prompt: "List all personal names, organisations, and
    │              physical addresses as JSON. Nothing else."
    │     Supplementary pass — catches what layers 1 and 2 miss
    │
    ├── Merge + Deduplicate
    │     Combine detections from all 3 layers
    │     Resolve overlaps by entity type priority
    │
    ├── Presidio Anonymizer
    │     Assigns tokens:  "John Doe" → <PERSON_1>
    │     AES-256 encrypts the vault entries
    │     Writes encrypted vault to Redis with session TTL
    │
    ▼
Redis  (Upstash)  —  Encrypted Token Vault
    │
    │  Session-scoped TTL (expires at end of conversation)
    │  AES-256 encrypted values
    │  Never written to permanent storage
    │  Keys: session_id + token  →  Value: encrypted original
    │
    ▼
Hetzner CX32  —  LiteLLM Proxy  (standalone service)
    │
    │  • Model routing based on workspace policy
    │  • Cost vs capability tradeoff engine
    │  • Prompt injection detection
    │  • Content policy filter (pre-send)
    │  • Per-workspace spend tracking
    │  • Retry logic with exponential backoff
    │  • Fallback chains across providers
    │  • Load balancing across multiple API keys
    │
    ├── Route A:  External LLMs
    │     OpenAI GPT-4o / GPT-4o-mini
    │     Anthropic Claude Sonnet / Haiku
    │     Google Gemini Pro
    │     (Redacted prompt only — real data never leaves)
    │
    └── Route B:  Self-Hosted LLM  (full data sovereignty)
          GPU Server (Vast.ai ~$90/month)
          Ollama  —  Llama 3.1 70B  or  Mistral  or  DeepSeek
          Zero data leaves your infrastructure
    │
    │ LLM response (contains anonymisation tokens)
    ▼
Hetzner CX42  —  FastAPI Response Processor
    │
    ├── Output Content Filter
    │     Policy compliance check on LLM output
    │     Blocks responses that violate workspace rules
    │
    ├── Presidio De-anonymizer
    │     Reads encrypted vault from Redis
    │     Decrypts entries
    │     Replaces <PERSON_1> → "John Doe" etc.
    │
    └── Audit Logger
          Writes event to ClickHouse:
          - timestamp, workspace_id, session_id
          - entity types found (not original values)
          - model used, token counts, latency
          - policy decisions (allow/block)
    │
    │ Rehydrated response
    ▼
Hetzner  —  Observability Stack
    │
    ├── ClickHouse
    │     Append-only columnar event store
    │     Powers the real-time observability dashboard
    │     Stores: latency, token counts, redaction events,
    │             policy violations, cost per workspace
    │     Retention: 24 months
    │
    ├── OpenTelemetry Collector
    │     Distributed trace spans across every service
    │     Next.js → FastAPI → LiteLLM → Provider → Rehydration
    │     Identifies bottlenecks and failures end-to-end
    │
    └── Prometheus + Grafana
          Real-time metrics dashboards
          Alerts on latency spikes, error rates, quota approach
    │
    ▼
Vercel  →  Browser
```

---

## Full Request Lifecycle

```
User types:
  "My name is John Doe, I work at Acme Corp.
   My SSN is 123-45-6789 and card ending 4111.
   What's my account status?"

─────────────────────────────────────────
DETECTION  (all 3 layers run in parallel)
─────────────────────────────────────────

Presidio finds:
  PERSON         →  "John Doe"
  ORGANIZATION   →  "Acme Corp"
  US_SSN         →  "123-45-6789"
  CREDIT_CARD    →  "4111"

GLiNER finds:
  PERSON         →  "John Doe"      (duplicate, discarded)
  COMPANY        →  "Acme Corp"     (duplicate, discarded)

Ollama finds:
  name           →  "John Doe"      (duplicate, discarded)
  organisation   →  "Acme Corp"     (duplicate, discarded)

Merged result (deduplicated):
  PERSON         →  "John Doe"
  ORGANIZATION   →  "Acme Corp"
  US_SSN         →  "123-45-6789"
  CREDIT_CARD    →  "4111"

─────────────────────────────────────────
ANONYMISATION
─────────────────────────────────────────

Redacted prompt:
  "My name is <PERSON_1>, I work at <ORGANIZATION_1>.
   My SSN is <US_SSN_1> and card ending <CREDIT_CARD_1>.
   What's my account status?"

Vault written to Redis (AES-256 encrypted, TTL 1hr):
  {
    "<PERSON_1>":       encrypt("John Doe"),
    "<ORGANIZATION_1>": encrypt("Acme Corp"),
    "<US_SSN_1>":       encrypt("123-45-6789"),
    "<CREDIT_CARD_1>":  encrypt("4111")
  }

─────────────────────────────────────────
LLM CALL  (via LiteLLM proxy)
─────────────────────────────────────────

LiteLLM checks workspace policy:
  → plan: Pro, preferred model: GPT-4o
  → spend this month: $180 / $300 limit → OK to proceed
  → no prompt injection detected
  → content policy: pass

GPT-4o receives (redacted only):
  "My name is <PERSON_1>, I work at <ORGANIZATION_1>..."

GPT-4o responds:
  "Hello <PERSON_1>! Your account at <ORGANIZATION_1>
   is currently active. I can see your card <CREDIT_CARD_1>
   on file. Your SSN <US_SSN_1> has been verified."

─────────────────────────────────────────
REHYDRATION
─────────────────────────────────────────

Presidio De-anonymizer reads vault from Redis:
  Decrypts each entry
  Replaces tokens in response

Final response:
  "Hello John Doe! Your account at Acme Corp
   is currently active. I can see your card 4111
   on file. Your SSN 123-45-6789 has been verified."

─────────────────────────────────────────
AUDIT LOG  (written to ClickHouse)
─────────────────────────────────────────

{
  "timestamp":       "2026-04-18T14:23:01Z",
  "workspace_id":    "ws_abc123",
  "session_id":      "sess_xyz789",
  "model":           "gpt-4o",
  "input_tokens":    87,
  "output_tokens":   54,
  "latency_ms":      1240,
  "entities_found":  ["PERSON", "ORGANIZATION", "US_SSN", "CREDIT_CARD"],
  "entity_count":    4,
  "policy_decision": "allow",
  "cost_usd":        0.0019
}

Note: original values are NEVER written to the audit log.
```

---

## Services and Responsibilities

### Next.js on Vercel — Web Layer
The public-facing layer. Owns authentication, session management, workspace configuration, billing, and the chat UI. Communicates with the Python services over internal HTTP. Never processes PII directly — it passes the user's message to the FastAPI service and receives the rehydrated response back. Handles rate limiting at the application level before requests reach the Python layer.

### FastAPI PII Service on Hetzner CX42 — Detection and Rehydration
The core of the product. Runs three PII detection passes in parallel, merges results, builds the encrypted vault, anonymises the prompt, and after the LLM responds, runs the de-anonymisation pass. Also enforces output content filtering. This service is stateless per request — all persistent state lives in Redis.

### Ollama on Hetzner CX42 — Self-Hosted NER LLM
A lightweight LLM (Llama 3.2 3B, Q4 quantised) running locally via Ollama. Called with a strict JSON-output prompt asking it to identify names, organisations, and addresses. Eliminates the need for any external API call during the detection phase. Total cost: $0 per request (already paid for with the Hetzner server). Adds ~80–150ms to detection time on CPU.

### LiteLLM Proxy on Hetzner CX32 — LLM Router
A standalone LiteLLM proxy server. Sits between the FastAPI service and all LLM providers. Handles routing logic, fallback chains, spend tracking per workspace, and load balancing across multiple API keys. Runs on a separate CX32 server so it can scale and restart independently of the PII service. Exposes an OpenAI-compatible endpoint so switching providers requires no code changes in FastAPI.

### Redis on Upstash — Encrypted Token Vault
Stores the redaction map for the duration of each conversation session. All values are AES-256 encrypted before writing — even if the Redis instance were compromised, the original values cannot be recovered without the encryption key. TTL is set to 1 hour per session. At conversation end the key expires automatically. Original PII values are never written to any permanent storage at any point.

### GPU Server on Vast.ai — Self-Hosted Response LLM (Optional)
Available as Route B in the LiteLLM proxy for workspaces that require complete data sovereignty — regulated industries where even a redacted prompt cannot leave the company's infrastructure. Runs a large open-weights model (Llama 3.1 70B or DeepSeek). Cost: ~$90/month on Vast.ai spot instances. Only activated for Enterprise workspaces with the full-sovereignty policy enabled.

### ClickHouse — Observability Event Store
An append-only columnar database optimised for time-series analytics. Every request, every redaction event, every policy decision, every cost attribution is written as an immutable event row. Powers the real-time dashboard — the latency charts, PII detection feed, cost-per-workspace breakdown, security trigger log. Original PII values are never written here. Only entity types and counts.

### OpenTelemetry + Grafana — Distributed Tracing and Metrics
Trace spans propagate across every service hop. A single chat request produces a trace that shows time spent in: Next.js routing, FastAPI detection, Ollama NER call, GLiNER inference, Presidio anonymisation, LiteLLM routing, LLM provider response, Presidio de-anonymisation. Used to identify bottlenecks and debug latency regressions. Grafana dashboards alert on p99 latency spikes, error rate increases, and quota thresholds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Auth | NextAuth.js v5 — email + password, Google OAuth |
| Database | PostgreSQL via Supabase (users, workspaces, billing, chat history) |
| ORM | Prisma |
| PII Detection — structured | Microsoft Presidio Analyzer |
| PII Detection — NER backbone | spaCy `en_core_web_lg` + `en_core_web_trf` |
| PII Detection — zero-shot | GLiNER medium |
| PII Detection — LLM-assisted | Ollama + Llama 3.2 3B (Q4) |
| PII Anonymisation | Presidio Anonymizer |
| PII De-anonymisation | Presidio De-anonymizer |
| Token Vault | Redis (Upstash) — AES-256 encrypted, session TTL |
| Python Service | FastAPI |
| LLM Routing | LiteLLM Proxy (standalone) |
| External LLMs | OpenAI, Anthropic, Google (via LiteLLM) |
| Self-hosted LLM | Ollama + Llama 3.1 70B on Vast.ai GPU |
| Event Store | ClickHouse |
| Distributed Tracing | OpenTelemetry |
| Metrics | Prometheus + Grafana |
| Payments | Stripe (subscriptions + usage billing) |
| Email | Resend + react-email |
| Web Hosting | Vercel |
| Python Hosting | Hetzner CX42 (PII service), Hetzner CX32 (LiteLLM) |
| GPU Hosting | Vast.ai (~$90/month, spot RTX 3090) |

---

## Infrastructure

| Server | Specs | Cost/month | Runs |
|---|---|---|---|
| Hetzner CX42 | 8 vCPU, 16GB RAM | $18 | FastAPI + Presidio + GLiNER + Ollama + Redis client |
| Hetzner CX32 | 4 vCPU, 8GB RAM | $7.59 | LiteLLM proxy + ClickHouse |
| Vast.ai GPU | RTX 3090, 24GB VRAM | ~$90 | Ollama + Llama 3.1 70B (optional, Enterprise only) |
| Upstash Redis | Managed | ~$10–20 | Encrypted token vault |
| Vercel Pro | — | $20 | Next.js |
| Supabase Pro | — | $25 | PostgreSQL |
| **Total (without GPU)** | | **~$90/month** | |
| **Total (with GPU)** | | **~$180/month** | |

---

## PII Entity Types Covered

| Category | Entity Types |
|---|---|
| Personal identity | PERSON, DATE_OF_BIRTH, AGE |
| Contact | EMAIL_ADDRESS, PHONE_NUMBER, URL |
| Financial | CREDIT_CARD, IBAN_CODE, US_BANK_NUMBER, SWIFT_CODE |
| Government ID | US_SSN, US_PASSPORT, US_DRIVER_LICENSE, UK_NHS, AU_TFN, IN_AADHAAR |
| Network | IP_ADDRESS, MAC_ADDRESS |
| Location | LOCATION, ADDRESS, POSTCODE |
| Organisation | NRP, ORGANIZATION |
| Medical (custom) | MEDICAL_RECORD_NUMBER, DIAGNOSIS_CODE, PRESCRIPTION_ID |
| Financial (custom) | EMPLOYEE_ID, ACCOUNT_NUMBER, POLICY_NUMBER |
| Zero-shot (GLiNER) | Any label — passed dynamically per workspace policy |

Custom recognisers for medical and financial entities are built on top of Presidio's `PatternRecognizer` and `EntityRecognizer` base classes. Each industry vertical gets its own recogniser set configured at the workspace level.

---

## Security Properties

**Data in transit** — All inter-service communication is TLS encrypted. Next.js to FastAPI over HTTPS. FastAPI to Redis over TLS. LiteLLM to LLM providers over HTTPS.

**Data at rest** — The token vault in Redis is AES-256 encrypted before writing. The application-level encryption key is stored in an environment variable, never in the database.

**Data lifetime** — Original PII values exist in three places only: the user's browser, the FastAPI service memory during request processing, and the Redis vault with a session TTL. At no point are original values written to any database, log file, or audit trail.

**LLM provider exposure** — External LLM providers (OpenAI, Anthropic, etc.) receive only the anonymised prompt. They never see original names, emails, SSNs, or any other personal data. For Enterprise workspaces using Route B (self-hosted LLM), even the anonymised prompt stays on-premises.

**Audit log safety** — ClickHouse logs entity types and counts only. A row might say `"entity_count": 3, "entity_types": ["PERSON", "EMAIL_ADDRESS", "US_SSN"]` but never contains the actual values.

---

## Scalability

### Detection throughput on Hetzner CX42
- Presidio + spaCy lg: ~200–500ms per request on CPU
- GLiNER medium: ~80ms per sentence on CPU
- Ollama Llama 3.2 3B: ~500ms–1.5s for a typical chat message on CPU
- Total detection pipeline: ~800ms–2.5s
- Acceptable because the LLM response takes 2–10s — detection is never the bottleneck

### Horizontal scaling
- FastAPI service is stateless. Run 2+ instances behind a load balancer when traffic grows.
- LiteLLM proxy is stateless. Same approach.
- Redis handles concurrency natively.
- ClickHouse is designed for high write throughput.

### When to move to GPU
Move the detection pipeline to GPU (GLiNER + Ollama) when you're consistently above 200 requests per minute and detection latency becomes noticeable. A single RTX 3090 drops GLiNER inference from 80ms to under 10ms and Ollama NER from 1.5s to under 200ms.

---

## Evolution from MVP

| Version | What changes |
|---|---|
| MVP | Presidio only · in-memory vault · LiteLLM library · GPT-4o-mini only |
| V2 | + GLiNER · + Redis vault · + multiple LLM providers via LiteLLM library |
| V3 | + Ollama NER LLM (self-hosted, $0 per detection) · + LiteLLM as standalone proxy · + ClickHouse |
| V4 | + AES-256 vault encryption · + OpenTelemetry · + custom Presidio recognisers per industry |
| V5 | + Self-hosted response LLM (Vast.ai GPU) · + full data sovereignty mode · + Grafana dashboards |
| Production | + Multi-region deployment · + dedicated GPU · + fine-tuned NER models on customer data |

---

## Monthly Cost at Different Stages

| Stage | Active workspaces | Infrastructure cost | LLM cost (pass-through) |
|---|---|---|---|
| MVP | < 50 | $7.59 | Customer's API keys |
| Growth | ~500 | $90 | Marked up to customer |
| Scale | ~5,000 | $180 | Marked up to customer |
| Enterprise | 5,000+ | Custom | Negotiated per contract |

LLM API costs (OpenAI, Anthropic) are always passed through to customers as usage billing. They are never a fixed cost to Exfira.
