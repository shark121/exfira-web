#!/bin/bash
set -e

GEMMA_MODEL="gemma3:12b"
API_PORT=8000

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Exfira Gemma API — one-time setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Install Ollama ─────────────────────────────────────────────────────────
if ! command -v ollama &> /dev/null; then
    echo "[1/5] Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "[1/5] Ollama already installed — skipping"
fi

# ── 2. Start Ollama ───────────────────────────────────────────────────────────
echo "[2/5] Starting Ollama..."
pkill ollama 2>/dev/null || true
sleep 1
nohup ollama serve > /tmp/ollama.log 2>&1 &

echo "      Waiting for Ollama to be ready..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "      Ollama is ready"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Ollama did not start. Check /tmp/ollama.log"
        exit 1
    fi
    sleep 2
done

# ── 3. Pull Gemma model ───────────────────────────────────────────────────────
echo "[3/5] Pulling ${GEMMA_MODEL} (this may take a few minutes)..."
ollama pull "${GEMMA_MODEL}"
echo "      Model ready"

# ── 4. Install Python dependencies ───────────────────────────────────────────
echo "[4/5] Installing Python dependencies..."
pip install -q -r requirements.txt
echo "      Dependencies installed"

# ── 5. Create .env ────────────────────────────────────────────────────────────
echo "[5/5] Configuring environment..."
if [ ! -f .env ]; then
    echo ""
    read -rp "      Enter your OpenAI API key: " OPENAI_KEY
    cat > .env <<EOF
OPENAI_API_KEY=${OPENAI_KEY}
LLM_MODEL=gpt-4o-mini
GEMMA_MODEL=${GEMMA_MODEL}
OLLAMA_URL=http://localhost:11434/api/chat
NEXT_APP_URL=
COMPLIANCE_LOG_DIR=logs
EOF
    echo "      .env created"
else
    echo "      .env already exists — skipping"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete — starting API on :${API_PORT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bash start.sh
