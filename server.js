// =====================================================
// Dictée Brevet 2026 — Backend TTS Server
// Proxy vers Qwen3-TTS local (mlx-audio, OpenAI-compatible API)
// =====================================================

import express from 'express';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// -----------------------------------------------
// Configuration
// -----------------------------------------------
// When running in Docker, reach the host Mac via host.docker.internal.
// When running directly on host, use localhost.
const TTS_SERVER_URL = process.env.TTS_SERVER_URL || 'http://host.docker.internal:8000';
const TTS_ENDPOINT = `${TTS_SERVER_URL}/v1/audio/speech`;

// Kokoro TTS model — extremely natural, human-like speech
const TTS_MODEL = 'mlx-community/Kokoro-82M-bf16';

// Voice: ff_siwis is a French female voice
const TTS_VOICE = 'ff_siwis';

const MAX_CACHE_SIZE = 200;
const REQUEST_TIMEOUT = 60000; // 60s — local model, first request may be slow

// -----------------------------------------------
// Cache
// -----------------------------------------------
const audioCache = new Map();

function cacheKey(text) {
    return createHash('md5').update(text).digest('hex');
}

function addToCache(key, audioBuffer) {
    if (audioCache.size >= MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        audioCache.delete(firstKey);
    }
    audioCache.set(key, audioBuffer);
}

// -----------------------------------------------
// TTS via local mlx-audio server (OpenAI-compatible)
// -----------------------------------------------
async function synthesize(text) {
    const key = cacheKey(text);

    if (audioCache.has(key)) {
        console.log(`[TTS] Cache hit: "${text.substring(0, 40)}..."`);
        return audioCache.get(key);
    }

    console.log(`[TTS] Synthesizing: "${text.substring(0, 60)}..."`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(TTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: TTS_MODEL,
                input: text,
                voice: TTS_VOICE,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`mlx-audio error ${response.status}: ${errText}`);
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`[TTS] Generated ${audioBuffer.length} bytes`);

        addToCache(key, audioBuffer);
        return audioBuffer;

    } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('TTS timeout');
        throw e;
    }
}

// -----------------------------------------------
// Middleware
// -----------------------------------------------
app.use(express.json({ limit: '1mb' }));

app.use(express.static(__dirname, {
    index: 'index.html',
    extensions: ['html']
}));

// -----------------------------------------------
// API Routes
// -----------------------------------------------

// TTS endpoint
app.post('/api/tts', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid "text" field' });
        }

        if (text.length > 2000) {
            return res.status(400).json({ error: 'Text too long (max 2000 chars)' });
        }

        const audioBuffer = await synthesize(text);

        res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=3600'
        });
        res.send(audioBuffer);

    } catch (error) {
        console.error('[TTS] Error:', error.message);
        res.status(500).json({
            error: 'TTS synthesis failed',
            detail: error.message
        });
    }
});

// Batch TTS endpoint
app.post('/api/tts/batch', async (req, res) => {
    try {
        const { segments } = req.body;

        if (!Array.isArray(segments) || segments.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid "segments" array' });
        }

        if (segments.length > 30) {
            return res.status(400).json({ error: 'Too many segments (max 30)' });
        }

        console.log(`[TTS] Batch request: ${segments.length} segments`);

        const results = [];
        for (let i = 0; i < segments.length; i++) {
            try {
                const audioBuffer = await synthesize(segments[i]);
                results.push({ index: i, success: true, audio: audioBuffer.toString('base64') });
                console.log(`[TTS] Batch ${i + 1}/${segments.length} done`);
            } catch (e) {
                console.error(`[TTS] Batch segment ${i} failed:`, e.message);
                results.push({ index: i, success: false, error: e.message });
            }
        }

        res.json({ results });

    } catch (error) {
        console.error('[TTS] Batch error:', error.message);
        res.status(500).json({ error: 'Batch TTS failed', detail: error.message });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    let ttsReachable = false;
    try {
        const r = await fetch(`${TTS_SERVER_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
        ttsReachable = r.ok;
    } catch (_) { }

    res.json({
        status: 'ok',
        ttsServer: TTS_SERVER_URL,
        ttsReachable,
        model: TTS_MODEL,
        cacheSize: audioCache.size
    });
});

// -----------------------------------------------
// Start
// -----------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Dictée Brevet 2026 running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] TTS server: ${TTS_SERVER_URL}`);
    console.log(`[Server] Model: ${TTS_MODEL}`);
});
