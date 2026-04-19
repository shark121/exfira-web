import json
import logging
import os

import httpx

logger = logging.getLogger("exfira")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma4:e2b")

SYSTEM_PROMPT = (
    "You are a PII detection engine. Your only job is to find personally identifiable "
    "information in text.\n\n"
    "Given a piece of text, return a JSON array of all PII spans found. "
    "Each object must have:\n"
    '  - "text":        the exact substring as it appears in the input\n'
    '  - "entity_type": one of PERSON, EMAIL_ADDRESS, PHONE_NUMBER, CREDIT_CARD,\n'
    "                   IBAN_CODE, US_BANK_NUMBER, US_SSN, US_PASSPORT,\n"
    "                   US_DRIVER_LICENSE, UK_NHS, IP_ADDRESS, URL,\n"
    "                   LOCATION, NRP, MEDICAL_LICENSE, DATE_OF_BIRTH,\n"
    "                   FINANCIAL_ACCOUNT, CUSTOM_ID\n\n"
    "Return only valid JSON. No explanation. No markdown. If no PII is found, return []."
)


class GemmaDetector:
    def __init__(
        self,
        model: str = GEMMA_MODEL,
        ollama_url: str = OLLAMA_URL,
        timeout: float = 30.0,
    ):
        self._model = model
        self._url = ollama_url
        self._timeout = timeout

    async def detect(self, text: str) -> list[dict]:
        """
        Call Gemma 4 via Ollama and return detected PII spans.

        Returns a list of {"text": ..., "entity_type": ...} dicts.
        On parse failure, logs a warning and returns [] so the request
        continues without redaction rather than crashing.
        """
        payload = {
            "model": self._model,
            "stream": False,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f'Text: """{text}"""'},
            ],
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(self._url, json=payload)
            resp.raise_for_status()

        raw = resp.json()["message"]["content"].strip()

        # Strip markdown code fences if the model wraps its output
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            entities = json.loads(raw)
            if not isinstance(entities, list):
                raise ValueError("expected a JSON array")
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning(
                "Gemma 4 returned unparseable output: %s | raw=%s", exc, raw[:200]
            )
            return []

        return entities
