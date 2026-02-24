// =====================================================
// src/exam-flow.js — Exam protocol state machine
// =====================================================
// Functions in this module:
//   PUNCTUATION_RULES              — punctuation verbalization config
//   normalizePunctuationToken      — normalize '...' → '…'
//   splitIntoSentences             — split texte into phrases (Brevet protocol)
//   splitSentenceByPunctuation     — segment a phrase into text/punctuation parts
//   buildSentenceDictationText     — produce spoken form with punctuation announced
//   getDictationSpeechSegments     — map all phrases to spoken segments
//   buildDicteeKeyPointsText       — build TTS descriptor of key grammar points
//   buildPhaseAnnouncements        — build phase 1/2/3 spoken announcements
//   wait                           — abort-aware timer
//   waitForResume                  — poll for un-pause
//   ensureActiveRun                — runToken guard
//   updateTimer                    — update the elapsed timer display text
//   runLecture1                    — Phase 1: full reading
//   runDictee                      — Phase 2: sentence-by-sentence dictation
//   runRelecture                   — Phase 3: final re-read
//   startExam                      — orchestrate all 3 phases
//   skipPhase                      — skip to next phase
//   finishExam                     — tear down after all phases
//
// This module has ZERO direct DOM manipulation.
// All UI updates are delegated to imported ui.js primitives.

import { state } from './state.js';
import { speakAsync, stopAudio } from './tts.js';
import {
    updatePhaseUI,
    showWritingArea,
    hideWritingArea,
    showCurrentWordDisplay,
    hideCurrentWordDisplay,
    setCurrentWordText,
    setRepeatIndicator,
    setPhaseCounter,
    setPhaseDescription,
    showExamControls,
    showFinishControls,
    showTimerDisplay,
    setTimerText,
    setSkipLectureIntroVisible,
} from './ui.js';

// -----------------------------------------------
// Sentence splitting (official Brevet protocol: "phrase par phrase")
// -----------------------------------------------
export function splitIntoSentences(texte) {
    return texte
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

// -----------------------------------------------
// Punctuation verbalization config
// -----------------------------------------------
export const PUNCTUATION_RULES = {
    ',': { speak: 'virgule', pauseMs: 1100 },
    ';': { speak: 'point-virgule', pauseMs: 1400 },
    ':': { speak: 'deux-points', pauseMs: 1400 },
    '.': { speak: 'point', pauseMs: 1800 },
    '?': { speak: "point d'interrogation", pauseMs: 1800 },
    '!': { speak: "point d'exclamation", pauseMs: 1800 },
    '…': { speak: 'points de suspension', pauseMs: 2000 },
};

export function normalizePunctuationToken(token) {
    return token === '...' ? '…' : token;
}

export function splitSentenceByPunctuation(sentence) {
    const segments = [];
    const re = /(\.\.\.|…|[,;:!?.])/g;
    let lastIndex = 0;
    let match;

    while ((match = re.exec(sentence)) !== null) {
        const textChunk = sentence.slice(lastIndex, match.index).trim();
        if (textChunk) {
            segments.push({ type: 'text', value: textChunk });
        }
        const punct = normalizePunctuationToken(match[0]);
        if (PUNCTUATION_RULES[punct]) {
            segments.push({ type: 'punctuation', value: punct });
        }
        lastIndex = re.lastIndex;
    }

    const trailingText = sentence.slice(lastIndex).trim();
    if (trailingText) {
        segments.push({ type: 'text', value: trailingText });
    }

    return segments;
}

export function buildSentenceDictationText(sentence) {
    const segments = splitSentenceByPunctuation(sentence);
    const spokenParts = [];

    segments.forEach(segment => {
        if (segment.type === 'text') {
            spokenParts.push(segment.value);
            return;
        }
        const punctRule = PUNCTUATION_RULES[segment.value];
        if (punctRule) spokenParts.push(punctRule.speak);
    });

    return spokenParts.join(', ').replace(/\s+/g, ' ').trim();
}

export function getDictationSpeechSegments(texte) {
    const phrases = splitIntoSentences(texte);
    const dictationSegments = phrases.map(phrase => {
        const spoken = buildSentenceDictationText(phrase);
        return spoken || phrase;
    });
    return { phrases, dictationSegments };
}

async function speakSentenceWithPunctuation(sentence, speed) {
    const spokenSentence = buildSentenceDictationText(sentence) || sentence;
    await speakAsync(spokenSentence, speed);
}

// -----------------------------------------------
// Phase announcements
// -----------------------------------------------
function buildDicteeKeyPointsText(dictee) {
    const ruleTypeLabels = {
        accord: 'les accords',
        conjugaison: 'la conjugaison',
        homophones: 'les homophones',
        vocabulaire: 'le vocabulaire',
    };

    const types = [...new Set((dictee.regles || []).map(rule => rule.type))]
        .map(type => ruleTypeLabels[type] || type)
        .slice(0, 2);

    const focusWords = (dictee.regles || [])
        .slice(0, 2)
        .map(rule => (rule.mot || '').replace(/[«»"]/g, '').trim())
        .filter(Boolean);

    const parts = [];
    if (types.length > 0) parts.push(`Points clés : ${types.join(' et ')}`);
    if (focusWords.length > 0) parts.push(`mots à surveiller : ${focusWords.join(', ')}`);
    return parts.length > 0 ? `${parts.join('. ')}.` : '';
}

export function buildPhaseAnnouncements(dictee) {
    const signCount = dictee.texte.replace(/\s+/g, '').length;
    const keyPointsText = buildDicteeKeyPointsText(dictee);

    return {
        lecture1: `Phase un. Lecture intégrale. Écoutez le texte sans écrire. Le texte s'intitule ${dictee.titre}, de ${dictee.auteur}, environ ${signCount} signes sans les espaces. ${keyPointsText}`,
        dictee: "Phase deux. Dictée. Chaque phrase sera lue deux fois, en marquant et en annonçant la ponctuation. Écrivez pendant la dictée, puis relisez chaque phrase.",
        relecture: "Phase trois. Relecture. Le texte est relu une dernière fois, de façon continue, sans annoncer la ponctuation, pour vérifier et corriger votre copie.",
    };
}

// -----------------------------------------------
// Async control utilities
// -----------------------------------------------
export function wait(ms) {
    return new Promise((resolve, reject) => {
        const id = setTimeout(resolve, ms);
        const ctrl = state.abortController;
        if (ctrl) {
            const onAbort = () => { clearTimeout(id); reject(new Error('aborted')); };
            if (ctrl.signal.aborted) { onAbort(); return; }
            ctrl.signal.addEventListener('abort', onAbort, { once: true });
        }
    });
}

export function waitForResume() {
    return new Promise(resolve => {
        if (!state.isPaused) return resolve();
        const check = () => {
            if (!state.isPaused) return resolve();
            setTimeout(check, 200);
        };
        check();
    });
}

export function ensureActiveRun(runToken) {
    if (runToken !== state.activeRunToken) throw new Error('aborted');
}

// -----------------------------------------------
// Timer
// -----------------------------------------------
export function updateTimer() {
    if (!state.timerStart) return;
    const elapsed = Math.floor((Date.now() - state.timerStart) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    setTimerText(`${min}:${sec}`);
}

// -----------------------------------------------
// Phase 1 — Lecture intégrale
// -----------------------------------------------
export async function runLecture1(runToken) {
    ensureActiveRun(runToken);
    state.phase = 'lecture1';
    updatePhaseUI('lecture1');
    hideCurrentWordDisplay();
    hideWritingArea();

    const announcements = buildPhaseAnnouncements(state.currentDictee);
    state.skipLectureIntroRequested = false;
    setSkipLectureIntroVisible(true);

    try {
        await speakAsync(announcements.lecture1, 1.0);
        ensureActiveRun(runToken);
        if (!state.skipLectureIntroRequested) {
            await wait(1500);
            ensureActiveRun(runToken);
        }
    } finally {
        setSkipLectureIntroVisible(false);
    }

    ensureActiveRun(runToken);
    await waitForResume();
    ensureActiveRun(runToken);
    await speakAsync(state.currentDictee.texte, state.dicteeSpeed);
    ensureActiveRun(runToken);
    await wait(2000);
}

// -----------------------------------------------
// Phase 2 — Dictée effective (phrase par phrase)
// -----------------------------------------------
export async function runDictee(runToken) {
    ensureActiveRun(runToken);
    state.phase = 'dictee';
    updatePhaseUI('dictee');

    showWritingArea();
    showCurrentWordDisplay();

    const announcements = buildPhaseAnnouncements(state.currentDictee);
    await speakAsync(announcements.dictee, 1.0);
    ensureActiveRun(runToken);
    await wait(2000);
    ensureActiveRun(runToken);

    // Official Brevet protocol: dictée "phrase par phrase"
    const phrases = splitIntoSentences(state.currentDictee.texte);

    for (let i = 0; i < phrases.length; i++) {
        ensureActiveRun(runToken);
        state.currentGroupIndex = i;
        await waitForResume();
        ensureActiveRun(runToken);

        setPhaseCounter(`Phrase ${i + 1} / ${phrases.length}`);
        setCurrentWordText(phrases[i]);

        // First read
        state.currentRepeat = 0;
        setRepeatIndicator('1ère lecture');
        await speakSentenceWithPunctuation(phrases[i], state.dicteeSpeed);
        ensureActiveRun(runToken);
        await wait(2500);
        ensureActiveRun(runToken);

        await waitForResume();
        ensureActiveRun(runToken);

        // Second read
        state.currentRepeat = 1;
        setRepeatIndicator('2ème lecture');
        await speakSentenceWithPunctuation(phrases[i], state.dicteeSpeed);
        ensureActiveRun(runToken);
        await wait(3500);
    }

    hideCurrentWordDisplay();
    setCurrentWordText('');
    setRepeatIndicator('');
    setPhaseCounter('');

    ensureActiveRun(runToken);
    await wait(2000);
}

// -----------------------------------------------
// Phase 3 — Relecture finale
// -----------------------------------------------
export async function runRelecture(runToken) {
    ensureActiveRun(runToken);
    state.phase = 'relecture';
    updatePhaseUI('relecture');
    hideCurrentWordDisplay();

    const announcements = buildPhaseAnnouncements(state.currentDictee);
    await speakAsync(announcements.relecture, 1.0);
    ensureActiveRun(runToken);
    await wait(1500);
    ensureActiveRun(runToken);

    await waitForResume();
    ensureActiveRun(runToken);
    await speakAsync(state.currentDictee.texte, state.dicteeSpeed);
    ensureActiveRun(runToken);
    await wait(2000);
}

// -----------------------------------------------
// Exam orchestration
// -----------------------------------------------
export function finishExam() {
    state.phase = 'finished';
    updatePhaseUI('finished');
    state.examInProgress = false;
    state.skipTransitionInProgress = false;
    clearInterval(state.timerInterval);
    showFinishControls();
    stopAudio();
}

export function skipPhase() {
    if (state.skipTransitionInProgress) return;
    state.skipTransitionInProgress = true;
    state.examInProgress = true;

    stopAudio({ rejectCurrent: true, reason: 'aborted' });
    state.isPaused = false;

    if (state.abortController) state.abortController.abort();

    const runToken = ++state.activeRunToken;
    state.abortController = new AbortController();

    const finishSkipTransition = () => { state.skipTransitionInProgress = false; };

    if (state.phase === 'lecture1') {
        runDictee(runToken)
            .then(() => runRelecture(runToken))
            .then(finishExam)
            .catch(e => { if (e.message !== 'aborted') console.error(e); })
            .finally(finishSkipTransition);
    } else if (state.phase === 'dictee') {
        hideCurrentWordDisplay();
        runRelecture(runToken)
            .then(finishExam)
            .catch(e => { if (e.message !== 'aborted') console.error(e); })
            .finally(finishSkipTransition);
    } else if (state.phase === 'relecture') {
        finishExam();
        finishSkipTransition();
    } else {
        finishSkipTransition();
    }
}

export async function startExam() {
    if (state.examInProgress) {
        console.warn('[Exam] start ignored: exam already in progress');
        return;
    }

    if (!state.ttsAvailable) {
        setPhaseDescription('Serveur Kokoro indisponible. Lancez ./tts_server.sh puis rechargez la page.');
        return;
    }

    state.examInProgress = true;
    const runToken = ++state.activeRunToken;
    state.pregenSkipRequested = true;

    state.abortController = new AbortController();

    showExamControls();
    showTimerDisplay();

    state.timerStart = Date.now();
    state.timerInterval = setInterval(updateTimer, 1000);

    try {
        await runLecture1(runToken);
        await runDictee(runToken);
        await runRelecture(runToken);
        finishExam();
    } catch (e) {
        if (e.message === 'aborted') return;
        console.error('Exam flow error:', e);
    } finally {
        state.examInProgress = false;
    }
}
