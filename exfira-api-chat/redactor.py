"""
ChatGPT-based PII redactor.

Sends the text to GPT to identify and replace PII with deterministic tokens.

vault structure:
  { token: (token, original, entity_type) }
  e.g. { "<PERSON>": ("<PERSON>", "John Doe", "PERSON") }
"""

import json
import logging
import os
import re

import litellm

logger = logging.getLogger("exfira")

_REDACT_SYSTEM = (
    "You are a PII detection and redaction engine. "
    "Analyze the text and identify all personally identifiable information. "
    "Replace each PII instance with a token: <ENTITY_TYPE> for the first occurrence, "
    "<ENTITY_TYPE_1> for a second distinct value of the same type, and so on. "
    "Reuse the same token when the same value appears more than once. "
    "Respond ONLY with a valid JSON object — no markdown, no explanation — in this exact shape:\n"
    '{"redacted_text": "...", "entities": [{"token": "<PERSON>", "original": "John", "entity_type": "PERSON"}, ...]}\n'
    "Entity types to detect: "
    "PERSON, EMAIL_ADDRESS, PHONE_NUMBER, CREDIT_CARD, IBAN_CODE, US_BANK_NUMBER, "
    "US_SSN, US_PASSPORT, US_DRIVER_LICENSE, UK_NHS, IP_ADDRESS, URL, LOCATION, "
    "NRP, MEDICAL_LICENSE, DATE_OF_BIRTH, ORGANIZATION. "
    "If no PII is found return: {\"redacted_text\": \"<original>\", \"entities\": []}"
)


class Redactor:
    def __init__(self):
        self._model = os.getenv("REDACTION_MODEL", "gpt-4o-mini")
        self._api_key = os.getenv("OPENAI_API_KEY")

    def redact(self, text: str) -> tuple[str, dict[str, tuple[str, str, str]]]:
        """
        Detect and replace PII using ChatGPT.

        Returns:
            redacted_text: text with PII replaced by tokens
            vault: { token: (token, original, entity_type) }
        """
        messages = [
            {"role": "system", "content": _REDACT_SYSTEM},
            {"role": "user", "content": text},
        ]

        try:
            response = litellm.completion(
                model=self._model,
                messages=messages,
                api_key=self._api_key,
                temperature=0,
                max_tokens=2048,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            logger.error("GPT redaction call failed: %s", e)
            raise

        raw = response.choices[0].message.content or "{}"
        raw = raw.strip()

        # Strip markdown fences if model wraps in ```json ... ```
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse redaction JSON: %s\nRaw: %s", e, raw[:300])
            return text, {}

        redacted_text = parsed.get("redacted_text", text)
        entities = parsed.get("entities", [])

        vault: dict[str, tuple[str, str, str]] = {}
        for item in entities:
            token = item.get("token", "")
            original = item.get("original", "")
            entity_type = item.get("entity_type", "UNKNOWN")
            if token and original:
                vault[token] = (token, original, entity_type)

        return redacted_text, vault

    def rehydrate(self, text: str, vault: dict[str, tuple[str, str, str]]) -> str:
        """Replace all tokens in text with their original values."""
        for token, (_, original, _entity_type) in vault.items():
            text = text.replace(token, original)
        return text
