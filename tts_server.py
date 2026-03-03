#!/usr/bin/env python3
"""
Local Kokoro TTS server for Dictée Brevet 2026.
Uses Kokoro v1.0 (hexgrad/Kokoro-82M) via PyTorch + MPS on Apple Silicon.
G2P: misaki + espeak-ng (fr-fr) — much more accurate French phonemes than v0.19.
Only 82M params → fast on M4 Pro via PYTORCH_ENABLE_MPS_FALLBACK=1.
"""

import io
import re
import threading
import wave
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# -----------------------------------------------
# Model config — Kokoro v1.0: natural French TTS
# -----------------------------------------------
MODEL_NAME = "hexgrad/Kokoro-82M"
DEFAULT_VOICE = "ff_siwis"      # French female (SIWIS dataset)
DEFAULT_LANG = "f"              # French lang code (espeak-ng fr-fr)
DEFAULT_SPEED = 0.9             # Slightly slower for dictation clarity
SAMPLE_RATE = 24000             # Kokoro output sample rate (Hz)

# split_pattern used by KPipeline for long texts (Phase 1 / Phase 3 full-text reads)
SPLIT_PATTERN = r"(?<=[.!?;:])\s+"

# -----------------------------------------------
# Model config — LLM: text generation for dictations
# -----------------------------------------------
LLM_MODEL_NAME = "mlx-community/Qwen2.5-3B-Instruct-4bit"

# -----------------------------------------------
# Load TTS pipeline at startup
# -----------------------------------------------
print(f"[TTS] Loading pipeline: {MODEL_NAME} (lang_code='{DEFAULT_LANG}')")
from kokoro import KPipeline
pipeline = KPipeline(lang_code=DEFAULT_LANG)
print("[TTS] ✓ KPipeline ready.")

# -----------------------------------------------
# Load LLM at startup
# -----------------------------------------------
print(f"[LLM] Loading model: {LLM_MODEL_NAME}")
from mlx_lm import load as load_llm, generate as generate_llm
llm_model, llm_tokenizer = load_llm(LLM_MODEL_NAME)

# Serialize all Metal GPU calls to prevent concurrent command encoding crashes
model_lock = threading.Lock()

print("[SERVER] All models loaded! Server ready.")

# -----------------------------------------------
# FastAPI app
# -----------------------------------------------
app = FastAPI(title="Kokoro TTS Local Server")


class SpeechRequest(BaseModel):
    model: str = MODEL_NAME
    input: str
    voice: str = DEFAULT_VOICE
    speed: float = DEFAULT_SPEED
    lang_code: str = DEFAULT_LANG


class GenerateRequest(BaseModel):
    theme: str = None
    max_tokens: int = 500


# -----------------------------------------------
# Audio utilities
# -----------------------------------------------

def to_numpy_audio(audio) -> np.ndarray:
    """Convert a PyTorch Tensor (possibly on MPS) or numpy array to float32 ndarray."""
    import torch
    if isinstance(audio, torch.Tensor):
        # Force transfer from MPS/GPU device to CPU before calling numpy()
        arr = audio.cpu().numpy()
    elif hasattr(audio, "tolist"):
        arr = np.array(audio.tolist(), dtype=np.float32)
    else:
        arr = np.asarray(audio, dtype=np.float32)

    if arr.ndim > 1:
        arr = arr.mean(axis=-1)

    return arr.astype(np.float32, copy=False)


def audio_to_wav_bytes(audio_array: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Convert float32 numpy array to 16-bit WAV bytes."""
    arr = np.clip(audio_array, -1.0, 1.0)
    pcm = (arr * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())

    return buf.getvalue()


# -----------------------------------------------
# Routes
# -----------------------------------------------

@app.get("/v1/models")
def list_models():
    return {"object": "list", "data": [
        {"id": MODEL_NAME, "object": "model", "type": "tts"},
        {"id": LLM_MODEL_NAME, "object": "model", "type": "llm"},
    ]}


@app.post("/api/generate")
def generate_text(req: GenerateRequest):
    try:
        base_prompt = (
            "Tu es un professeur de français expert dans la préparation au Brevet des collèges. "
            "Génère un texte de dictée original pour des élèves de 3ème. "
            "Le texte doit être court (environ 50-80 mots), avoir un sens littéraire, "
            "et inclure des difficultés grammaticales classiques du Brevet (accords complexes, conjugaisons). "
        )
        if req.theme:
            base_prompt += f"Le thème est : {req.theme}. "
        base_prompt += (
            "\nRéponds UNIQUEMENT avec le texte de la dictée. "
            "Pas d'introduction, pas de conclusion, pas de commentaires."
        )

        messages = [{"role": "user", "content": base_prompt}]
        prompt = llm_tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )

        print(f"[LLM] Generating dictation (theme: {req.theme or 'any'})...")
        with model_lock:
            response = generate_llm(
                llm_model, llm_tokenizer, prompt=prompt, verbose=False, max_tokens=req.max_tokens
            )

        generated_text = response.strip()
        print(f"[LLM] Generated {len(generated_text)} chars.")
        return {"text": generated_text}

    except Exception as e:
        print(f"[LLM] Error: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/audio/speech")
def synthesize(req: SpeechRequest):
    if not req.input or not req.input.strip():
        raise HTTPException(status_code=400, detail="input is required")

    try:
        text = req.input.strip()
        print(f'[TTS] Synthesizing ({len(text)} chars): "{text[:60]}..."')

        audio_parts: list[np.ndarray] = []

        # KPipeline handles internal splitting via split_pattern.
        # CRITICAL: always pass split_pattern so full-text Phase 1/3 reads
        # (up to ~150 words) don't generate as one massive chunk → OOM.
        with model_lock:
            generator = pipeline(
                text,
                voice=req.voice,
                speed=req.speed,
                split_pattern=SPLIT_PATTERN,
            )
            for _gs, _ps, audio in generator:
                part = to_numpy_audio(audio)
                if part.size > 0:
                    audio_parts.append(part)

        if not audio_parts:
            raise HTTPException(status_code=500, detail="No audio generated")

        combined = np.concatenate(audio_parts) if len(audio_parts) > 1 else audio_parts[0]
        wav_bytes = audio_to_wav_bytes(combined, SAMPLE_RATE)
        print(f"[TTS] Generated {len(wav_bytes)} bytes ({len(audio_parts)} chunk(s))")

        return Response(content=wav_bytes, media_type="audio/wav")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[TTS] Error: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
