#!/bin/bash
# =====================================================
# Local Kokoro TTS Server — Mac Apple Silicon (PyTorch MPS)
# =====================================================
# Runs a custom FastAPI TTS server on port 8000.
# The Node.js web server (Docker) calls this via host.docker.internal:8000.
#
# TTS Engine: Kokoro v1.0 (hexgrad/Kokoro-82M) via PyTorch + MPS
# G2P: misaki + espeak-ng (fr-fr)
# Python: 3.12 (via .venv-tts) — kokoro requires Python < 3.13
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
VENV_DIR="$SCRIPT_DIR/.venv-tts"
PYTHON_3_12="/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12"

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
# 2. Bootstrap Python 3.12 venv (kokoro requires Python < 3.13)
# -----------------------------------------------
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "[TTS] Creating Python 3.12 virtual environment at .venv-tts ..."
    if [ ! -x "$PYTHON_3_12" ]; then
        echo "[TTS] ❌ ERROR: Python 3.12 not found at $PYTHON_3_12"
        echo "[TTS]    Install it from https://www.python.org/downloads/ or via:"
        echo ""
        echo "       brew install python@3.12"
        echo ""
        exit 1
    fi
    "$PYTHON_3_12" -m venv "$VENV_DIR"
    echo "[TTS] ✓ Virtual environment created."
fi

# Activate the venv for all subsequent commands
source "$VENV_DIR/bin/activate"
echo "[TTS] ✓ Python: $(python --version) (from .venv-tts)"

# -----------------------------------------------
# 3. Free port 8000 if occupied
# -----------------------------------------------
if lsof -i :8000 -t >/dev/null; then
    echo "[TTS] Port 8000 is occupied. Cleaning up..."
    kill -9 $(lsof -t -i :8000) 2>/dev/null || true
    sleep 1
fi

# -----------------------------------------------
# 4. Install Python dependencies if needed
# -----------------------------------------------
for pkg in kokoro fastapi uvicorn; do
    if ! python -c "import ${pkg//-/_}" 2>/dev/null; then
        echo "[TTS] Installing $pkg..."
        pip install "$pkg"
    fi
done

# misaki[en] uses extras syntax — check and install separately
if ! python -c "import misaki" 2>/dev/null; then
    echo "[TTS] Installing misaki[en]..."
    pip install "misaki[en]"
fi

# -----------------------------------------------
# 5. Enable PyTorch MPS (Apple Silicon Metal GPU)
# -----------------------------------------------
export PYTORCH_ENABLE_MPS_FALLBACK=1

echo "[TTS] Starting Kokoro v1.0 TTS server on port 8000..."
echo "[TTS] Engine : hexgrad/Kokoro-82M (PyTorch + MPS)"
echo "[TTS] Voice  : ff_siwis (French female)"
echo "[TTS] First run downloads model files — please wait."
echo "[TTS] Web app: http://localhost:8081"
echo ""

python "$SCRIPT_DIR/tts_server.py"
