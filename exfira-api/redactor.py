"""
Presidio-based PII redactor.

vault structure:
  { token: (original_text, entity_type) }
  e.g. { "<PERSON>": ("John Doe", "PERSON") }
"""

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

_DOB_RECOGNIZER = PatternRecognizer(
    supported_entity="DATE_OF_BIRTH",
    patterns=[
        # Explicit label followed by a date: "DOB: 01/01/1990", "date of birth: Jan 1, 1990"
        Pattern(
            "labeled_dob",
            r"(?i)\b(?:dob|date\s+of\s+birth|birth\s+date|born\s+on|born)\s*:?\s*"
            r"(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}"
            r"|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}"
            r"|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
            r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
            r"\s+\d{1,2},?\s+\d{4})",
            0.9,
        ),
        # Standalone date with context words nearby (context boost applied by Presidio)
        Pattern(
            "date_with_context",
            r"\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b",
            0.4,
        ),
    ],
    context=["born", "dob", "date of birth", "birth date", "birthday", "date of birth is", "born on"],
)


class Redactor:
    def __init__(self):
        self._analyzer = AnalyzerEngine()
        self._analyzer.registry.add_recognizer(_DOB_RECOGNIZER)
        self._anonymizer = AnonymizerEngine()

        self._entities = [
            "PERSON",
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "CREDIT_CARD",
            "IBAN_CODE",
            "US_BANK_NUMBER",
            "US_SSN",
            "US_PASSPORT",
            "US_DRIVER_LICENSE",
            "UK_NHS",
            "IP_ADDRESS",
            "URL",
            "LOCATION",
            "NRP",
            "MEDICAL_LICENSE",
            "DATE_OF_BIRTH",
        ]

    def redact(self, text: str) -> tuple[str, dict[str, tuple[str, str, str]]]:
        """
        Detect and replace PII with deterministic tokens.

        Returns:
            redacted_text: text with PII replaced
            vault: { token: (token, original, entity_type) }
                   e.g. { "<PERSON>": ("<PERSON>", "John Doe", "PERSON") }
        """
        results = self._analyzer.analyze(
            text=text, language="en", entities=self._entities
        )

        if not results:
            return text, {}

        vault: dict[str, tuple[str, str, str]] = {}
        counters: dict[str, int] = {}

        # Sort by start position descending so we can replace without index shifts
        results_sorted = sorted(results, key=lambda r: r.start)

        # Build token map (same entity value → same token)
        value_to_token: dict[str, str] = {}

        for result in results_sorted:
            original = text[result.start : result.end]
            entity_type = result.entity_type

            if original in value_to_token:
                continue  # reuse existing token for duplicate values

            count = counters.get(entity_type, 0)
            if count == 0:
                token = f"<{entity_type}>"
            else:
                token = f"<{entity_type}_{count}>"
            counters[entity_type] = count + 1

            value_to_token[original] = token
            vault[token] = (token, original, entity_type)

        # Replace all detected spans using Presidio anonymizer with custom operators
        operators = {
            result.entity_type: OperatorConfig(
                "replace",
                {"new_value": value_to_token.get(text[result.start : result.end], f"<{result.entity_type}>")},
            )
            for result in results_sorted
        }

        anonymized = self._anonymizer.anonymize(
            text=text, analyzer_results=results, operators=operators
        )

        return anonymized.text, vault

    def rehydrate(self, text: str, vault: dict[str, tuple[str, str, str]]) -> str:
        """Replace all tokens in text with their original values."""
        for token, (_, original, _entity_type) in vault.items():
            text = text.replace(token, original)
        return text
