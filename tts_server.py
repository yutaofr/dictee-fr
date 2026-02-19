#!/usr/bin/env python3
"""
Local Kokoro TTS server for Dictée Brevet 2026.
Uses mlx-audio on Apple Silicon — extremely natural, human-like speech.
Only 82M params → blazing fast on M4 Pro.
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
# Model config — Kokoro: natural, human-like TTS
# -----------------------------------------------
MODEL_NAME = "mlx-community/Kokoro-82M-bf16"
DEFAULT_VOICE = "ff_siwis"      # French female voice
DEFAULT_LANG = "f"              # French lang code
DEFAULT_SPEED = 0.9             # Slightly slower for dictation clarity
MAX_CHUNK_CHARS = 220           # Keep phonemizer input short for stable French output
CHUNK_GAP_SECONDS = 0.10        # Tiny pause between chunks for natural flow

# -----------------------------------------------
# Load model at startup
# -----------------------------------------------
print(f"[TTS] Loading model: {MODEL_NAME}")

from mlx_audio.tts.utils import load_model
model = load_model(MODEL_NAME)
model_lock = threading.Lock()

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


def to_numpy_audio(audio_array) -> np.ndarray:
    if hasattr(audio_array, 'tolist'):
        arr = np.array(audio_array.tolist(), dtype=np.float32)
    else:
        arr = np.asarray(audio_array, dtype=np.float32)

    if arr.ndim > 1:
        arr = arr.mean(axis=-1)

    return arr.astype(np.float32, copy=False)


def hard_wrap_segment(segment: str, max_chars: int) -> list[str]:
    words = segment.split()
    if not words:
        return []

    chunks = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = word
    chunks.append(current)
    return chunks


def split_text_for_tts(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    if len(cleaned) <= max_chars:
        return [cleaned]

    sentence_like = re.split(r"(?<=[.!?;:])\s+", cleaned)
    units: list[str] = []
    for piece in sentence_like:
        part = piece.strip()
        if not part:
            continue
        if len(part) <= max_chars:
            units.append(part)
            continue

        comma_parts = re.split(r"(?<=,)\s+", part)
        for cp in comma_parts:
            c = cp.strip()
            if not c:
                continue
            if len(c) <= max_chars:
                units.append(c)
            else:
                units.extend(hard_wrap_segment(c, max_chars))

    if not units:
        return [cleaned]

    packed: list[str] = []
    current = units[0]
    for unit in units[1:]:
        candidate = f"{current} {unit}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            packed.append(current)
            current = unit
    packed.append(current)

    return packed


@app.get("/v1/models")
def list_models():
    return {"object": "list", "data": [{"id": MODEL_NAME, "object": "model"}]}


@app.post("/v1/audio/speech")
def synthesize(req: SpeechRequest):
    if not req.input or not req.input.strip():
        raise HTTPException(status_code=400, detail="input is required")

    try:
        text = req.input.strip()
        chunks = split_text_for_tts(text)
        if not chunks:
            raise HTTPException(status_code=400, detail="input is required")

        print(f'[TTS] Synthesizing ({len(text)} chars, {len(chunks)} chunk(s)): "{text[:60]}..."')

        chunk_audios: list[np.ndarray] = []
        sample_rate = 24000

        # mlx/kokoro is not safe for concurrent Metal command encoding.
        # Serialize all generation calls inside this process.
        with model_lock:
            for idx, chunk in enumerate(chunks):
                if len(chunks) > 1:
                    print(f'[TTS]   chunk {idx + 1}/{len(chunks)} ({len(chunk)} chars)')

                results = list(model.generate(
                    text=chunk,
                    voice=req.voice,
                    speed=req.speed,
                    lang_code=req.lang_code,
                ))

                if not results:
                    raise HTTPException(status_code=500, detail="No audio generated")

                generated_parts: list[np.ndarray] = []
                for generated in results:
                    generated_audio = getattr(generated, 'audio', None)
                    if generated_audio is None:
                        continue
                    sample_rate = getattr(generated, 'sample_rate', sample_rate)
                    generated_parts.append(to_numpy_audio(generated_audio))

                if not generated_parts:
                    raise HTTPException(status_code=500, detail="No audio generated")

                if len(generated_parts) == 1:
                    chunk_audios.append(generated_parts[0])
                else:
                    chunk_audios.append(np.concatenate(generated_parts))

        if not chunk_audios:
            raise HTTPException(status_code=500, detail="No audio generated")

        if len(chunk_audios) > 1:
            gap = np.zeros(int(sample_rate * CHUNK_GAP_SECONDS), dtype=np.float32)
            timeline = []
            for i, arr in enumerate(chunk_audios):
                timeline.append(arr)
                if i < len(chunk_audios) - 1:
                    timeline.append(gap)
            audio = np.concatenate(timeline)
        else:
            audio = chunk_audios[0]

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
