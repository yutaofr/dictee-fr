// =====================================================
// Dictée Brevet 2026 — Application principale
// TTS via Qwen3-TTS (Hugging Face) avec fallback Web Speech API
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
        baseRate: 0.9,
        dicteeSpeed: 0.85,
        abortController: null,
        // TTS
        ttsMode: 'qwen3tts', // 'qwen3tts' | 'browser'
        currentAudio: null,  // current Audio object
        audioCache: new Map(), // text → blob URL cache
        pregenProgress: 0,
        pregenTotal: 0,
        // Browser TTS fallback
        synth: window.speechSynthesis,
        selectedVoice: null,
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
                console.log('[TTS] Backend Qwen3-TTS disponible:', data);
                state.ttsMode = 'qwen3tts';
                updateVoiceSelectorForMode();
            } else {
                throw new Error('Backend not ok');
            }
        } catch (e) {
            console.warn('[TTS] Backend Qwen3-TTS indisponible, fallback sur Web Speech API');
            state.ttsMode = 'browser';
            updateVoiceSelectorForMode();
        }
    }

    // -----------------------------------------------
    // Speed Slider
    // -----------------------------------------------
    function setupSpeedSlider() {
        if (!dom.speedRange) return;

        // Initialize slider with state value
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
            console.log('[UI] Dictation speed adjusted:', val);
        });
    }

    // -----------------------------------------------
    // Voice Selector
    // -----------------------------------------------
    function setupVoiceSelector() {
        // Add Qwen3-TTS local option first
        const qwenOpt = document.createElement('option');
        qwenOpt.value = 'qwen3tts';
        qwenOpt.textContent = '🎙️ Kokoro TTS (Local MLX) — Naturelle & Expressive';
        qwenOpt.selected = true;
        dom.voiceSelect.appendChild(qwenOpt);

        // Separator
        const sep = document.createElement('option');
        sep.disabled = true;
        sep.textContent = '── Voix système (fallback) ──';
        dom.voiceSelect.appendChild(sep);

        // Load browser voices
        loadBrowserVoices();
        if (state.synth.onvoiceschanged !== undefined) {
            state.synth.onvoiceschanged = loadBrowserVoices;
        }

        dom.voiceSelect.addEventListener('change', () => {
            const val = dom.voiceSelect.value;
            if (val === 'qwen3tts') {
                state.ttsMode = 'qwen3tts';
            } else {
                state.ttsMode = 'browser';
                const voices = state.synth.getVoices().filter(v => v.lang.startsWith('fr'));
                state.selectedVoice = voices[parseInt(val)] || voices[0];
            }
            console.log('[TTS] Mode:', state.ttsMode);
        });
    }

    function loadBrowserVoices() {
        const voices = state.synth.getVoices();
        const frenchVoices = voices.filter(v => v.lang.startsWith('fr'));

        // Remove old browser voice options (keep melotts and separator)
        while (dom.voiceSelect.children.length > 2) {
            dom.voiceSelect.removeChild(dom.voiceSelect.lastChild);
        }

        frenchVoices.sort((a, b) => {
            if (a.localService && !b.localService) return -1;
            if (!a.localService && b.localService) return 1;
            return a.name.localeCompare(b.name);
        });

        frenchVoices.forEach((voice, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${voice.name} (${voice.lang})${voice.localService ? ' ★' : ''}`;
            dom.voiceSelect.appendChild(opt);
        });

        if (frenchVoices.length > 0) {
            state.selectedVoice = frenchVoices[0];
        }
    }

    function updateVoiceSelectorForMode() {
        if (state.ttsMode === 'qwen3tts') {
            dom.voiceSelect.value = 'qwen3tts';
        }
    }

    // -----------------------------------------------
    // TTS Engine — Qwen3-TTS (via backend)
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

    function playAudio(blobUrl) {
        return new Promise((resolve, reject) => {
            stopAudio();

            const audio = new Audio(blobUrl);
            state.currentAudio = audio;
            state.isSpeaking = true;

            audio.onended = () => {
                state.isSpeaking = false;
                state.currentAudio = null;
                resolve();
            };

            audio.onerror = (e) => {
                state.isSpeaking = false;
                state.currentAudio = null;
                reject(new Error('Audio playback failed'));
            };

            // Handle abort
            if (state.abortController) {
                state.abortController.signal.addEventListener('abort', () => {
                    audio.pause();
                    audio.currentTime = 0;
                    state.isSpeaking = false;
                    state.currentAudio = null;
                    reject(new Error('aborted'));
                });
            }

            audio.play().catch(reject);
        });
    }

    function stopAudio() {
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio.currentTime = 0;
            state.currentAudio = null;
        }
        state.isSpeaking = false;
        // Also stop browser TTS if active
        state.synth.cancel();
    }

    // -----------------------------------------------
    // TTS Engine — Browser fallback
    // -----------------------------------------------
    function speakBrowser(text, rate) {
        return new Promise((resolve, reject) => {
            state.synth.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = state.selectedVoice;
            utterance.lang = 'fr-FR';
            utterance.rate = rate * state.baseRate;
            utterance.pitch = 1.0;

            utterance.onend = () => {
                state.isSpeaking = false;
                resolve();
            };

            utterance.onerror = (e) => {
                state.isSpeaking = false;
                if (e.error === 'canceled') reject(new Error('aborted'));
                else resolve();
            };

            if (state.abortController) {
                state.abortController.signal.addEventListener('abort', () => {
                    state.synth.cancel();
                    reject(new Error('aborted'));
                });
            }

            state.isSpeaking = true;
            state.synth.speak(utterance);
        });
    }

    // -----------------------------------------------
    // Unified TTS speak function
    // -----------------------------------------------
    async function speakAsync(text, speed) {
        if (state.ttsMode === 'qwen3tts') {
            try {
                const blobUrl = await fetchTTSAudio(text, speed);
                await playAudio(blobUrl);
            } catch (e) {
                if (e.message === 'aborted') throw e;
                console.warn('[TTS] Qwen3-TTS failed, falling back to browser:', e.message);
                await speakBrowser(text, speed);
            }
        } else {
            await speakBrowser(text, speed);
        }
    }

    function speakWord(word) {
        if (state.ttsMode === 'qwen3tts') {
            fetchTTSAudio(word, 0.8)
                .then(url => playAudio(url))
                .catch(e => {
                    // Fallback to browser TTS for single words
                    state.synth.cancel();
                    const utterance = new SpeechSynthesisUtterance(word);
                    utterance.voice = state.selectedVoice;
                    utterance.lang = 'fr-FR';
                    utterance.rate = 0.75;
                    state.synth.speak(utterance);
                });
        } else {
            state.synth.cancel();
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.voice = state.selectedVoice;
            utterance.lang = 'fr-FR';
            utterance.rate = 0.75;
            state.synth.speak(utterance);
        }
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

    // -----------------------------------------------
    // Audio Pre-generation
    // -----------------------------------------------
    async function pregenerate(dictee) {
        if (state.ttsMode !== 'qwen3tts') return;

        const phrases = splitIntoSentences(dictee.texte);

        const segments = [
            // Phase announcements
            "Phase un. Lecture intégrale. Écoutez attentivement sans écrire.",
            dictee.texte,
            "Phase deux. Dictée. Écrivez le texte qui va vous être dicté. Chaque phrase sera lue deux fois.",
            ...phrases,
            "Phase trois. Relecture. Écoutez une dernière fois et corrigez votre copie.",
        ];

        state.pregenTotal = segments.length;
        state.pregenProgress = 0;

        console.log(`[TTS] Pre-generating ${segments.length} audio segments...`);
        dom.phaseDescription.textContent = `Pré-génération audio en cours... 0/${segments.length}`;

        for (let i = 0; i < segments.length; i++) {
            try {
                await fetchTTSAudio(segments[i], 1.0);
                // Also cache at current dictée speed for phrases
                if (i >= 3 && i < 3 + phrases.length) {
                    await fetchTTSAudio(segments[i], state.dicteeSpeed);
                }
                state.pregenProgress = i + 1;
                dom.phaseDescription.textContent = `Pré-génération audio en cours... ${i + 1}/${segments.length}`;
                dom.phaseCounter.textContent = `${Math.round((i + 1) / segments.length * 100)}%`;
            } catch (e) {
                console.warn(`[TTS] Pre-gen segment ${i} failed:`, e.message);
            }
        }

        console.log('[TTS] Pre-generation complete');
        dom.phaseDescription.textContent = 'Audio prêt ! Cliquez sur « Commencer » pour démarrer.';
        dom.phaseCounter.textContent = '✅';
    }

    // -----------------------------------------------
    // Wait utility
    // -----------------------------------------------
    function wait(ms) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(resolve, ms);
            if (state.abortController) {
                state.abortController.signal.addEventListener('abort', () => {
                    clearTimeout(id);
                    reject(new Error('aborted'));
                });
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
        dom.btnPause.style.display = 'none';
        dom.btnResume.style.display = 'none';
        dom.btnSkipPhase.style.display = 'none';
        dom.btnFinish.style.display = 'none';
        dom.writingArea.style.display = 'none';
        dom.currentWordDisplay.style.display = 'none';
        dom.timerDisplay.style.display = 'none';
        dom.studentText.value = '';

        updatePhaseUI('idle');

        // Pre-generate audio segments
        await pregenerate(dictee);
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
                desc: 'Écrivez le texte dicté. Chaque phrase est lue deux fois.',
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
        state.abortController = new AbortController();

        dom.btnStart.style.display = 'none';
        dom.btnPause.style.display = '';
        dom.btnSkipPhase.style.display = '';
        dom.timerDisplay.style.display = '';

        state.timerStart = Date.now();
        state.timerInterval = setInterval(updateTimer, 1000);

        try {
            await runLecture1();
            await runDictee();
            await runRelecture();
            finishExam();
        } catch (e) {
            if (e.message === 'aborted') return;
            console.error('Exam flow error:', e);
        }
    }

    async function runLecture1() {
        state.phase = 'lecture1';
        updatePhaseUI('lecture1');
        dom.currentWordDisplay.style.display = 'none';
        dom.writingArea.style.display = 'none';

        await speakAsync("Phase un. Lecture intégrale. Écoutez attentivement sans écrire.", 1.0);
        await wait(1500);

        await waitForResume();
        await speakAsync(state.currentDictee.texte, 1.0);
        await wait(2000);
    }

    async function runDictee() {
        state.phase = 'dictee';
        updatePhaseUI('dictee');

        dom.writingArea.style.display = '';
        dom.currentWordDisplay.style.display = '';
        dom.currentWordDisplay.classList.add('active');

        await speakAsync("Phase deux. Dictée. Écrivez le texte qui va vous être dicté. Chaque phrase sera lue deux fois.", 1.0);
        await wait(2000);

        // Official Brevet protocol: dictée "phrase par phrase"
        const phrases = splitIntoSentences(state.currentDictee.texte);

        for (let i = 0; i < phrases.length; i++) {
            state.currentGroupIndex = i;
            await waitForResume();

            dom.phaseCounter.textContent = `Phrase ${i + 1} / ${phrases.length}`;
            dom.currentWordText.textContent = phrases[i];

            // First read
            state.currentRepeat = 0;
            dom.repeatIndicator.textContent = '1ère lecture';
            dom.currentWordLabel.textContent = 'Phrase actuelle :';
            await speakAsync(phrases[i], state.dicteeSpeed);
            await wait(4000);

            await waitForResume();

            // Second read
            state.currentRepeat = 1;
            dom.repeatIndicator.textContent = '2ème lecture';
            await speakAsync(phrases[i], state.dicteeSpeed);
            await wait(5000);
        }

        dom.currentWordDisplay.classList.remove('active');
        dom.currentWordText.textContent = '';
        dom.repeatIndicator.textContent = '';
        dom.phaseCounter.textContent = '';

        await wait(2000);
    }

    async function runRelecture() {
        state.phase = 'relecture';
        updatePhaseUI('relecture');
        dom.currentWordDisplay.style.display = 'none';

        await speakAsync("Phase trois. Relecture. Écoutez une dernière fois et corrigez votre copie.", 1.0);
        await wait(1500);

        await waitForResume();
        await speakAsync(state.currentDictee.texte, 1.0);
        await wait(2000);
    }

    function finishExam() {
        state.phase = 'finished';
        updatePhaseUI('finished');

        clearInterval(state.timerInterval);

        dom.btnPause.style.display = 'none';
        dom.btnResume.style.display = 'none';
        dom.btnSkipPhase.style.display = 'none';
        dom.btnFinish.style.display = '';
        dom.currentWordDisplay.style.display = 'none';

        stopAudio();
    }

    function skipPhase() {
        stopAudio();
        state.isPaused = false;

        if (state.abortController) {
            state.abortController.abort();
        }

        state.abortController = new AbortController();

        if (state.phase === 'lecture1') {
            runDictee().then(runRelecture).then(finishExam).catch(e => {
                if (e.message !== 'aborted') console.error(e);
            });
        } else if (state.phase === 'dictee') {
            dom.currentWordDisplay.classList.remove('active');
            runRelecture().then(finishExam).catch(e => {
                if (e.message !== 'aborted') console.error(e);
            });
        } else if (state.phase === 'relecture') {
            finishExam();
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
            switchSection('accueil');
        });
        dom.navExamen.addEventListener('click', () => switchSection('examen'));
        dom.navCorrection.addEventListener('click', () => {
            if (state.currentDictee) switchSection('correction');
        });

        dom.speedRange.addEventListener('input', () => {
            state.baseRate = parseFloat(dom.speedRange.value);
            dom.speedValue.textContent = state.baseRate.toFixed(2) + '×';
        });

        dom.btnStart.addEventListener('click', startExam);

        dom.btnPause.addEventListener('click', () => {
            state.isPaused = true;
            if (state.currentAudio) {
                state.currentAudio.pause();
            }
            state.synth.pause();
            dom.btnPause.style.display = 'none';
            dom.btnResume.style.display = '';
        });

        dom.btnResume.addEventListener('click', () => {
            state.isPaused = false;
            if (state.currentAudio) {
                state.currentAudio.play();
            }
            state.synth.resume();
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
