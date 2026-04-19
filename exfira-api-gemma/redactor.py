class Redactor:
    def redact(
        self,
        text: str,
        detected: list[dict],
    ) -> tuple[str, dict[str, tuple[str, str, str]]]:
        """
        Build a redaction vault and return the anonymised text.

        Args:
            text:     the raw user message
            detected: list of {"text": ..., "entity_type": ...} dicts from GemmaDetector

        Returns:
            redacted_text: text with PII replaced by tokens
            vault:         { token: (token, original, entity_type) }
        """
        if not detected:
            return text, {}

        vault: dict[str, tuple[str, str, str]] = {}
        counters: dict[str, int] = {}
        value_to_token: dict[str, str] = {}

        for item in detected:
            original = item.get("text", "")
            entity_type = item.get("entity_type", "UNKNOWN")

            if not original or original in value_to_token:
                continue

            count = counters.get(entity_type, 0)
            token = f"<{entity_type}>" if count == 0 else f"<{entity_type}_{count}>"
            counters[entity_type] = count + 1

            value_to_token[original] = token
            vault[token] = (token, original, entity_type)

        redacted = text
        # Replace longest matches first to avoid partial substring collisions
        for original, token in sorted(value_to_token.items(), key=lambda x: -len(x[0])):
            redacted = redacted.replace(original, token)

        return redacted, vault

    def rehydrate(self, text: str, vault: dict[str, tuple[str, str, str]]) -> str:
        """Replace all tokens in text with their original values."""
        for token, (_, original, _entity_type) in vault.items():
            text = text.replace(token, original)
        return text
