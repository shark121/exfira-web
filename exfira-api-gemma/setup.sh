#!/bin/bash
set -e

echo "Creating venv…"
python3 -m venv .venv
source .venv/bin/activate

echo "Installing dependencies…"
pip install -r requirements.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ollama setup (run once on the server)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Install Ollama:"
echo "  curl -fsSL https://ollama.com/install.sh | sh"
echo ""
echo "Pull Gemma 4 (2B fits in 8 GB RAM):"
echo "  ollama pull gemma4:2b"
echo ""
echo "Verify Ollama is running:"
echo "  ollama run gemma4:2b \"Return []\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Run the API:"
echo "  source .venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
