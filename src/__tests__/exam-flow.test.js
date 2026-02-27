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
    autoSegmentSentence,
    getWordGroups,
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

// -----------------------------------------------
// autoSegmentSentence
// -----------------------------------------------
describe('autoSegmentSentence', () => {
    it('returns empty array for empty input', () => {
        expect(autoSegmentSentence('')).toEqual([]);
        expect(autoSegmentSentence('   ')).toEqual([]);
    });

    it('returns the whole sentence when short enough', () => {
        const result = autoSegmentSentence('Le petit Marcel marchait.');
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('Le petit Marcel marchait.');
    });

    it('splits at commas', () => {
        const sentence = 'La mer, furieuse et déchaînée, lançait ses vagues immenses contre les rochers.';
        const result = autoSegmentSentence(sentence);
        expect(result.length).toBeGreaterThan(1);
        result.forEach(group => {
            const wc = group.trim().split(/\s+/).length;
            expect(wc).toBeLessThanOrEqual(10);
        });
    });

    it('splits at grammatical boundaries (qui, que, dont, où)', () => {
        const sentence = 'Il suivait son père qui portait sur son épaule un grand sac de toile rempli de provisions.';
        const result = autoSegmentSentence(sentence);
        // Should split a 16-word sentence into multiple groups
        expect(result.length).toBeGreaterThan(1);
        // No group should exceed HARD_MAX (10 words)
        result.forEach(group => {
            const wc = group.trim().split(/\s+/).length;
            expect(wc).toBeLessThanOrEqual(10);
        });
    });

    it('splits at coordinating conjunctions (et, mais, car)', () => {
        const sentence = 'Les cigales chantaient dans les arbres et le soleil éclatant les obligeait à plisser les yeux.';
        const result = autoSegmentSentence(sentence);
        expect(result.length).toBeGreaterThan(1);
    });

    it('merges groups that are too short (< 3 words)', () => {
        const sentence = 'Il dit : bonjour et merci, puis il partit rapidement.';
        const result = autoSegmentSentence(sentence);
        result.forEach(group => {
            const wc = group.trim().split(/\s+/).length;
            expect(wc).toBeGreaterThanOrEqual(3);
        });
    });

    it('hard-splits very long fragments without natural breaks', () => {
        const longFrag = 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze.';
        const result = autoSegmentSentence(longFrag);
        result.forEach(group => {
            const wc = group.trim().split(/\s+/).length;
            expect(wc).toBeLessThanOrEqual(10);
        });
    });

    it('roundtrip: groups reconvert to original text', () => {
        const sentence = 'Les pierres blanches brillaient sous la lumière, et quelques lézards effarouchés s\'enfuyaient à leur approche.';
        const groups = autoSegmentSentence(sentence);
        const reconstructed = groups.join(' ');
        const normalizeWs = s => s.replace(/\s+/g, ' ').trim();
        expect(normalizeWs(reconstructed)).toBe(normalizeWs(sentence));
    });

    it('roundtrip: multiple sentences from a real dictée text', () => {
        const texte = `La neige tombait depuis le matin, recouvrant les toits et les chemins d'un épais manteau blanc. Les rues du village étaient désertes ; seul le boulanger, levé avant l'aube, avait allumé son four dont la chaleur bienfaisante réchauffait les murs de la boutique.`;
        const sentences = texte.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
        for (const sentence of sentences) {
            const groups = autoSegmentSentence(sentence);
            const reconstructed = groups.join(' ');
            const normalizeWs = s => s.replace(/\s+/g, ' ').trim();
            expect(normalizeWs(reconstructed)).toBe(normalizeWs(sentence));
        }
    });
});

// -----------------------------------------------
// getWordGroups
// -----------------------------------------------
describe('getWordGroups', () => {
    it('uses manually curated groupes when they exist', () => {
        const dictee = {
            texte: 'Le petit Marcel marchait dans les collines parfumées de thym et de lavande.',
            groupes: [
                'Le petit Marcel',
                'marchait dans les collines',
                'parfumées de thym et de lavande.',
            ],
        };
        const result = getWordGroups(dictee);
        expect(result).toHaveLength(1); // 1 sentence
        expect(result[0].groups).toEqual(dictee.groupes);
    });

    it('auto-segments when groupes is missing (AI-generated dictée)', () => {
        const dictee = {
            texte: 'La neige tombait depuis le matin, recouvrant les toits et les chemins.',
        };
        const result = getWordGroups(dictee);
        expect(result).toHaveLength(1);
        expect(result[0].groups.length).toBeGreaterThan(0);
    });

    it('auto-segments when groupes is empty array', () => {
        const dictee = {
            texte: 'Elle regardait le paysage. Il faisait beau.',
            groupes: [],
        };
        const result = getWordGroups(dictee);
        expect(result).toHaveLength(2);
    });

    it('maps multi-sentence groups correctly', () => {
        const dictee = {
            texte: 'Il fait beau. Le ciel est bleu.',
            groupes: ['Il fait beau.', 'Le ciel est bleu.'],
        };
        const result = getWordGroups(dictee);
        expect(result).toHaveLength(2);
        expect(result[0].groups).toEqual(['Il fait beau.']);
        expect(result[1].groups).toEqual(['Le ciel est bleu.']);
    });

    it('roundtrip: all auto-generated groups cover the full original text', () => {
        const dictee = {
            texte: `Gervaise regardait les grands boulevards avec un étonnement mêlé de crainte. La foule pressée, les omnibus qui passaient dans un vacarme assourdissant, les devantures illuminées des magasins, tout l'étourdissait.`,
        };
        const result = getWordGroups(dictee);
        const allGroups = result.flatMap(block => block.groups);
        const reconstructed = allGroups.join(' ');
        const normalizeWs = s => s.replace(/\s+/g, ' ').trim();
        expect(normalizeWs(reconstructed)).toBe(normalizeWs(dictee.texte));
    });

    it('handles real dictée data from dictees.js (dictée 1)', () => {
        const dictee = {
            texte: `Le petit Marcel marchait dans les collines parfumées de thym et de lavande. Il suivait son père qui portait sur l'épaule un grand sac de toile. Les cigales chantaient dans les arbres, et le soleil éclatant les obligeait à plisser les yeux. C'était un matin d'août, et l'enfant découvrait pour la première fois les merveilles de la garrigue provençale. Les pierres blanches brillaient sous la lumière, et quelques lézards effarouchés s'enfuyaient à leur approche. Il n'avait jamais été aussi heureux.`,
            groupes: [
                "Le petit Marcel",
                "marchait dans les collines",
                "parfumées de thym et de lavande.",
                "Il suivait son père",
                "qui portait sur l'épaule",
                "un grand sac de toile.",
                "Les cigales chantaient",
                "dans les arbres,",
                "et le soleil éclatant",
                "les obligeait à plisser les yeux.",
                "C'était un matin d'août,",
                "et l'enfant découvrait",
                "pour la première fois",
                "les merveilles de la garrigue provençale.",
                "Les pierres blanches",
                "brillaient sous la lumière,",
                "et quelques lézards effarouchés",
                "s'enfuyaient à leur approche.",
                "Il n'avait jamais été",
                "aussi heureux."
            ],
        };
        const result = getWordGroups(dictee);
        // Should have 6 sentences
        expect(result).toHaveLength(6);
        // All pre-defined groups should appear in the output
        const allGroups = result.flatMap(block => block.groups);
        expect(allGroups).toEqual(dictee.groupes);
    });
});
