// =====================================================
// src/ui.js — Navigation, rendering, event bindings
// =====================================================
// Functions in this module:
//   DOM primitives (called by exam-flow.js to avoid DOM coupling):
//     updatePhaseUI, showWritingArea, hideWritingArea,
//     showCurrentWordDisplay, hideCurrentWordDisplay,
//     setCurrentWordText, setRepeatIndicator, setPhaseCounter,
//     setPhaseDescription, showExamControls, showFinishControls,
//     showTimerDisplay, setTimerText, setSkipLectureIntroVisible
//
//   Full UI orchestration:
//     renderDicteeGrid, switchSection, setupVoiceSelector,
//     setupSpeedSlider, checkBackendHealth, bindEvents
//
// NOTE: This module does NOT import from exam-flow.js or correction.js.
// All cross-module dependencies are passed as parameters from main.js.

import { state } from './state.js';
import { stopAudio, pregenerate } from './tts.js';

// DOM shorthand
const $ = id => document.getElementById(id);

// -----------------------------------------------
// DOM primitive exports (used by exam-flow.js)
// -----------------------------------------------
export function updatePhaseUI(phase) {
    const currentDictee = state.currentDictee;
    const configs = {
        idle: {
            icon: '📚',
            title: currentDictee ? `${currentDictee.titre}` : '',
            desc: currentDictee ? `${currentDictee.auteur} — Préparation en cours...` : '',
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
    $('phase-icon').textContent = cfg.icon;
    $('phase-title').textContent = cfg.title;
    $('phase-description').textContent = cfg.desc;

    document.querySelectorAll('.phase-dot').forEach((dot, i) => {
        dot.classList.toggle('active', cfg.dots[i] && i === cfg.dots.lastIndexOf(true));
        dot.classList.toggle('done', cfg.dots[i] && i < cfg.dots.lastIndexOf(true));
    });
}

export function showWritingArea() { $('writing-area').style.display = ''; }
export function hideWritingArea() { $('writing-area').style.display = 'none'; }

export function showCurrentWordDisplay() {
    $('current-word-display').style.display = '';
    $('current-word-display').classList.add('active');
}
export function hideCurrentWordDisplay() {
    $('current-word-display').style.display = 'none';
    $('current-word-display').classList.remove('active');
}

export function setCurrentWordText(text) { $('current-word-text').textContent = text; }
export function setRepeatIndicator(text) {
    $('repeat-indicator').textContent = text;
    if (text) $('current-word-label').textContent = 'Phrase actuelle :';
}
export function setPhaseCounter(text) { $('phase-counter').textContent = text; }
export function setPhaseDescription(text) { $('phase-description').textContent = text; }
export function setTimerText(text) { $('timer-text').textContent = text; }

export function showExamControls() {
    $('btn-start').style.display = 'none';
    $('btn-skip-lecture-intro').style.display = 'none';
    $('btn-skip-pregen').style.display = 'none';
    $('btn-pause').style.display = '';
    $('btn-skip-phase').style.display = '';
}

export function showFinishControls() {
    $('btn-pause').style.display = 'none';
    $('btn-resume').style.display = 'none';
    $('btn-skip-phase').style.display = 'none';
    $('btn-finish').style.display = '';
    $('current-word-display').style.display = 'none';
}

export function showTimerDisplay() { $('timer-display').style.display = ''; }

export function setSkipLectureIntroVisible(visible) {
    $('btn-skip-lecture-intro').style.display = visible ? '' : 'none';
    if (visible) $('btn-skip-lecture-intro').disabled = false;
}

// -----------------------------------------------
// Section navigation
// -----------------------------------------------
export function switchSection(name) {
    ['accueil', 'examen', 'correction'].forEach(s => {
        document.getElementById('section-' + s).classList.toggle('active', s === name);
        document.getElementById('nav-' + s).classList.toggle('active', s === name);
    });
}

// -----------------------------------------------
// Dictée grid — receives DICTEES array and selectDictee action
// -----------------------------------------------
export function renderDicteeGrid(dictees, onSelect) {
    $('dictee-grid').innerHTML = '';

    // 1. Add the "Generate" card
    const genCard = document.createElement('div');
    genCard.className = 'dictee-card card-generate';
    genCard.innerHTML = `
        <div class="card-icon">🪄</div>
        <h4>Générer une dictée</h4>
        <p class="card-preview">Créez un texte inédit sur le thème de votre choix grâce à l'IA.</p>
        <span class="card-start-btn">Essayer maintenant →</span>
    `;
    genCard.addEventListener('click', () => {
        $('modal-generation').style.display = 'flex';
        $('input-theme').focus();
    });
    $('dictee-grid').appendChild(genCard);

    const diffLabels = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' };

    dictees.forEach(dictee => {
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
        card.addEventListener('click', () => onSelect(dictee));
        $('dictee-grid').appendChild(card);
    });
}

// -----------------------------------------------
// Dictée selection
// getDictationSegments and buildAnnouncements are passed from main.js
// to avoid importing exam-flow.js here (would be circular).
// -----------------------------------------------
export async function selectDictee(dictee, { getDictationSegments, buildAnnouncements }) {
    state.currentDictee = dictee;
    state.phase = 'idle';
    state.currentGroupIndex = 0;
    state.currentRepeat = 0;
    state.isPaused = false;

    $('nav-examen').disabled = false;
    switchSection('examen');

    // Reset UI
    $('btn-start').style.display = '';
    $('btn-skip-lecture-intro').style.display = 'none';
    $('btn-skip-pregen').style.display = '';
    $('btn-skip-pregen').disabled = false;
    $('btn-pause').style.display = 'none';
    $('btn-resume').style.display = 'none';
    $('btn-skip-phase').style.display = 'none';
    $('btn-finish').style.display = 'none';
    $('btn-start').disabled = true;
    state.skipLectureIntroRequested = false;
    $('writing-area').style.display = 'none';
    $('current-word-display').style.display = 'none';
    $('timer-display').style.display = 'none';
    $('student-text').value = '';

    updatePhaseUI('idle');

    try {
        await pregenerate(dictee, {
            getDictationSegments,
            buildAnnouncements,
            onProgress: (current, total) => {
                $('phase-description').textContent = `Pré-génération audio en cours... ${current}/${total}`;
                if (current > 0) {
                    $('phase-counter').textContent = `${Math.round(current / total * 100)}%`;
                }
            },
            onComplete: () => {
                $('phase-description').textContent = 'Audio prêt ! Cliquez sur « Commencer » pour démarrer.';
                $('phase-counter').textContent = '✅';
            },
            onSkip: () => {
                $('phase-description').textContent = 'Pré-génération interrompue. Vous pouvez commencer sans attendre.';
                $('phase-counter').textContent = '⏭️';
            },
        });
    } finally {
        $('btn-start').disabled = !state.ttsAvailable;
        $('btn-skip-lecture-intro').style.display = 'none';
        $('btn-skip-pregen').style.display = 'none';
    }
}

// -----------------------------------------------
// Voice selector
// -----------------------------------------------
export function setupVoiceSelector() {
    const voiceSelect = $('voice-select');
    voiceSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = 'kokoro_ff_siwis';
    opt.textContent = '🎙️ Kokoro MLX — ff_siwis (Français)';
    opt.selected = true;
    voiceSelect.appendChild(opt);
    voiceSelect.disabled = true;
}

// -----------------------------------------------
// Speed slider
// -----------------------------------------------
export function setupSpeedSlider() {
    const speedRange = $('speed-range');
    const speedValue = $('speed-value');
    if (!speedRange) return;

    speedRange.value = state.dicteeSpeed;
    if (speedValue) speedValue.textContent = `${state.dicteeSpeed.toFixed(2)}x`;

    speedRange.addEventListener('input', () => {
        const val = parseFloat(speedRange.value);
        state.dicteeSpeed = val;
        if (speedValue) speedValue.textContent = `${val.toFixed(2)}x`;
        state.audioCache.clear();
        console.log('[UI] Reading speed adjusted:', val);
    });
}

// -----------------------------------------------
// Health check — verifies TTS server AND /api/dictees
// Shows a visible connectivity status banner in the UI.
// -----------------------------------------------
export async function checkBackendHealth() {
    let ttsOk = false;
    let dataOk = false;
    let statusMsg = '';

    try {
        const res = await fetch('/api/health');
        if (res.ok) {
            const data = await res.json();
            ttsOk = !!data.ttsReachable;
            if (!ttsOk) {
                statusMsg = 'Serveur Kokoro TTS inaccessible. Lancez ./tts_server.sh';
            }
        } else {
            statusMsg = `Serveur web inaccessible (${res.status}).`;
        }
    } catch (e) {
        statusMsg = `Connexion au serveur échouée. (${e.message})`;
    }

    try {
        const res = await fetch('/api/dictees');
        if (res.ok) {
            const dictees = await res.json();
            dataOk = Array.isArray(dictees) && dictees.length > 0;
            if (!dataOk) statusMsg = statusMsg || 'Liste des dictées vide ou invalide.';
        } else {
            dataOk = false;
            statusMsg = statusMsg || `Endpoint /api/dictees inaccessible (${res.status}).`;
        }
    } catch (e) {
        dataOk = false;
        statusMsg = statusMsg || `Impossible de vérifier /api/dictees. (${e.message})`;
    }

    if (ttsOk && dataOk) {
        console.log('[Health] Backend et données: OK');
        state.ttsAvailable = true;
        $('voice-select').disabled = false;
    } else {
        state.ttsAvailable = false;
        $('voice-select').disabled = true;
        console.warn('[Health] Problème détecté:', statusMsg);

        // Show a visible warning banner above the dictée grid
        const grid = $('dictee-grid');
        if (grid) {
            const banner = document.createElement('div');
            banner.id = 'health-warning-banner';
            banner.style.cssText = `
                grid-column: 1 / -1;
                background: rgba(255, 165, 0, 0.15);
                border: 1px solid rgba(255, 165, 0, 0.5);
                border-radius: 8px;
                padding: 1rem 1.5rem;
                color: #ffa500;
                font-size: 0.9rem;
                margin-bottom: 0.5rem;
            `;
            banner.innerHTML = `⚠️ <strong>Attention :</strong> ${statusMsg}`;
            // Only insert if not already present
            if (!$('health-warning-banner')) {
                grid.parentElement.insertBefore(banner, grid);
            }
        }
    }
}


// -----------------------------------------------
// Event bindings
// actions = { startExam, skipPhase, goToCorrection }
// onSelectDictee: function to trigger when a dictée is chosen
// Passed from main.js to break circular dependency.
// -----------------------------------------------
export function bindEvents(actions, onSelectDictee) {
    const { startExam, skipPhase, goToCorrection } = actions;

    $('nav-accueil').addEventListener('click', () => {
        stopAudio();
        if (state.abortController) state.abortController.abort();
        state.abortController = null;
        state.examInProgress = false;
        state.skipTransitionInProgress = false;
        state.activeRunToken += 1;
        clearInterval(state.timerInterval);
        switchSection('accueil');
    });

    $('nav-examen').addEventListener('click', () => switchSection('examen'));

    $('nav-correction').addEventListener('click', () => {
        if (state.currentDictee) switchSection('correction');
    });

    $('btn-start').addEventListener('click', startExam);

    $('btn-skip-lecture-intro').addEventListener('click', () => {
        if (state.phase !== 'lecture1') return;
        state.skipLectureIntroRequested = true;
        $('btn-skip-lecture-intro').disabled = true;
        $('phase-description').textContent = 'Introduction passée. Début de la lecture du texte...';
        stopAudio();
    });

    $('btn-skip-pregen').addEventListener('click', () => {
        if (!state.pregenInProgress) return;
        state.pregenSkipRequested = true;
        $('btn-skip-pregen').disabled = true;
        $('btn-start').disabled = !state.ttsAvailable;
        $('phase-description').textContent = 'Arrêt de la pré-génération en cours...';
        $('phase-counter').textContent = '⏭️';
    });

    $('btn-pause').addEventListener('click', () => {
        state.isPaused = true;
        if (state.currentAudio) state.currentAudio.pause();
        $('btn-pause').style.display = 'none';
        $('btn-resume').style.display = '';
    });

    $('btn-resume').addEventListener('click', () => {
        state.isPaused = false;
        if (state.currentAudio) state.currentAudio.play();
        $('btn-resume').style.display = 'none';
        $('btn-pause').style.display = '';
    });

    $('btn-skip-phase').addEventListener('click', skipPhase);
    $('btn-finish').addEventListener('click', goToCorrection);

    // Generation Modal
    const closeModal = () => {
        $('modal-generation').style.display = 'none';
        $('input-theme').value = '';
        $('gen-loading').style.display = 'none';
        $('btn-confirm-gen').disabled = false;
    };

    $('btn-close-modal').addEventListener('click', closeModal);

    $('modal-generation').addEventListener('click', (e) => {
        if (e.target === $('modal-generation')) closeModal();
    });

    $('btn-confirm-gen').addEventListener('click', async () => {
        const theme = $('input-theme').value.trim();

        $('gen-loading').style.display = 'block';
        $('btn-confirm-gen').disabled = true;

        try {
            const res = await fetch('/api/generate-dictee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme })
            });

            if (!res.ok) throw new Error(`Erreur génération : ${res.status}`);

            const data = await res.json();
            const generatedText = data.text;

            // Create a pseudo-dictee object
            const newDictee = {
                id: `gen-${Date.now()}`,
                titre: theme ? `Dictée : ${theme}` : 'Dictée Générée',
                auteur: 'Intelligence Artificielle',
                oeuvre: 'Dictée Brevet 2026',
                annee: new Date().getFullYear(),
                theme: theme || 'Général',
                difficulte: 2,
                texte: generatedText,
                regles: [
                    { mot: "IA", explication: "Texte généré dynamiquement.", type: "vocabulaire" }
                ]
            };

            closeModal();

            // Automatically select and start this new dictée
            if (onSelectDictee) onSelectDictee(newDictee);

        } catch (e) {
            console.error('[UI] Generation failed:', e);
            alert(`Désolé, la génération a échoué : ${e.message}`);
            $('gen-loading').style.display = 'none';
            $('btn-confirm-gen').disabled = false;
        }
    });

    [$('tab-comparaison'), $('tab-regles'), $('tab-prononciation')].forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-content-' + btn.dataset.tab).classList.add('active');
        });
    });

    $('btn-new-dictee').addEventListener('click', () => {
        stopAudio();
        clearInterval(state.timerInterval);
        if (state.abortController) state.abortController.abort();
        state.abortController = null;
        state.pregenSkipRequested = true;
        state.pregenInProgress = false;
        state.skipLectureIntroRequested = false;
        state.skipTransitionInProgress = false;
        state.examInProgress = false;
        state.activeRunToken += 1;
        $('btn-skip-lecture-intro').style.display = 'none';
        // Clear audio cache on new dictée
        state.audioCache.forEach(url => URL.revokeObjectURL(url));
        state.audioCache.clear();
        $('nav-examen').disabled = true;
        $('nav-correction').disabled = true;
        switchSection('accueil');
    });
}
