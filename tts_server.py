#!/usr/bin/env python3
"""
Local Kokoro TTS server for Dictée Brevet 2026.
Uses mlx-audio on Apple Silicon — extremely natural, human-like speech.
Only 82M params → blazing fast on M4 Pro.
"""

import io
import wave
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# -----------------------------------------------
# Model config — Kokoro: natural, human-like TTS
# -----------------------------------------------
MODEL_NAME = "mlx-community/Kokoro-82M-bf16"
DEFAULT_VOICE = "ff_siwis"      # French female voice
DEFAULT_LANG = "f"              # French lang code
DEFAULT_SPEED = 0.9             # Slightly slower for dictation clarity

# -----------------------------------------------
# Load model at startup
# -----------------------------------------------
print(f"[TTS] Loading model: {MODEL_NAME}")

from mlx_audio.tts.utils import load_model
model = load_model(MODEL_NAME)

print("[TTS] Model loaded! Server ready.")

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


def audio_to_wav_bytes(audio_array, sample_rate: int = 24000) -> bytes:
    """Convert numpy/mlx float32 array to WAV bytes."""
    if hasattr(audio_array, 'tolist'):
        arr = np.array(audio_array.tolist(), dtype=np.float32)
    else:
        arr = np.asarray(audio_array, dtype=np.float32)

    if arr.ndim > 1:
        arr = arr.mean(axis=-1)

    arr = np.clip(arr, -1.0, 1.0)
    pcm = (arr * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())

    return buf.getvalue()


@app.get("/v1/models")
def list_models():
    return {"object": "list", "data": [{"id": MODEL_NAME, "object": "model"}]}


@app.post("/v1/audio/speech")
def synthesize(req: SpeechRequest):
    if not req.input or not req.input.strip():
        raise HTTPException(status_code=400, detail="input is required")

    try:
        text = req.input.strip()
        print(f'[TTS] Synthesizing ({len(text)} chars): "{text[:60]}..."')

        results = list(model.generate(
            text=text,
            voice=req.voice,
            speed=req.speed,
            lang_code=req.lang_code,
        ))

        if not results:
            raise HTTPException(status_code=500, detail="No audio generated")

        audio = results[0].audio
        sample_rate = getattr(results[0], 'sample_rate', 24000)

        wav_bytes = audio_to_wav_bytes(audio, sample_rate)
        print(f"[TTS] Generated {len(wav_bytes)} bytes")

        return Response(content=wav_bytes, media_type="audio/wav")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[TTS] Error: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
