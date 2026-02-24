// =====================================================
// src/correction.js — Diff scoring and correction UI
// =====================================================
// Functions in this module:
//   countSignsWithoutSpaces — count non-space characters
//   computeDiff             — PURE: compare student vs original text → result object
//   runDiff                 — DOM renderer: calls computeDiff and updates the UI
//   renderRules             — render grammar rule cards
//   renderPrononciation     — render interactive pronunciation text
//   goToCorrection          — orchestrate transition to correction section

import { state } from './state.js';
import { speakWord } from './tts.js';
import { switchSection } from './ui.js';

// DOM shorthand
const $ = id => document.getElementById(id);

// -----------------------------------------------
// Pure utilities (exported for testing)
// -----------------------------------------------
export function countSignsWithoutSpaces(text) {
    return text.replace(/\s+/g, '').length;
}

/**
 * Pure diff computation — no DOM access.
 * @param {string} studentText
 * @param {string} originalText
 * @returns {{ score: number, correct: number, totalWords: number, errorCount: number, faultPoints: number, errors: Array }}
 */
export function computeDiff(studentText, originalText) {
    const normalize = t => t.replace(/[\u2018\u2019']/g, "'")
        .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

    const studentWords = normalize(studentText).split(' ');
    const originalWords = normalize(originalText).split(' ');

    let correct = 0;
    const errors = [];
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
                original: originalWords[i] || '(manquant)',
            });
        }
    }

    const totalWords = originalWords.length;
    const errorCount = errors.length;
    const faultPoints = errorCount * 0.25;
    const score = Math.max(0, 10 - faultPoints);

    return { score, correct, totalWords, errorCount, faultPoints, errors };
}

// -----------------------------------------------
// DOM renderers
// -----------------------------------------------
export function runDiff(studentText, originalText) {
    const diffScore = $('diff-score');
    const diffDetails = $('diff-details');

    if (!studentText) {
        diffScore.innerHTML = '<span class="score-ok">Aucun texte saisi — relisez le texte original ci-dessous.</span>';
        diffDetails.innerHTML = '';
        return;
    }

    const { score, correct, totalWords, errorCount, faultPoints, errors } = computeDiff(studentText, originalText);

    let scoreClass = 'score-good';
    if (score < 5) scoreClass = 'score-bad';
    else if (score < 8) scoreClass = 'score-ok';

    diffScore.innerHTML = `
      <span class="${scoreClass}">${score.toFixed(1)} / 10</span>
      <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-light); margin-left: 1rem;">
        ${correct}/${totalWords} mots corrects — ${errorCount} faute${errorCount > 1 ? 's' : ''} (-${faultPoints.toFixed(2)} pts)
      </span>
    `;

    if (errors.length === 0) {
        diffDetails.innerHTML = '<p style="color: var(--success); font-weight: 600;">🎉 Bravo ! Aucune erreur détectée !</p>';
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
        diffDetails.innerHTML = html;
    }
}

export function renderRules(regles) {
    const rulesList = $('rules-list');
    rulesList.innerHTML = '';

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

        rulesList.appendChild(card);
    });
}

export function renderPrononciation(dictee) {
    const prononciationText = $('prononciation-text');
    const wordInfoPanel = $('word-info-panel');
    const wordInfoTitle = $('word-info-title');
    const wordInfoContent = $('word-info-content');
    const btnHearWord = $('btn-hear-word');

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

    prononciationText.innerHTML = html;

    prononciationText.querySelectorAll('.word').forEach(el => {
        el.addEventListener('click', () => {
            const word = el.dataset.word;
            speakWord(word);

            prononciationText.querySelectorAll('.word.speaking').forEach(s => s.classList.remove('speaking'));
            el.classList.add('speaking');

            const rule = dictee.regles.find(r =>
                r.mot.toLowerCase().includes(word.toLowerCase().replace(/[.,;:!?\u2026«»"']/g, ''))
            );

            if (rule) {
                wordInfoPanel.style.display = '';
                wordInfoTitle.textContent = rule.mot;
                wordInfoContent.textContent = rule.explication;
                btnHearWord.onclick = () => speakWord(rule.mot);
            } else {
                wordInfoPanel.style.display = 'none';
            }
        });
    });
}

export function goToCorrection() {
    const dictee = state.currentDictee;
    $('nav-correction').disabled = false;
    switchSection('correction');

    $('correction-dictee-title').textContent = `${dictee.titre} — ${dictee.auteur}`;

    const studentText = $('student-text').value.trim();
    $('student-text-display').textContent = studentText || '(Aucun texte saisi)';
    $('original-text-display').textContent = dictee.texte;

    runDiff(studentText, dictee.texte);
    renderRules(dictee.regles);
    renderPrononciation(dictee);
}
