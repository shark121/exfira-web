from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import time
import os

from redactor import Redactor
from llm import chat_with_llm

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("exfira")

redactor: Redactor = None  # type: ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redactor
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  Exfira API starting up")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("Loading Presidio analyzer…")
    t0 = time.perf_counter()
    redactor = Redactor()
    logger.info("Presidio + spaCy ready in %.2fs", time.perf_counter() - t0)
    logger.info("Model: %s", os.getenv("LLM_MODEL", "gpt-4o-mini"))
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    yield
    logger.info("Shutting down.")


app = FastAPI(title="Exfira PII Redaction Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", os.getenv("NEXT_APP_URL", "")],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    workspace_id: Optional[str] = "default"


class RedactionInfo(BaseModel):
    entity_type: str
    original: str
    token: str


class ChatResponse(BaseModel):
    response: str
    redacted_prompt: str
    redactions: list[RedactionInfo]


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": redactor is not None}


@app.post("/redact-and-chat", response_model=ChatResponse)
async def redact_and_chat(req: ChatRequest, request: Request):
    req_start = time.perf_counter()
    workspace = req.workspace_id or "default"

    logger.info("────────────────────────────────────────")
    logger.info("▶  New request  workspace=%s  messages=%d", workspace, len(req.messages))

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    last_msg = req.messages[-1]
    if last_msg.role != "user":
        raise HTTPException(status_code=400, detail="last message must be from user")

    original_text = last_msg.content
    logger.info("   Original   : %s", _truncate(original_text))

    # ── Step 1 & 2: Detect + anonymise ────────────────────────────────────────
    t1 = time.perf_counter()
    redacted_text, vault = redactor.redact(original_text)
    detection_ms = (time.perf_counter() - t1) * 1000

    if vault:
        logger.info("   Redacted   : %s", _truncate(redacted_text))
        logger.info("   Detection  : %.1fms  —  %d entit%s found",
                    detection_ms, len(vault), "y" if len(vault) == 1 else "ies")
        for token, (_, original, entity_type) in vault.items():
            logger.info("     %-30s  →  %s  (%s)", original, token, entity_type)
    else:
        logger.info("   Detection  : %.1fms  —  no PII found, prompt sent as-is", detection_ms)

    # ── Step 3: LLM call ───────────────────────────────────────────────────────
    llm_messages = [
        {"role": m.role, "content": m.content} for m in req.messages[:-1]
    ]
    llm_messages.append({"role": "user", "content": redacted_text})

    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    logger.info("   LLM call   : %s  (history=%d turns)", model, len(llm_messages))

    t2 = time.perf_counter()
    raw_response = await chat_with_llm(llm_messages)
    llm_ms = (time.perf_counter() - t2) * 1000

    logger.info("   LLM reply  : %.1fms  —  %d chars", llm_ms, len(raw_response))
    logger.info("   Raw reply  : %s", _truncate(raw_response))

    # ── Step 4: Rehydrate ──────────────────────────────────────────────────────
    rehydrated = redactor.rehydrate(raw_response, vault)

    if vault:
        logger.info("   Rehydrated : %s", _truncate(rehydrated))

    total_ms = (time.perf_counter() - req_start) * 1000
    logger.info("◀  Done  total=%.1fms  (detection=%.1fms  llm=%.1fms)",
                total_ms, detection_ms, llm_ms)
    logger.info("────────────────────────────────────────")

    redactions = [
        RedactionInfo(entity_type=entity_type, original=original, token=token)
        for token, (_, original, entity_type) in vault.items()
    ]

    return ChatResponse(
        response=rehydrated,
        redacted_prompt=redacted_text,
        redactions=redactions,
    )


def _truncate(text: str, limit: int = 120) -> str:
    return text if len(text) <= limit else text[:limit] + "…"
