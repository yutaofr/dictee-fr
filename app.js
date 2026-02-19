// =====================================================
// Dictée Brevet 2026 — Application principale
// TTS via Kokoro local (MLX), sans fallback navigateur
// =====================================================

(function () {
    'use strict';

    // -----------------------------------------------
    // State
    // -----------------------------------------------
    const state = {
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

    // -----------------------------------------------
    // DOM References
    // -----------------------------------------------
    const $ = id => document.getElementById(id);

    const dom = {
        navAccueil: $('nav-accueil'),
        navExamen: $('nav-examen'),
        navCorrection: $('nav-correction'),
        sectionAccueil: $('section-accueil'),
        sectionExamen: $('section-examen'),
        sectionCorrection: $('section-correction'),
        dicteeGrid: $('dictee-grid'),
        phaseTitle: $('phase-title'),
        phaseDescription: $('phase-description'),
        phaseIcon: $('phase-icon'),
        phaseCounter: $('phase-counter'),
        phaseDots: document.querySelectorAll('.phase-dot'),
        currentWordDisplay: $('current-word-display'),
        currentWordText: $('current-word-text'),
        currentWordLabel: $('current-word-label'),
        repeatIndicator: $('repeat-indicator'),
        voiceSelect: $('voice-select'),
        speedRange: $('speed-range'),
        speedValue: $('speed-value'),
        btnStart: $('btn-start'),
        btnSkipLectureIntro: $('btn-skip-lecture-intro'),
        btnSkipPregen: $('btn-skip-pregen'),
        btnPause: $('btn-pause'),
        btnResume: $('btn-resume'),
        btnSkipPhase: $('btn-skip-phase'),
        btnFinish: $('btn-finish'),
        writingArea: $('writing-area'),
        studentText: $('student-text'),
        timerDisplay: $('timer-display'),
        timerText: $('timer-text'),
        correctionTitle: $('correction-dictee-title'),
        tabComparaison: $('tab-comparaison'),
        tabRegles: $('tab-regles'),
        tabPrononciation: $('tab-prononciation'),
        tabContentComparaison: $('tab-content-comparaison'),
        tabContentRegles: $('tab-content-regles'),
        tabContentPrononciation: $('tab-content-prononciation'),
        studentTextDisplay: $('student-text-display'),
        originalTextDisplay: $('original-text-display'),
        diffScore: $('diff-score'),
        diffDetails: $('diff-details'),
        rulesList: $('rules-list'),
        prononciationText: $('prononciation-text'),
        wordInfoPanel: $('word-info-panel'),
        wordInfoTitle: $('word-info-title'),
        wordInfoContent: $('word-info-content'),
        btnHearWord: $('btn-hear-word'),
        btnNewDictee: $('btn-new-dictee'),
    };

    // -----------------------------------------------
    // Initialize
    // -----------------------------------------------
    function init() {
        renderDicteeGrid();
        setupVoiceSelector();
        bindEvents();
        setupSpeedSlider();
        checkBackendHealth();
    }

    // -----------------------------------------------
    // Backend Health Check
    // -----------------------------------------------
    async function checkBackendHealth() {
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                const data = await res.json();
                if (!data.ttsReachable) {
                    throw new Error('Kokoro server unreachable');
                }
                console.log('[TTS] Backend Kokoro disponible:', data);
                state.ttsAvailable = true;
                dom.voiceSelect.disabled = false;
            } else {
                throw new Error('Backend not ok');
            }
        } catch (e) {
            state.ttsAvailable = false;
            dom.voiceSelect.disabled = true;
            console.error('[TTS] Backend Kokoro indisponible:', e.message);
        }
    }

    // -----------------------------------------------
    // Speed Slider
    // -----------------------------------------------
    function setupSpeedSlider() {
        if (!dom.speedRange) return;

        // Global reading speed applied to all exam reading cycles.
        dom.speedRange.value = state.dicteeSpeed;
        if (dom.speedValue) {
            dom.speedValue.textContent = `${state.dicteeSpeed.toFixed(2)}x`;
        }

        dom.speedRange.addEventListener('input', () => {
            const val = parseFloat(dom.speedRange.value);
            state.dicteeSpeed = val;
            if (dom.speedValue) {
                dom.speedValue.textContent = `${val.toFixed(2)}x`;
            }
            console.log('[UI] Reading speed adjusted:', val);
        });
    }

    // -----------------------------------------------
    // Voice Selector
    // -----------------------------------------------
    function setupVoiceSelector() {
        dom.voiceSelect.innerHTML = '';
        const kokoroOpt = document.createElement('option');
        kokoroOpt.value = 'kokoro_ff_siwis';
        kokoroOpt.textContent = '🎙️ Kokoro MLX — ff_siwis (Français)';
        kokoroOpt.selected = true;
        dom.voiceSelect.appendChild(kokoroOpt);
        dom.voiceSelect.disabled = true;
    }

    // -----------------------------------------------
    // TTS Engine — Kokoro (via backend)
    // -----------------------------------------------
    async function fetchTTSAudio(text, speed = 1.0) {
        // Check cache
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

    function playAudio(blobUrl, playbackRate = 1.0) {
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

            audio.onerror = (e) => {
                if (state.currentAudio !== audio) return;
                state.isSpeaking = false;
                state.currentAudio = null;
                state.currentAudioResolve = null;
                state.currentAudioReject = null;
                reject(new Error('Audio playback failed'));
            };

            // Handle abort
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

    function stopAudio({ rejectCurrent = false, reason = 'aborted' } = {}) {
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
    async function speakAsync(text, speed = 1.0) {
        if (!state.ttsAvailable) {
            throw new Error('Kokoro server unavailable');
        }
        // Keep model generation at stable rate and adjust playback on client side.
        const blobUrl = await fetchTTSAudio(text, 1.0);
        await playAudio(blobUrl, speed);
    }

    function speakWord(word) {
        if (!state.ttsAvailable) return;
        fetchTTSAudio(word, 1.0)
            .then(url => playAudio(url, 0.8))
            .catch(e => {
                console.warn('[TTS] Word synthesis failed:', e.message);
            });
    }

    // -----------------------------------------------
    // Sentence splitting (official Brevet protocol: "phrase par phrase")
    // -----------------------------------------------
    function splitIntoSentences(texte) {
        // Split on sentence-ending punctuation (.!?) followed by space or end
        // Keep the punctuation with the sentence
        return texte
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    const OFFICIAL_DICTEE_SIGNS_GENERAL = 600;

    function countSignsWithoutSpaces(text) {
        return text.replace(/\s+/g, '').length;
    }

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
        if (types.length > 0) {
            parts.push(`Points clés : ${types.join(' et ')}`);
        }
        if (focusWords.length > 0) {
            parts.push(`mots à surveiller : ${focusWords.join(', ')}`);
        }
        return parts.length > 0 ? `${parts.join('. ')}.` : '';
    }

    function buildPhaseAnnouncements(dictee) {
        const signCount = countSignsWithoutSpaces(dictee.texte);
        const keyPointsText = buildDicteeKeyPointsText(dictee);

        return {
            lecture1: `Phase un. Lecture intégrale. Écoutez le texte sans écrire. Le texte s'intitule ${dictee.titre}, de ${dictee.auteur}, environ ${signCount} signes sans les espaces. ${keyPointsText}`,
            dictee: "Phase deux. Dictée. Chaque phrase sera lue deux fois, en marquant et en annonçant la ponctuation. Écrivez pendant la dictée, puis relisez chaque phrase.",
            relecture: "Phase trois. Relecture. Le texte est relu une dernière fois, de façon continue, sans annoncer la ponctuation, pour vérifier et corriger votre copie.",
        };
    }

    const PUNCTUATION_RULES = {
        ',': { speak: 'virgule', pauseMs: 1100 },
        ';': { speak: 'point-virgule', pauseMs: 1400 },
        ':': { speak: 'deux-points', pauseMs: 1400 },
        '.': { speak: 'point', pauseMs: 1800 },
        '?': { speak: "point d'interrogation", pauseMs: 1800 },
        '!': { speak: "point d'exclamation", pauseMs: 1800 },
        '…': { speak: 'points de suspension', pauseMs: 2000 },
    };

    function normalizePunctuationToken(token) {
        return token === '...' ? '…' : token;
    }

    function splitSentenceByPunctuation(sentence) {
        const segments = [];
        const punctuationRegex = /(\.{3}|…|[,;:!?.])/g;

        let lastIndex = 0;
        let match;
        while ((match = punctuationRegex.exec(sentence)) !== null) {
            const textChunk = sentence.slice(lastIndex, match.index).trim();
            if (textChunk) {
                segments.push({ type: 'text', value: textChunk });
            }

            const punct = normalizePunctuationToken(match[0]);
            if (PUNCTUATION_RULES[punct]) {
                segments.push({ type: 'punctuation', value: punct });
            }

            lastIndex = punctuationRegex.lastIndex;
        }

        const trailingText = sentence.slice(lastIndex).trim();
        if (trailingText) {
            segments.push({ type: 'text', value: trailingText });
        }

        return segments;
    }

    function buildSentenceDictationText(sentence) {
        const segments = splitSentenceByPunctuation(sentence);
        const spokenParts = [];

        segments.forEach(segment => {
            if (segment.type === 'text') {
                spokenParts.push(segment.value);
                return;
            }

            const punctRule = PUNCTUATION_RULES[segment.value];
            if (punctRule) {
                spokenParts.push(punctRule.speak);
            }
        });

        return spokenParts.join(', ').replace(/\s+/g, ' ').trim();
    }

    function getDictationSpeechSegments(texte) {
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
    // Audio Pre-generation
    // -----------------------------------------------
    async function pregenerate(dictee) {
        if (!state.ttsAvailable) return;

        state.pregenInProgress = true;
        state.pregenSkipRequested = false;

        const announcements = buildPhaseAnnouncements(dictee);
        const { dictationSegments } = getDictationSpeechSegments(dictee.texte);

        const segments = [
            // Phase announcements
            announcements.lecture1,
            dictee.texte,
            announcements.dictee,
            ...dictationSegments,
            announcements.relecture,
        ];

        state.pregenTotal = segments.length;
        state.pregenProgress = 0;

        console.log(`[TTS] Pre-generating ${segments.length} audio segments...`);
        dom.phaseDescription.textContent = `Pré-génération audio en cours... 0/${segments.length}`;

        for (let i = 0; i < segments.length; i++) {
            if (state.pregenSkipRequested) {
                console.log('[TTS] Pre-generation skipped by user');
                dom.phaseDescription.textContent = 'Pré-génération interrompue. Vous pouvez commencer sans attendre.';
                dom.phaseCounter.textContent = '⏭️';
                break;
            }

            try {
                await fetchTTSAudio(segments[i], 1.0);
                state.pregenProgress = i + 1;
                dom.phaseDescription.textContent = `Pré-génération audio en cours... ${i + 1}/${segments.length}`;
                dom.phaseCounter.textContent = `${Math.round((i + 1) / segments.length * 100)}%`;
            } catch (e) {
                console.warn(`[TTS] Pre-gen segment ${i} failed:`, e.message);
            }
        }

        if (!state.pregenSkipRequested) {
            console.log('[TTS] Pre-generation complete');
            dom.phaseDescription.textContent = 'Audio prêt ! Cliquez sur « Commencer » pour démarrer.';
            dom.phaseCounter.textContent = '✅';
        }

        state.pregenInProgress = false;
    }

    // -----------------------------------------------
    // Wait utility
    // -----------------------------------------------
    function wait(ms) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(resolve, ms);
            const activeAbortController = state.abortController;
            if (activeAbortController) {
                const onAbort = () => {
                    clearTimeout(id);
                    reject(new Error('aborted'));
                };

                if (activeAbortController.signal.aborted) {
                    onAbort();
                    return;
                }

                activeAbortController.signal.addEventListener('abort', onAbort, { once: true });
            }
        });
    }

    function waitForResume() {
        return new Promise(resolve => {
            if (!state.isPaused) return resolve();
            const check = () => {
                if (!state.isPaused) return resolve();
                setTimeout(check, 200);
            };
            check();
        });
    }

    function ensureActiveRun(runToken) {
        if (runToken !== state.activeRunToken) {
            throw new Error('aborted');
        }
    }

    // -----------------------------------------------
    // Render Dictée Grid
    // -----------------------------------------------
    function renderDicteeGrid() {
        dom.dicteeGrid.innerHTML = '';
        const diffLabels = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' };

        window.DICTEES.forEach(dictee => {
            const card = document.createElement('div');
            card.className = 'dictee-card';
            card.innerHTML = `
        <div class="card-header">
          <h4>${dictee.titre}</h4>
          <span class="difficulty-badge difficulty-${dictee.difficulte}">${diffLabels[dictee.difficulte]}</span>
        </div>
        <p class="card-meta">${dictee.auteur} — <em>${dictee.oeuvre}</em> (${dictee.annee})</p>
        <span class="card-theme">${dictee.theme}</span>
        <p class="card-preview">« ${dictee.texte.substring(0, 120)}… »</p>
        <div class="card-footer">
          <span class="card-rules-count">${dictee.regles.length} points de grammaire</span>
          <span class="card-start-btn">Commencer →</span>
        </div>
      `;
            card.addEventListener('click', () => selectDictee(dictee));
            dom.dicteeGrid.appendChild(card);
        });
    }

    // -----------------------------------------------
    // Navigation
    // -----------------------------------------------
    function switchSection(name) {
        ['accueil', 'examen', 'correction'].forEach(s => {
            const section = document.getElementById('section-' + s);
            const nav = document.getElementById('nav-' + s);
            if (s === name) {
                section.classList.add('active');
                nav.classList.add('active');
            } else {
                section.classList.remove('active');
                nav.classList.remove('active');
            }
        });
    }

    // -----------------------------------------------
    // Select Dictée
    // -----------------------------------------------
    async function selectDictee(dictee) {
        state.currentDictee = dictee;
        state.phase = 'idle';
        state.currentGroupIndex = 0;
        state.currentRepeat = 0;
        state.isPaused = false;

        dom.navExamen.disabled = false;
        switchSection('examen');

        // Reset UI
        dom.btnStart.style.display = '';
        dom.btnSkipLectureIntro.style.display = 'none';
        dom.btnSkipPregen.style.display = '';
        dom.btnSkipPregen.disabled = false;
        dom.btnPause.style.display = 'none';
        dom.btnResume.style.display = 'none';
        dom.btnSkipPhase.style.display = 'none';
        dom.btnFinish.style.display = 'none';
        dom.btnStart.disabled = true;
        state.skipLectureIntroRequested = false;
        dom.writingArea.style.display = 'none';
        dom.currentWordDisplay.style.display = 'none';
        dom.timerDisplay.style.display = 'none';
        dom.studentText.value = '';

        updatePhaseUI('idle');

        // Pre-generate audio segments
        try {
            await pregenerate(dictee);
        } finally {
            dom.btnStart.disabled = !state.ttsAvailable;
            dom.btnSkipLectureIntro.style.display = 'none';
            dom.btnSkipPregen.style.display = 'none';
        }
    }

    // -----------------------------------------------
    // Phase UI
    // -----------------------------------------------
    function updatePhaseUI(phase) {
        const configs = {
            idle: {
                icon: '📚',
                title: `${state.currentDictee.titre}`,
                desc: `${state.currentDictee.auteur} — Préparation en cours...`,
                dots: [false, false, false]
            },
            lecture1: {
                icon: '🔊',
                title: 'Phase 1 — Lecture intégrale',
                desc: 'Écoutez attentivement sans écrire. Comprenez le sens général du texte.',
                dots: [true, false, false]
            },
            dictee: {
                icon: '✍️',
                title: 'Phase 2 — Dictée',
                desc: 'Écrivez le texte dicté. Chaque phrase est lue deux fois avec ponctuation annoncée.',
                dots: [true, true, false]
            },
            relecture: {
                icon: '👁️',
                title: 'Phase 3 — Relecture',
                desc: 'Dernière écoute. Relisez et corrigez votre copie.',
                dots: [true, true, true]
            },
            finished: {
                icon: '✅',
                title: 'Dictée terminée',
                desc: 'Vous pouvez maintenant passer à la correction.',
                dots: [true, true, true]
            }
        };

        const cfg = configs[phase];
        dom.phaseIcon.textContent = cfg.icon;
        dom.phaseTitle.textContent = cfg.title;
        dom.phaseDescription.textContent = cfg.desc;

        dom.phaseDots.forEach((dot, i) => {
            dot.classList.toggle('active', cfg.dots[i] && i === cfg.dots.lastIndexOf(true));
            dot.classList.toggle('done', cfg.dots[i] && i < cfg.dots.lastIndexOf(true));
        });
    }

    // -----------------------------------------------
    // Exam Flow
    // -----------------------------------------------
    async function startExam() {
        if (state.examInProgress) {
            console.warn('[Exam] start ignored: exam already in progress');
            return;
        }

        if (!state.ttsAvailable) {
            dom.phaseDescription.textContent = 'Serveur Kokoro indisponible. Lancez ./tts_server.sh puis rechargez la page.';
            return;
        }

        state.examInProgress = true;
        const runToken = ++state.activeRunToken;
        state.pregenSkipRequested = true;
        dom.btnSkipLectureIntro.style.display = 'none';
        dom.btnSkipPregen.style.display = 'none';

        state.abortController = new AbortController();

        dom.btnStart.style.display = 'none';
        dom.btnPause.style.display = '';
        dom.btnSkipPhase.style.display = '';
        dom.timerDisplay.style.display = '';

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

    async function runLecture1(runToken) {
        ensureActiveRun(runToken);
        state.phase = 'lecture1';
        updatePhaseUI('lecture1');
        dom.currentWordDisplay.style.display = 'none';
        dom.writingArea.style.display = 'none';

        const announcements = buildPhaseAnnouncements(state.currentDictee);
        state.skipLectureIntroRequested = false;
        dom.btnSkipLectureIntro.style.display = '';
        dom.btnSkipLectureIntro.disabled = false;

        try {
            await speakAsync(announcements.lecture1, 1.0);
            ensureActiveRun(runToken);
            if (!state.skipLectureIntroRequested) {
                await wait(1500);
                ensureActiveRun(runToken);
            }
        } finally {
            dom.btnSkipLectureIntro.style.display = 'none';
        }

        ensureActiveRun(runToken);
        await waitForResume();
        ensureActiveRun(runToken);
        await speakAsync(state.currentDictee.texte, state.dicteeSpeed);
        ensureActiveRun(runToken);
        await wait(2000);
    }

    async function runDictee(runToken) {
        ensureActiveRun(runToken);
        state.phase = 'dictee';
        updatePhaseUI('dictee');

        dom.writingArea.style.display = '';
        dom.currentWordDisplay.style.display = '';
        dom.currentWordDisplay.classList.add('active');

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

            dom.phaseCounter.textContent = `Phrase ${i + 1} / ${phrases.length}`;
            dom.currentWordText.textContent = phrases[i];

            // First read
            state.currentRepeat = 0;
            dom.repeatIndicator.textContent = '1ère lecture';
            dom.currentWordLabel.textContent = 'Phrase actuelle :';
            await speakSentenceWithPunctuation(phrases[i], state.dicteeSpeed);
            ensureActiveRun(runToken);
            await wait(2500);
            ensureActiveRun(runToken);

            await waitForResume();
            ensureActiveRun(runToken);

            // Second read
            state.currentRepeat = 1;
            dom.repeatIndicator.textContent = '2ème lecture';
            await speakSentenceWithPunctuation(phrases[i], state.dicteeSpeed);
            ensureActiveRun(runToken);
            await wait(3500);
        }

        dom.currentWordDisplay.classList.remove('active');
        dom.currentWordText.textContent = '';
        dom.repeatIndicator.textContent = '';
        dom.phaseCounter.textContent = '';

        ensureActiveRun(runToken);
        await wait(2000);
    }

    async function runRelecture(runToken) {
        ensureActiveRun(runToken);
        state.phase = 'relecture';
        updatePhaseUI('relecture');
        dom.currentWordDisplay.style.display = 'none';

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

    function finishExam() {
        state.phase = 'finished';
        updatePhaseUI('finished');
        state.examInProgress = false;
        state.skipTransitionInProgress = false;

        clearInterval(state.timerInterval);

        dom.btnPause.style.display = 'none';
        dom.btnResume.style.display = 'none';
        dom.btnSkipPhase.style.display = 'none';
        dom.btnFinish.style.display = '';
        dom.currentWordDisplay.style.display = 'none';

        stopAudio();
    }

    function skipPhase() {
        if (state.skipTransitionInProgress) return;
        state.skipTransitionInProgress = true;
        state.examInProgress = true;

        stopAudio({ rejectCurrent: true, reason: 'aborted' });
        state.isPaused = false;

        if (state.abortController) {
            state.abortController.abort();
        }

        const runToken = ++state.activeRunToken;
        state.abortController = new AbortController();

        const finishSkipTransition = () => {
            state.skipTransitionInProgress = false;
        };

        if (state.phase === 'lecture1') {
            runDictee(runToken).then(() => runRelecture(runToken)).then(finishExam).catch(e => {
                if (e.message !== 'aborted') console.error(e);
            }).finally(finishSkipTransition);
        } else if (state.phase === 'dictee') {
            dom.currentWordDisplay.classList.remove('active');
            runRelecture(runToken).then(finishExam).catch(e => {
                if (e.message !== 'aborted') console.error(e);
            }).finally(finishSkipTransition);
        } else if (state.phase === 'relecture') {
            finishExam();
            finishSkipTransition();
        } else {
            finishSkipTransition();
        }
    }

    // -----------------------------------------------
    // Timer
    // -----------------------------------------------
    function updateTimer() {
        if (!state.timerStart) return;
        const elapsed = Math.floor((Date.now() - state.timerStart) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        dom.timerText.textContent = `${min}:${sec}`;
    }

    // -----------------------------------------------
    // Correction (unchanged)
    // -----------------------------------------------
    function goToCorrection() {
        dom.navCorrection.disabled = false;
        switchSection('correction');

        const dictee = state.currentDictee;
        dom.correctionTitle.textContent = `${dictee.titre} — ${dictee.auteur}`;

        const studentText = dom.studentText.value.trim();
        dom.studentTextDisplay.textContent = studentText || '(Aucun texte saisi)';
        dom.originalTextDisplay.textContent = dictee.texte;

        runDiff(studentText, dictee.texte);
        renderRules(dictee.regles);
        renderPrononciation(dictee);
    }

    function runDiff(studentText, originalText) {
        if (!studentText) {
            dom.diffScore.innerHTML = '<span class="score-ok">Aucun texte saisi — relisez le texte original ci-dessous.</span>';
            dom.diffDetails.innerHTML = '';
            return;
        }

        const normalize = t => t.replace(/[\u2018\u2019']/g, "'")
            .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
            .replace(/\s+/g, ' ')
            .trim();

        const studentWords = normalize(studentText).split(' ');
        const originalWords = normalize(originalText).split(' ');

        let correct = 0;
        let errors = [];
        const maxLen = Math.max(studentWords.length, originalWords.length);

        for (let i = 0; i < maxLen; i++) {
            const sw = (studentWords[i] || '').toLowerCase().replace(/[.,;:!?\u2026]/g, '');
            const ow = (originalWords[i] || '').toLowerCase().replace(/[.,;:!?\u2026]/g, '');

            if (sw === ow) {
                correct++;
            } else {
                errors.push({
                    position: i,
                    student: studentWords[i] || '—',
                    original: originalWords[i] || '(manquant)'
                });
            }
        }

        const totalWords = originalWords.length;
        const errorCount = errors.length;
        const faultPoints = errorCount * 0.25;
        const score = Math.max(0, 10 - faultPoints);

        let scoreClass = 'score-good';
        if (score < 5) scoreClass = 'score-bad';
        else if (score < 8) scoreClass = 'score-ok';

        dom.diffScore.innerHTML = `
      <span class="${scoreClass}">${score.toFixed(1)} / 10</span>
      <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-light); margin-left: 1rem;">
        ${correct}/${totalWords} mots corrects — ${errorCount} faute${errorCount > 1 ? 's' : ''} (-${faultPoints.toFixed(2)} pts)
      </span>
    `;

        if (errors.length === 0) {
            dom.diffDetails.innerHTML = '<p style="color: var(--success); font-weight: 600;">🎉 Bravo ! Aucune erreur détectée !</p>';
        } else {
            let html = '<h4 style="margin-bottom: 0.75rem;">Erreurs détectées :</h4><ul style="list-style: none; padding: 0;">';
            errors.forEach(err => {
                html += `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.06);">
            <span class="diff-word-error">${err.student}</span>
            → <span class="diff-word-correct">${err.original}</span>
            <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 0.5rem;">(mot n°${err.position + 1})</span>
          </li>
        `;
            });
            html += '</ul>';
            dom.diffDetails.innerHTML = html;
        }
    }

    // -----------------------------------------------
    // Rules
    // -----------------------------------------------
    function renderRules(regles) {
        dom.rulesList.innerHTML = '';

        regles.forEach(rule => {
            const card = document.createElement('div');
            card.className = `rule-card type-${rule.type}`;
            card.innerHTML = `
        <div class="rule-header">
          <span class="rule-word">${rule.mot}</span>
          <span class="rule-type-badge type-${rule.type}">${rule.type}</span>
        </div>
        <p class="rule-explanation">${rule.explication}</p>
        <button class="btn btn-small btn-outline btn-hear-rule" data-word="${rule.mot}">🔊 Écouter</button>
      `;

            card.querySelector('.btn-hear-rule').addEventListener('click', () => {
                speakWord(rule.mot);
            });

            dom.rulesList.appendChild(card);
        });
    }

    // -----------------------------------------------
    // Prononciation
    // -----------------------------------------------
    function renderPrononciation(dictee) {
        const difficultWords = new Set(dictee.regles.map(r => {
            return r.mot.split(' ')[0].toLowerCase().replace(/[.,;:!?\u2026]/g, '');
        }));

        const words = dictee.texte.split(/(\s+)/);
        let html = '';

        words.forEach(w => {
            if (/^\s+$/.test(w)) {
                html += w;
                return;
            }
            const clean = w.toLowerCase().replace(/[.,;:!?\u2026«»"']/g, '');
            const isDifficult = difficultWords.has(clean);
            html += `<span class="word${isDifficult ? ' difficult' : ''}" data-word="${w}">${w}</span>`;
        });

        dom.prononciationText.innerHTML = html;

        dom.prononciationText.querySelectorAll('.word').forEach(el => {
            el.addEventListener('click', () => {
                const word = el.dataset.word;
                speakWord(word);

                dom.prononciationText.querySelectorAll('.word.speaking').forEach(s => s.classList.remove('speaking'));
                el.classList.add('speaking');

                const rule = dictee.regles.find(r =>
                    r.mot.toLowerCase().includes(word.toLowerCase().replace(/[.,;:!?\u2026«»"']/g, ''))
                );

                if (rule) {
                    dom.wordInfoPanel.style.display = '';
                    dom.wordInfoTitle.textContent = rule.mot;
                    dom.wordInfoContent.textContent = rule.explication;
                    dom.btnHearWord.onclick = () => speakWord(rule.mot);
                } else {
                    dom.wordInfoPanel.style.display = 'none';
                }
            });
        });
    }

    // -----------------------------------------------
    // Event Bindings
    // -----------------------------------------------
    function bindEvents() {
        dom.navAccueil.addEventListener('click', () => {
            stopAudio();
            if (state.abortController) {
                state.abortController.abort();
            }
            state.abortController = null;
            state.examInProgress = false;
            state.skipTransitionInProgress = false;
            state.activeRunToken += 1;
            clearInterval(state.timerInterval);
            switchSection('accueil');
        });
        dom.navExamen.addEventListener('click', () => switchSection('examen'));
        dom.navCorrection.addEventListener('click', () => {
            if (state.currentDictee) switchSection('correction');
        });

        dom.btnStart.addEventListener('click', startExam);

        dom.btnSkipLectureIntro.addEventListener('click', () => {
            if (state.phase !== 'lecture1') return;
            state.skipLectureIntroRequested = true;
            dom.btnSkipLectureIntro.disabled = true;
            dom.phaseDescription.textContent = 'Introduction passée. Début de la lecture du texte...';
            stopAudio();
        });

        dom.btnSkipPregen.addEventListener('click', () => {
            if (!state.pregenInProgress) return;
            state.pregenSkipRequested = true;
            dom.btnSkipPregen.disabled = true;
            dom.btnStart.disabled = !state.ttsAvailable;
            dom.phaseDescription.textContent = 'Arrêt de la pré-génération en cours...';
            dom.phaseCounter.textContent = '⏭️';
        });

        dom.btnPause.addEventListener('click', () => {
            state.isPaused = true;
            if (state.currentAudio) {
                state.currentAudio.pause();
            }
            dom.btnPause.style.display = 'none';
            dom.btnResume.style.display = '';
        });

        dom.btnResume.addEventListener('click', () => {
            state.isPaused = false;
            if (state.currentAudio) {
                state.currentAudio.play();
            }
            dom.btnResume.style.display = 'none';
            dom.btnPause.style.display = '';
        });

        dom.btnSkipPhase.addEventListener('click', skipPhase);
        dom.btnFinish.addEventListener('click', goToCorrection);

        [dom.tabComparaison, dom.tabRegles, dom.tabPrononciation].forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-content-' + btn.dataset.tab).classList.add('active');
            });
        });

        dom.btnNewDictee.addEventListener('click', () => {
            stopAudio();
            clearInterval(state.timerInterval);
            if (state.abortController) {
                state.abortController.abort();
            }
            state.abortController = null;
            state.pregenSkipRequested = true;
            state.pregenInProgress = false;
            state.skipLectureIntroRequested = false;
            state.skipTransitionInProgress = false;
            state.examInProgress = false;
            state.activeRunToken += 1;
            dom.btnSkipLectureIntro.style.display = 'none';
            // Clear audio cache
            state.audioCache.forEach(url => URL.revokeObjectURL(url));
            state.audioCache.clear();
            dom.navExamen.disabled = true;
            dom.navCorrection.disabled = true;
            switchSection('accueil');
        });
    }

    // -----------------------------------------------
    // Boot
    // -----------------------------------------------
    document.addEventListener('DOMContentLoaded', init);
})();
