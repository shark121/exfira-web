#!/bin/bash
set -e

API_PORT=8000

# ── Start Ollama if not running ───────────────────────────────────────────────
if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Starting Ollama..."
    nohup ollama serve > /tmp/ollama.log 2>&1 &
    echo "Waiting for Ollama..."
    for i in $(seq 1 30); do
        if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "Ollama ready"
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo "ERROR: Ollama did not start. Check /tmp/ollama.log"
            exit 1
        fi
        sleep 2
    done
else
    echo "Ollama already running"
fi

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "ERROR: .env not found. Run setup.sh first."
    exit 1
fi

# ── Verify GPU is visible to Ollama ──────────────────────────────────────────
echo "GPU check:"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader

# ── Warm up the model ─────────────────────────────────────────────────────────
echo "Warming up ${GEMMA_MODEL}..."
curl -sf http://localhost:11434/api/generate \
    -d "{\"model\": \"${GEMMA_MODEL}\", \"prompt\": \"hi\", \"stream\": false}" \
    > /dev/null && echo "Model warm" || echo "Warm-up skipped"

# ── Start FastAPI ─────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Exfira API running on :${API_PORT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

uvicorn main:app --host 0.0.0.0 --port "${API_PORT}"
