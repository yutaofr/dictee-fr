// =====================================================
// src/tts.js — TTS Engine: Kokoro via backend proxy
// =====================================================
// Functions in this module:
//   fetchTTSAudio    — fetch/cache audio blob URL
//   playAudio        — play a cached blob URL with abort/pause support
//   stopAudio        — stop current playback
//   speakAsync       — combined fetch + play at a given speed
//   speakWord        — one-shot word pronunciation (fire-and-forget)
//   pregenerate      — pre-warm the audio cache for all exam segments
//
// This module has NO knowledge of exam phase or sentence index.
// It only knows about text → audio → playback.

import { state } from './state.js';

// -----------------------------------------------
// Low-level fetch (with in-memory cache)
// -----------------------------------------------
export async function fetchTTSAudio(text, speed = 1.0) {
    const key = `${text}|${speed}`;
    if (state.audioCache.has(key)) {
        return state.audioCache.get(key);
    }

    const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speed }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `TTS request failed: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    state.audioCache.set(key, url);
    return url;
}

// -----------------------------------------------
// Playback with abort and pause support
// -----------------------------------------------
export function playAudio(blobUrl, playbackRate = 1.0) {
    return new Promise((resolve, reject) => {
        stopAudio();

        const audio = new Audio(blobUrl);
        const clampedRate = Math.max(0.5, Math.min(1.2, playbackRate));
        audio.playbackRate = clampedRate;
        if ('preservesPitch' in audio) audio.preservesPitch = true;
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
        state.currentAudio = audio;
        state.currentAudioResolve = resolve;
        state.currentAudioReject = reject;
        state.isSpeaking = true;

        audio.onended = () => {
            if (state.currentAudio !== audio) return;
            state.isSpeaking = false;
            state.currentAudio = null;
            state.currentAudioResolve = null;
            state.currentAudioReject = null;
            resolve();
        };

        audio.onerror = () => {
            if (state.currentAudio !== audio) return;
            state.isSpeaking = false;
            state.currentAudio = null;
            state.currentAudioResolve = null;
            state.currentAudioReject = null;
            reject(new Error('Audio playback failed'));
        };

        // Handle abort via AbortController signal
        const activeAbortController = state.abortController;
        if (activeAbortController) {
            const onAbort = () => {
                if (state.currentAudio !== audio) return;
                audio.pause();
                audio.currentTime = 0;
                state.isSpeaking = false;
                state.currentAudio = null;
                state.currentAudioResolve = null;
                state.currentAudioReject = null;
                reject(new Error('aborted'));
            };

            if (activeAbortController.signal.aborted) {
                onAbort();
                return;
            }

            activeAbortController.signal.addEventListener('abort', onAbort, { once: true });
        }

        audio.play().catch((err) => {
            if (state.currentAudio !== audio) return;
            state.isSpeaking = false;
            state.currentAudio = null;
            state.currentAudioResolve = null;
            state.currentAudioReject = null;
            reject(err);
        });
    });
}

export function stopAudio({ rejectCurrent = false, reason = 'aborted' } = {}) {
    const resolveCurrent = state.currentAudioResolve;
    const rejectCurrentFn = state.currentAudioReject;
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
        state.currentAudio = null;
    }
    state.currentAudioResolve = null;
    state.currentAudioReject = null;
    state.isSpeaking = false;

    if (rejectCurrent && rejectCurrentFn) {
        rejectCurrentFn(new Error(reason));
        return;
    }

    if (resolveCurrent) {
        resolveCurrent();
    }
}

// -----------------------------------------------
// Unified TTS speak function
// -----------------------------------------------
export async function speakAsync(text, speed = 1.0) {
    if (!state.ttsAvailable) {
        throw new Error('Kokoro server unavailable');
    }
    // Generate at target speed natively via Kokoro — no playback distortion
    const blobUrl = await fetchTTSAudio(text, speed);
    await playAudio(blobUrl, 1.0);
}

export function speakWord(word) {
    if (!state.ttsAvailable) return;
    fetchTTSAudio(word, 1.0)
        .then(url => playAudio(url, 0.8))
        .catch(e => {
            console.warn('[TTS] Word synthesis failed:', e.message);
        });
}

// -----------------------------------------------
// Pre-generation — warms up audio cache for all exam segments
// onProgress(current, total) and onComplete/onSkipped are UI
// callback parameters so this module stays DOM-free.
// -----------------------------------------------
export async function pregenerate(dictee, { getDictationSegments, buildAnnouncements, onProgress, onComplete, onSkip }) {
    if (!state.ttsAvailable) return;

    state.pregenInProgress = true;
    state.pregenSkipRequested = false;

    const announcements = buildAnnouncements(dictee);
    const { dictationSegments } = getDictationSegments(dictee.texte);
    const dictSpeed = state.dicteeSpeed;

    // Segments and their target generation speed:
    //   announcements (lecture1, dictee, relecture) → always 1.0
    //   dictation content (full text + sentence segments) → dicteeSpeed
    const segments = [
        announcements.lecture1,
        dictee.texte,
        announcements.dictee,
        ...dictationSegments,
        announcements.relecture,
    ];
    const speeds = [
        1.0,                                      // lecture1 announcement
        dictSpeed,                                // full text reading
        1.0,                                      // dictee announcement
        ...dictationSegments.map(() => dictSpeed),// sentence-by-sentence
        1.0,                                      // relecture announcement
    ];

    state.pregenTotal = segments.length;
    state.pregenProgress = 0;

    console.log(`[TTS] Pre-generating ${segments.length} audio segments at speed ${dictSpeed}...`);
    onProgress(0, segments.length);

    for (let i = 0; i < segments.length; i++) {
        if (state.pregenSkipRequested) {
            console.log('[TTS] Pre-generation skipped by user');
            onSkip();
            break;
        }

        try {
            await fetchTTSAudio(segments[i], speeds[i]);
            state.pregenProgress = i + 1;
            onProgress(i + 1, segments.length);
        } catch (e) {
            console.warn(`[TTS] Pre-gen segment ${i} failed:`, e.message);
        }
    }

    if (!state.pregenSkipRequested) {
        console.log('[TTS] Pre-generation complete');
        onComplete();
    }

    state.pregenInProgress = false;
}
