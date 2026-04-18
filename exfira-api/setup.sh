#!/bin/bash
set -e

echo "Creating venv…"
python3 -m venv .venv
source .venv/bin/activate

echo "Installing dependencies…"
pip install -r requirements.txt

echo "Downloading spaCy model (en_core_web_lg)…"
python -m spacy download en_core_web_lg

echo "Done. Run with:"
echo "  source .venv/bin/activate && uvicorn main:app --reload --port 8000"
