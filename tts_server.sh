#!/bin/bash
# =====================================================
# Local Kokoro TTS Server — Mac Apple Silicon (MLX)
# =====================================================
# Runs a custom FastAPI TTS server on port 8000.
# The Node.js web server (Docker) calls this via host.docker.internal:8000.
#
# First run: downloads model files from Hugging Face cache.
# Subsequent runs: model is cached in ~/.cache/huggingface/
#
# Usage:
#   chmod +x tts_server.sh
#   ./tts_server.sh
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Free port 8000 if occupied
if lsof -i :8000 -t >/dev/null; then
    echo "[TTS] Port 8000 is occupied. Cleaning up..."
    kill -9 $(lsof -t -i :8000) 2>/dev/null || true
fi

# Install dependencies if needed
for pkg in mlx-audio mlx-lm fastapi uvicorn; do
    if ! python3 -c "import ${pkg//-/_}" 2>/dev/null; then
        echo "[TTS] Installing $pkg..."
        pip install "$pkg"
    fi
done

echo "[TTS] Starting Kokoro TTS server on port 8000..."
echo "[TTS] First run downloads model files — please wait."
echo "[TTS] Web app: http://localhost:8081"
echo ""

python3 "$SCRIPT_DIR/tts_server.py"
