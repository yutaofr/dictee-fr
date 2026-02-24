// =====================================================
// src/main.js — Bootstrap: wires all modules together
// =====================================================
// Import order (bottom-up, dependencies first):
//   state → tts → correction → exam-flow → ui → main

import { startExam, skipPhase, getDictationSpeechSegments, buildPhaseAnnouncements } from './exam-flow.js';
import { goToCorrection } from './correction.js';
import {
    renderDicteeGrid,
    selectDictee,
    setupVoiceSelector,
    setupSpeedSlider,
    checkBackendHealth,
    bindEvents,
} from './ui.js';

// -----------------------------------------------
// Error state renderer — shown if the backend is unreachable
// -----------------------------------------------
function renderErrorState(message) {
    const grid = document.getElementById('dictee-grid');
    if (grid) {
        grid.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                background: rgba(220, 53, 69, 0.15);
                border: 1px solid rgba(220, 53, 69, 0.5);
                border-radius: 12px;
                padding: 2rem;
                text-align: center;
                color: #ff6b7a;
            ">
                <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="margin-bottom: 0.5rem;">Connexion impossible</h3>
                <p style="margin-bottom: 1.5rem; color: var(--text-light);">${message}</p>
                <p style="font-size: 0.9rem; color: var(--text-muted);">
                    Lancez le serveur : <code>./dev_stack.sh start npm</code> puis rechargez la page.
                </p>
            </div>
        `;
    }
}

async function init() {
    // Fetch DICTEES from the API (replaces the former window.DICTEES global)
    let DICTEES;
    try {
        const res = await fetch('/api/dictees');
        if (!res.ok) throw new Error(`Réponse serveur inattendue : ${res.status}`);
        DICTEES = await res.json();
        if (!Array.isArray(DICTEES) || DICTEES.length === 0) {
            throw new Error('La liste des dictées est vide ou invalide.');
        }
    } catch (e) {
        console.error('[main] Impossible de charger les dictées :', e.message);
        renderErrorState(`Impossible de charger les dictées depuis le serveur. (${e.message})`);
        // Setup controls even in error state so the page doesn't appear broken
        setupVoiceSelector();
        setupSpeedSlider();
        bindEvents({ startExam, skipPhase, goToCorrection });
        return;
    }

    // Render the dictée selection grid
    const onSelect = (dictee) => {
        selectDictee(dictee, {
            getDictationSegments: getDictationSpeechSegments,
            buildAnnouncements: buildPhaseAnnouncements,
        });
    };

    renderDicteeGrid(DICTEES, onSelect);

    // Setup UI controls
    setupVoiceSelector();
    setupSpeedSlider();

    // Wire all action-producing events
    bindEvents({ startExam, skipPhase, goToCorrection }, onSelect);

    // Check TTS backend availability
    await checkBackendHealth();
}

document.addEventListener('DOMContentLoaded', init);
