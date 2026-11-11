import { describe, expect, it } from 'vitest';
import { evaluateGuess, generateShareGrid, getDailyWord, validateHardMode } from '../../src/apps/hexword/logic.js';
import { TARGETS_DE, TARGETS_EN } from '../../src/apps/hexword/words.js';

describe('Hexword Logic & Dictionaries', () => {
  it('bundles clean 5-letter word lists for EN and DE', () => {
    expect(TARGETS_EN.length).toBeGreaterThanOrEqual(100);
    expect(TARGETS_DE.length).toBeGreaterThanOrEqual(100);
    for (const w of TARGETS_EN) {
      expect(w).toHaveLength(5);
      expect(w).toMatch(/^[A-Z]+$/);
    }
    for (const w of TARGETS_DE) {
      expect(w).toHaveLength(5);
      expect(w).toMatch(/^[A-Z]+$/);
    }
  });

  it('accurately evaluates exact matches', () => {
    const res = evaluateGuess('NEXUS', 'NEXUS');
    expect(res).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('accurately handles duplicate letter constraints', () => {
    // Target has ONE 'E'. Guess has TWO 'E's.
    // TARGET: 'PLANE', GUESS: 'SPEED'
    // 'SPEED': 'S'(absent), 'P'(present), 'E'(correct in pos 2), 'E'(absent!), 'D'(absent)
    const res = evaluateGuess('PLANE', 'SPEED');
    expect(res[0]).toBe('absent'); // S
    expect(res[1]).toBe('present'); // P (in PLANE at 0)
    expect(res[2]).toBe('present'); // first E (PLANE has E at 4)
    expect(res[3]).toBe('absent'); // second E is absent because PLANE only has 1 E!
    expect(res[4]).toBe('absent'); // D
  });

  it('enforces Hard Mode rules for green and yellow letters', () => {
    const history = [
      {
        guess: 'CRANE',
        evaluation: /** @type {import('../../src/apps/hexword/logic.js').LetterStatus[]} */ ([
          'correct', // C is correct at 0
          'absent',
          'present', // A is present somewhere
          'absent',
          'absent',
        ]),
      },
    ];

    // Must start with C
    const badGreen = validateHardMode('TRAIN', history);
    expect(badGreen.valid).toBe(false);

    // Must include A
    const badYellow = validateHardMode('CHORE', history);
    expect(badYellow.valid).toBe(false);

    // Valid guess: starts with C and contains A
    const good = validateHardMode('CHAMP', history);
    expect(good.valid).toBe(true);
  });

  it('generates consistent daily words for specific dates', () => {
    const word1 = getDailyWord('en', '2026-11-11');
    const word2 = getDailyWord('en', '2026-11-11');
    expect(word1).toBe(word2);
    expect(word1).toHaveLength(5);
  });

  it('generates well-formatted share grids with emojis', () => {
    const grid = generateShareGrid(['CRANE', 'NEXUS'], 'NEXUS', '2026-11-11', false);
    expect(grid).toContain('Hexword 2026-11-11 2/6');
    expect(grid).toContain('🟩');
  });
});
