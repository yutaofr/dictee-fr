#!/bin/bash
# =====================================================
# Local Kokoro TTS Server — Mac Apple Silicon (PyTorch MPS)
# =====================================================
# Runs a custom FastAPI TTS server on port 8000.
# The Node.js web server (Docker) calls this via host.docker.internal:8000.
#
# TTS Engine: Kokoro v1.0 (hexgrad/Kokoro-82M) via PyTorch + MPS
# G2P: misaki + espeak-ng (fr-fr)
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

# -----------------------------------------------
# 1. Check system dependency: espeak-ng
# -----------------------------------------------
if ! command -v espeak-ng >/dev/null 2>&1; then
    echo "[TTS] ❌ ERROR: espeak-ng is not installed."
    echo "[TTS]    Kokoro v1.0 requires espeak-ng for French phoneme generation (G2P)."
    echo "[TTS]    Install it with:"
    echo ""
    echo "       brew install espeak-ng"
    echo ""
    exit 1
fi
echo "[TTS] ✓ espeak-ng found: $(espeak-ng --version 2>&1 | head -1)"

# -----------------------------------------------
# 2. Free port 8000 if occupied
# -----------------------------------------------
if lsof -i :8000 -t >/dev/null; then
    echo "[TTS] Port 8000 is occupied. Cleaning up..."
    kill -9 $(lsof -t -i :8000) 2>/dev/null || true
    sleep 1 # Wait for the port to be fully released
fi

# -----------------------------------------------
# 3. Install Python dependencies if needed
# -----------------------------------------------
for pkg in kokoro fastapi uvicorn; do
    if ! python3 -c "import ${pkg//-/_}" 2>/dev/null; then
        echo "[TTS] Installing $pkg..."
        pip install "$pkg"
    fi
done

# misaki[en] is imported as 'misaki', check separately
if ! python3 -c "import misaki" 2>/dev/null; then
    echo "[TTS] Installing misaki[en]..."
    pip install "misaki[en]"
fi

# -----------------------------------------------
# 4. Enable PyTorch MPS (Apple Silicon Metal GPU)
# -----------------------------------------------
export PYTORCH_ENABLE_MPS_FALLBACK=1

echo "[TTS] Starting Kokoro v1.0 TTS server on port 8000..."
echo "[TTS] Engine : hexgrad/Kokoro-82M (PyTorch + MPS)"
echo "[TTS] Voice  : ff_siwis (French female)"
echo "[TTS] First run downloads model files — please wait."
echo "[TTS] Web app: http://localhost:8081"
echo ""

python3 "$SCRIPT_DIR/tts_server.py"
