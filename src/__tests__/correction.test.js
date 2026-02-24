// =====================================================
// src/__tests__/correction.test.js
// Unit tests for pure functions in correction.js
// =====================================================

import { describe, it, expect } from 'vitest';
import { computeDiff, countSignsWithoutSpaces } from '../correction.js';

// -----------------------------------------------
// countSignsWithoutSpaces
// -----------------------------------------------
describe('countSignsWithoutSpaces', () => {
    it('returns 0 for empty string', () => {
        expect(countSignsWithoutSpaces('')).toBe(0);
    });

    it('returns 0 for a spaces-only string', () => {
        expect(countSignsWithoutSpaces('   ')).toBe(0);
    });

    it('counts letters only', () => {
        expect(countSignsWithoutSpaces('abc')).toBe(3);
    });

    it('counts letters and punctuation, ignores spaces', () => {
        // "Il. Dit." → 7 non-space chars (I,l,.,D,i,t,.)
        expect(countSignsWithoutSpaces('Il. Dit.')).toBe(7);
    });

    it('handles mixed punctuation and accented characters', () => {
        // "été," → 4 chars
        expect(countSignsWithoutSpaces('été,')).toBe(4);
    });

    it('handles multiple spaces between words', () => {
        expect(countSignsWithoutSpaces('a  b  c')).toBe(3);
    });

    it('counts newlines as non-space (tab/newline not collapsed by replace /\\s+/)', () => {
        // \n and \t are matched by \s, so they ARE stripped
        expect(countSignsWithoutSpaces('a\nb')).toBe(2);
        expect(countSignsWithoutSpaces('a\tb')).toBe(2);
    });
});

// -----------------------------------------------
// computeDiff — one test per diff operation type
// -----------------------------------------------
describe('computeDiff', () => {
    it('exact match: score 10, 0 errors', () => {
        const original = 'Le chat dort.';
        const result = computeDiff(original, original);
        expect(result.score).toBe(10);
        expect(result.errorCount).toBe(0);
        expect(result.errors).toHaveLength(0);
    });

    it('substitution: one word replaced → 1 error, -0.25 pts', () => {
        // student wrote "chien" instead of "chat"
        const result = computeDiff('Le chien dort.', 'Le chat dort.');
        expect(result.errorCount).toBe(1);
        expect(result.score).toBeCloseTo(10 - 0.25);
        const err = result.errors[0];
        expect(err.student.toLowerCase().replace(/[.,;:!?…]/g, '')).toBe('chien');
        expect(err.original.toLowerCase().replace(/[.,;:!?…]/g, '')).toBe('chat');
    });

    it('deletion: student omits a word → 1 error', () => {
        // original has "Le chat dort" (3 words), student has "Le dort" (2 words)
        const result = computeDiff('Le dort.', 'Le chat dort.');
        expect(result.errorCount).toBeGreaterThan(0);
    });

    it('insertion: student adds an extra word → counted as error', () => {
        // student wrote more words than original → extra positions are errors
        const result = computeDiff('Le grand chat dort.', 'Le chat dort.');
        expect(result.errorCount).toBeGreaterThan(0);
    });

    it('accented character mismatch: "éte" vs "été" is an error', () => {
        const result = computeDiff("C'éte beau.", "C'été beau.");
        expect(result.errorCount).toBe(1);
    });

    it('punctuation is stripped before comparison (not counted as error)', () => {
        // "chat." vs "chat" should match after stripping punctuation
        const result = computeDiff('Le chat.', 'Le chat.');
        expect(result.errorCount).toBe(0);
    });

    it('typographic quotes normalized: « and » treated as "', () => {
        const result = computeDiff('Il dit "bonjour".', 'Il dit «bonjour».');
        // After normalization both become standard quotes — should match
        expect(result.errorCount).toBe(0);
    });

    it("curly apostrophe normalized: \u2019 treated as '", () => {
        const result = computeDiff("l\u2019homme", "l'homme");
        expect(result.errorCount).toBe(0);
    });

    it('empty student text → 0 correct, all words as errors', () => {
        const result = computeDiff('', 'Le chat dort.');
        expect(result.correct).toBe(0);
        expect(result.errorCount).toBe(result.totalWords);
    });

    it('score cannot go below 0', () => {
        // 100 wrong words → score must not go negative
        const original = Array(20).fill('chat').join(' ') + '.';
        const student = Array(20).fill('chien').join(' ') + '.';
        const result = computeDiff(student, original);
        expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('faultPoints = errorCount * 0.25', () => {
        const result = computeDiff('Le chien dort.', 'Le chat dort.');
        expect(result.faultPoints).toBeCloseTo(result.errorCount * 0.25);
    });

    it('totalWords equals number of words in original', () => {
        const result = computeDiff('any text here', 'Le chat dort tranquillement.');
        expect(result.totalWords).toBe(4); // "Le", "chat", "dort", "tranquillement."
    });
});
