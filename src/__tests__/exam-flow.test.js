// =====================================================
// src/__tests__/exam-flow.test.js
// Unit tests for pure functions in exam-flow.js
// Source of truth: TECHNICAL_SPEC.md — Official Brevet Protocol
// =====================================================

import { describe, it, expect } from 'vitest';
import {
    splitIntoSentences,
    splitSentenceByPunctuation,
    buildSentenceDictationText,
    PUNCTUATION_RULES,
} from '../exam-flow.js';

// -----------------------------------------------
// splitIntoSentences
// -----------------------------------------------
describe('splitIntoSentences', () => {
    it('returns a single-element array for a single sentence', () => {
        const result = splitIntoSentences('Je marche dans la forêt.');
        expect(result).toEqual(['Je marche dans la forêt.']);
    });

    it('splits two sentences on period + space', () => {
        const result = splitIntoSentences('Il fait beau. Le ciel est bleu.');
        expect(result).toEqual(['Il fait beau.', 'Le ciel est bleu.']);
    });

    it('splits on exclamation mark', () => {
        const result = splitIntoSentences('Comme il fait beau ! Le soleil brille.');
        expect(result).toEqual(['Comme il fait beau !', 'Le soleil brille.']);
    });

    it('splits on question mark', () => {
        const result = splitIntoSentences('Où vas-tu ? Je rentre à la maison.');
        expect(result).toEqual(['Où vas-tu ?', 'Je rentre à la maison.']);
    });

    it('handles trailing whitespace gracefully', () => {
        const result = splitIntoSentences('  Premier.   Deuxième.  ');
        expect(result).toEqual(['Premier.', 'Deuxième.']);
    });

    it('handles an ellipsis at sentence end (treated as trailing text)', () => {
        // Ellipsis is not a sentence boundary in our splitter (only .!? are)
        const input = 'Il hésita… puis repartit. Elle attendait.';
        const result = splitIntoSentences(input);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe('Il hésita… puis repartit.');
        expect(result[1]).toBe('Elle attendait.');
    });

    it('returns empty array for empty string', () => {
        expect(splitIntoSentences('')).toEqual([]);
    });

    it('handles three sentences', () => {
        const input = 'Phrase une. Phrase deux. Phrase trois.';
        const result = splitIntoSentences(input);
        expect(result).toHaveLength(3);
    });
});

// -----------------------------------------------
// splitSentenceByPunctuation
// -----------------------------------------------
describe('splitSentenceByPunctuation', () => {
    it('returns a single text segment for a sentence with no punctuation', () => {
        const result = splitSentenceByPunctuation('Les enfants jouent dehors');
        expect(result).toEqual([{ type: 'text', value: 'Les enfants jouent dehors' }]);
    });

    it('splits a sentence ending with a period', () => {
        const result = splitSentenceByPunctuation('Il marche.');
        expect(result).toContainEqual({ type: 'text', value: 'Il marche' });
        expect(result).toContainEqual({ type: 'punctuation', value: '.' });
    });

    it('splits a sentence with a comma mid-sentence', () => {
        const result = splitSentenceByPunctuation('La mer, furieuse, rugissait.');
        expect(result[0]).toEqual({ type: 'text', value: 'La mer' });
        expect(result[1]).toEqual({ type: 'punctuation', value: ',' });
        expect(result[2]).toEqual({ type: 'text', value: 'furieuse' });
        expect(result[3]).toEqual({ type: 'punctuation', value: ',' });
    });

    it('recognizes semicolon', () => {
        const result = splitSentenceByPunctuation('Elle chantait ; il jouait.');
        const punctTypes = result.filter(s => s.type === 'punctuation').map(s => s.value);
        expect(punctTypes).toContain(';');
    });

    it('normalizes ... to …', () => {
        const result = splitSentenceByPunctuation('Il hésita...');
        const punct = result.find(s => s.type === 'punctuation');
        expect(punct?.value).toBe('…');
    });

    it('handles multiple consecutive punctuation marks', () => {
        const result = splitSentenceByPunctuation('Vraiment !');
        expect(result).toContainEqual({ type: 'punctuation', value: '!' });
    });

    it('handles only punctuation (no text chunks)', () => {
        const result = splitSentenceByPunctuation('.');
        expect(result).toEqual([{ type: 'punctuation', value: '.' }]);
    });
});

// -----------------------------------------------
// buildSentenceDictationText
// One test per French punctuation symbol supported
// -----------------------------------------------
describe('buildSentenceDictationText', () => {
    it('verbalizes comma as "virgule"', () => {
        const result = buildSentenceDictationText('La mer, furieuse.');
        expect(result).toContain('virgule');
    });

    it('verbalizes period as "point"', () => {
        const result = buildSentenceDictationText('Il arrive.');
        expect(result).toContain('point');
    });

    it('verbalizes exclamation mark as "point d\'exclamation"', () => {
        const result = buildSentenceDictationText('Attention !');
        expect(result).toContain("point d'exclamation");
    });

    it('verbalizes question mark as "point d\'interrogation"', () => {
        const result = buildSentenceDictationText('Qui est là ?');
        expect(result).toContain("point d'interrogation");
    });

    it('verbalizes semicolon as "point-virgule"', () => {
        const result = buildSentenceDictationText('Elle chantait ; il jouait.');
        expect(result).toContain('point-virgule');
    });

    it('verbalizes colon as "deux-points"', () => {
        const result = buildSentenceDictationText('Il dit : bonjour.');
        expect(result).toContain('deux-points');
    });

    it('verbalizes ellipsis as "points de suspension"', () => {
        const result = buildSentenceDictationText('Il hésita…');
        expect(result).toContain('points de suspension');
    });

    it('verbalizes ... (three dots) as "points de suspension"', () => {
        const result = buildSentenceDictationText('Il hésita...');
        expect(result).toContain('points de suspension');
    });

    it('returns only text content when there is no punctuation', () => {
        const result = buildSentenceDictationText('Les enfants jouent');
        expect(result).toBe('Les enfants jouent');
    });

    it('joins text and punctuation words with commas', () => {
        // "Il marche" + ", virgule" → "Il marche, virgule, point"
        const result = buildSentenceDictationText('Il marche, lentement.');
        expect(result).toMatch(/Il marche/);
        expect(result).toMatch(/virgule/);
        expect(result).toMatch(/lentement/);
        expect(result).toMatch(/point/);
    });

    it('normalizes extra spaces in output', () => {
        const result = buildSentenceDictationText('Bonjour.');
        expect(result).not.toMatch(/\s{2,}/);
    });

    it('PUNCTUATION_RULES covers all expected French punctuation marks', () => {
        const required = [',', ';', ':', '.', '?', '!', '…'];
        required.forEach(punct => {
            expect(PUNCTUATION_RULES).toHaveProperty(punct);
        });
    });
});
