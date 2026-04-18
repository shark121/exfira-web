from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import os

from redactor import Redactor
from llm import chat_with_llm

logger = logging.getLogger("exfira")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

redactor: Redactor = None  # type: ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redactor
    logger.info("Loading Presidio + spaCy model…")
    redactor = Redactor()
    logger.info("Ready.")
    yield


app = FastAPI(title="Exfira PII Redaction Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", os.getenv("NEXT_APP_URL", "")],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class Message(BaseModel):
    role: str  # "user" | "assistant"
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
    redactions: list[RedactionInfo]


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": redactor is not None}


@app.post("/redact-and-chat", response_model=ChatResponse)
async def redact_and_chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    # Only redact the last user message
    last_msg = req.messages[-1]
    if last_msg.role != "user":
        raise HTTPException(status_code=400, detail="last message must be from user")

    # Step 1 + 2: Detect and anonymise
    redacted_text, vault = redactor.redact(last_msg.content)
    logger.info(
        "Redacted %d entities from message (workspace=%s)",
        len(vault),
        req.workspace_id,
    )

    # Build message history for LLM (previous turns sent as-is; only latest is redacted)
    llm_messages = [
        {"role": m.role, "content": m.content} for m in req.messages[:-1]
    ]
    llm_messages.append({"role": "user", "content": redacted_text})

    # Step 3: Call LLM with redacted prompt
    raw_response = await chat_with_llm(llm_messages)

    # Step 4: Rehydrate — replace tokens with original values
    rehydrated = redactor.rehydrate(raw_response, vault)

    # Build redaction list for frontend display
    redactions = [
        RedactionInfo(entity_type=entity_type, original=original, token=token)
        for token, original, entity_type in vault.values()
    ]

    return ChatResponse(response=rehydrated, redactions=redactions)
