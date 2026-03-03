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
//   autoSegmentSentence            — AI-like segmentation into word groups
//   getWordGroups                  — get word groups (manual or auto-generated)
//   buildDicteeKeyPointsText       — build TTS descriptor of key grammar points
//   buildPhaseAnnouncements        — build phase 1/2/3 spoken announcements
//   wait                           — abort-aware timer
//   waitForResume                  — poll for un-pause
//   ensureActiveRun                — runToken guard
//   updateTimer                    — update the elapsed timer display text
//   runLecture1                    — Phase 1: full reading
//   runDictee                      — Phase 2: group-by-group dictation
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

// -----------------------------------------------
// Intelligent word-group segmentation
// -----------------------------------------------

// Grammatical boundary patterns for French — ordered by priority
// These are points where a professor naturally pauses during dictation.
const GROUP_SPLIT_PATTERNS = [
    // Relative pronouns & subordinating conjunctions (clause boundaries)
    /\s+(?=(?:qui|que|qu'|dont|où|lorsque|lorsqu'|quand|puisque|puisqu'|parce qu[e']|bien qu[e']|alors qu[e']|tandis qu[e']|afin qu[e'])\s)/i,
    // Coordinating conjunctions
    /\s+(?=(?:et|mais|ou|donc|or|ni|car)\s)/i,
    // Prepositional phrases that start new semantic groups
    /\s+(?=(?:dans|avec|sans|pour|par|sur|sous|vers|après|avant|depuis|contre|entre|chez|devant|derrière|pendant|malgré|jusqu'à|jusqu'au)\s)/i,
];

const MIN_GROUP_WORDS = 3;
const MAX_GROUP_WORDS = 8;
const HARD_MAX_GROUP_WORDS = 10;

/**
 * Count words in a text fragment.
 */
function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Auto-segment a single sentence into natural word groups.
 * Strategy:
 *   1. Split at intra-sentence punctuation (commas, semicolons, colons)
 *   2. If any fragment > MAX_GROUP_WORDS, sub-split at grammatical boundaries
 *   3. If still > HARD_MAX_GROUP_WORDS, split at the midpoint nearest a function word
 *   4. Merge fragments < MIN_GROUP_WORDS with their neighbor
 */
export function autoSegmentSentence(sentence) {
    const trimmed = sentence.trim();
    if (!trimmed) return [];

    // Step 1: Split at internal punctuation (keep punctuation attached to preceding text)
    const punctSplit = trimmed.split(/(?<=[,;:])\s+/).map(s => s.trim()).filter(Boolean);

    // Step 2: Sub-split long fragments at grammatical boundaries
    let fragments = [];
    for (const frag of punctSplit) {
        if (wordCount(frag) <= MAX_GROUP_WORDS) {
            fragments.push(frag);
            continue;
        }
        // Try each pattern in priority order
        let subFrags = [frag];
        for (const pattern of GROUP_SPLIT_PATTERNS) {
            const newSubFrags = [];
            for (const sf of subFrags) {
                if (wordCount(sf) <= MAX_GROUP_WORDS) {
                    newSubFrags.push(sf);
                } else {
                    const parts = sf.split(pattern).map(s => s.trim()).filter(Boolean);
                    newSubFrags.push(...parts);
                }
            }
            subFrags = newSubFrags;
        }
        fragments.push(...subFrags);
    }

    // Step 3: Hard-split remaining oversize fragments at midpoint
    let result = [];
    for (const frag of fragments) {
        if (wordCount(frag) <= HARD_MAX_GROUP_WORDS) {
            result.push(frag);
        } else {
            const words = frag.split(/\s+/);
            const mid = Math.ceil(words.length / 2);
            result.push(words.slice(0, mid).join(' '));
            result.push(words.slice(mid).join(' '));
        }
    }

    // Step 4: Merge too-short fragments with neighbors
    const merged = [];
    for (let i = 0; i < result.length; i++) {
        if (merged.length > 0 && wordCount(result[i]) < MIN_GROUP_WORDS) {
            // Merge with previous
            merged[merged.length - 1] += ' ' + result[i];
        } else {
            merged.push(result[i]);
        }
    }
    // Check if last fragment is too short — merge backward
    if (merged.length > 1 && wordCount(merged[merged.length - 1]) < MIN_GROUP_WORDS) {
        const last = merged.pop();
        merged[merged.length - 1] += ' ' + last;
    }

    return merged;
}

/**
 * Get word groups for a dictée.
 * - Uses the manually curated `groupes` array if present.
 * - Otherwise auto-segments each sentence.
 * Returns an array of { sentenceIndex, groups[] } objects.
 */
export function getWordGroups(dictee) {
    const sentences = splitIntoSentences(dictee.texte);

    if (Array.isArray(dictee.groupes) && dictee.groupes.length > 0) {
        // Map manual groups back to sentences.
        // Strategy: walk through groups, assigning each to the sentence
        // whose text contains that group's words (in order).
        return mapGroupsToSentences(sentences, dictee.groupes);
    }

    // Auto-segment each sentence
    return sentences.map((sentence, idx) => ({
        sentenceIndex: idx,
        sentence,
        groups: autoSegmentSentence(sentence),
    }));
}

/**
 * Map pre-defined groups to their parent sentences.
 * Groups are expected to be in document order and cover the full text.
 */
function mapGroupsToSentences(sentences, groupes) {
    const result = [];
    let groupIdx = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentenceGroups = [];
        // Consume groups that belong to this sentence
        // A group belongs to sentence i if the sentence contains the group text
        // (normalized, ignoring leading/trailing punctuation for matching)
        let remaining = sentences[i];
        while (groupIdx < groupes.length) {
            const group = groupes[groupIdx].trim();
            // Normalize for matching: strip leading/trailing punctuation and spaces
            const groupCore = group.replace(/^[,;:.!?…\s]+|[,;:.!?…\s]+$/g, '');
            if (remaining.includes(groupCore)) {
                sentenceGroups.push(group);
                // Remove the matched portion from remaining to avoid double-matching
                const matchPos = remaining.indexOf(groupCore);
                remaining = remaining.slice(matchPos + groupCore.length);
                groupIdx++;
            } else {
                break;
            }
        }
        result.push({
            sentenceIndex: i,
            sentence: sentences[i],
            groups: sentenceGroups.length > 0 ? sentenceGroups : autoSegmentSentence(sentences[i]),
        });
    }

    return result;
}

/**
 * Build spoken text for a single word group, verbalizing any trailing punctuation.
 */
function buildGroupDictationText(group) {
    return buildSentenceDictationText(group) || group;
}

/**
 * Split an array of word groups into clause segments using any punctuation mark as a boundary.
 * A new segment starts immediately after a group whose text ends with a punctuation character.
 * The final group (including sentence-ending punctuation) always closes the last segment.
 *
 * @param {string[]} groups - word groups for a single sentence
 * @returns {string[][]} - array of segments, each segment is an array of word groups
 *
 * @example
 * // ['La mer', 'furieuse,', 'rugissait.'] → [['La mer', 'furieuse,'], ['rugissait.']]
 */
export function splitGroupsIntoClauseSegments(groups) {
    if (groups.length === 0) return [];

    const CLAUSE_PUNCT_RE = /[,;:…!?.]/;

    const segments = [];
    let current = [];

    for (const group of groups) {
        current.push(group);
        // If this group ends with any punctuation AND it is not the very last group,
        // close the current segment now.
        const trimmed = group.trimEnd();
        const lastChar = trimmed.slice(-1);
        const isLast = group === groups[groups.length - 1];
        if (CLAUSE_PUNCT_RE.test(lastChar) && !isLast) {
            segments.push(current);
            current = [];
        }
    }

    // Always push whatever remains (including the sentence-ending punctuation group)
    if (current.length > 0) {
        segments.push(current);
    }

    return segments;
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
        dictee: "Phase deux. Dictée. Chaque groupe de mots est lu une première fois, puis immédiatement répété une deuxième fois. Profitez de chaque répétition pour écrire et vérifier.",
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
// Phase 2 — Dictée effective (groupe par groupe)
// -----------------------------------------------

/**
 * Calculate an adaptive writing pause based on word count.
 * More words → more time to write. Clamped between 1.5s and 5s.
 */
function writingPauseMs(text) {
    const words = wordCount(text);
    const baseMs = 1200;
    const perWordMs = 400;
    return Math.min(5000, Math.max(1500, baseMs + words * perWordMs));
}

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

    // Build word groups organized by sentence
    const sentenceBlocks = getWordGroups(state.currentDictee);

    for (let i = 0; i < sentenceBlocks.length; i++) {
        const block = sentenceBlocks[i];
        const groups = block.groups;

        ensureActiveRun(runToken);
        state.currentGroupIndex = i;
        await waitForResume();
        ensureActiveRun(runToken);

        setPhaseCounter(`Phrase ${i + 1} / ${sentenceBlocks.length}`);

        // Split the sentence's word groups into clause segments.
        // Each segment ends at an intra-sentence punctuation mark (comma, semicolon, etc.)
        // so we repeat that smaller chunk immediately before moving on.
        const clauseSegments = splitGroupsIntoClauseSegments(groups);

        for (const segmentGroups of clauseSegments) {
            ensureActiveRun(runToken);
            await waitForResume();
            ensureActiveRun(runToken);

            // --- 1ère lecture du segment ---
            state.currentRepeat = 0;
            setRepeatIndicator('1ère lecture');

            for (const group of segmentGroups) {
                ensureActiveRun(runToken);
                await waitForResume();
                ensureActiveRun(runToken);

                setCurrentWordText(group);
                const spokenGroup = buildGroupDictationText(group);
                await speakAsync(spokenGroup, state.dicteeSpeed);
                ensureActiveRun(runToken);

                // Adaptive pause for writing after each group
                await wait(writingPauseMs(group));
                ensureActiveRun(runToken);
            }

            // Short pause between 1st and 2nd reading of this clause segment
            await wait(1500);
            ensureActiveRun(runToken);
            await waitForResume();
            ensureActiveRun(runToken);

            // --- 2ème lecture du segment ---
            state.currentRepeat = 1;
            setRepeatIndicator('2ème lecture');

            for (const group of segmentGroups) {
                ensureActiveRun(runToken);
                await waitForResume();
                ensureActiveRun(runToken);

                setCurrentWordText(group);
                const spokenGroup = buildGroupDictationText(group);
                await speakAsync(spokenGroup, state.dicteeSpeed);
                ensureActiveRun(runToken);

                // Slightly longer pause on 2nd read for corrections
                await wait(writingPauseMs(group) + 500);
                ensureActiveRun(runToken);
            }

            // Pause between clause segments within the same sentence
            await wait(2000);
            ensureActiveRun(runToken);
        }

        // Longer pause between sentences
        await wait(3000);
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
