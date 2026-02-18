#!/bin/bash
# =====================================================
# Local Qwen3-TTS Server — Mac M4 Pro (MLX)
# =====================================================
# Runs a custom FastAPI TTS server on port 8000.
# The Node.js web server (Docker) calls this via host.docker.internal:8000.
#
# First run: downloads ~1.2GB model from Hugging Face.
# Subsequent runs: model is cached in ~/.cache/huggingface/
#
# Usage:
#   chmod +x tts_server.sh
#   ./tts_server.sh
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Install dependencies if needed
for pkg in mlx-audio fastapi uvicorn; do
    if ! python3 -c "import ${pkg//-/_}" 2>/dev/null; then
        echo "[TTS] Installing $pkg..."
        pip install "$pkg"
    fi
done

echo "[TTS] Starting Qwen3-TTS server on port 8000..."
echo "[TTS] First run downloads ~1.2GB model — please wait."
echo "[TTS] Web app: http://localhost:8081"
echo ""

python3 "$SCRIPT_DIR/tts_server.py"

