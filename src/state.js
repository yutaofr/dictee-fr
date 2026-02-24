// =====================================================
// src/state.js — Shared mutable state singleton
// =====================================================
// Imported by all modules that need to read or modify
// application state. Exported as a single object so all
// modules share the same reference.

export const state = {
    currentDictee: null,
    phase: 'idle', // idle | lecture1 | dictee | relecture | finished
    isPaused: false,
    isSpeaking: false,
    currentGroupIndex: 0,
    currentRepeat: 0,
    timerStart: null,
    timerInterval: null,
    dicteeSpeed: 0.85,
    abortController: null,
    // TTS
    ttsAvailable: false,
    currentAudio: null,  // current Audio object
    currentAudioResolve: null,
    currentAudioReject: null,
    audioCache: new Map(), // text → blob URL cache
    pregenProgress: 0,
    pregenTotal: 0,
    pregenInProgress: false,
    pregenSkipRequested: false,
    skipLectureIntroRequested: false,
    skipTransitionInProgress: false,
    examInProgress: false,
    activeRunToken: 0,
};
