import { describe, it, expect } from 'vitest';
import {
  BUNDLED_QUESTIONS,
  getStreakMultiplier,
  get5050Eliminations,
  validateQuizPack,
} from '../../src/apps/quiz/logic.js';

describe('Quiz Arena Question Bank & Game Logic', () => {
  it('contains comprehensive bilingual question bank with valid metadata', () => {
    expect(BUNDLED_QUESTIONS.length).toBeGreaterThanOrEqual(10);
    for (const q of BUNDLED_QUESTIONS) {
      expect(q.id).toBeDefined();
      expect(q.category).toBeDefined();
      expect(q.text.en).toBeDefined();
      expect(q.text.de).toBeDefined();
      expect(q.options.en.length).toBe(4);
      expect(q.options.de.length).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThanOrEqual(3);
      expect(q.explanation.en).toBeDefined();
      expect(q.explanation.de).toBeDefined();
    }
  });

  it('calculates streak multipliers accurately', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(1)).toBe(1.0);
    expect(getStreakMultiplier(2)).toBe(1.5);
    expect(getStreakMultiplier(3)).toBe(2.0);
    expect(getStreakMultiplier(4)).toBe(2.0);
    expect(getStreakMultiplier(5)).toBe(3.0);
    expect(getStreakMultiplier(10)).toBe(3.0);
  });

  it('50:50 lifeline eliminates 2 incorrect options without eliminating correct answer', () => {
    const correctIndex = 1;
    const eliminated = get5050Eliminations(correctIndex);
    expect(eliminated.length).toBe(2);
    expect(eliminated).not.toContain(correctIndex);
    expect(eliminated.every((i) => i >= 0 && i <= 3)).toBe(true);
  });

  it('validates custom user quiz packs', () => {
    const validPack = {
      title: 'Custom Trivia',
      questions: [
        {
          text: 'What is 2 + 2?',
          options: ['1', '2', '3', '4'],
          correct: 3,
        },
      ],
    };
    expect(validateQuizPack(validPack)).toBe(true);

    // Invalid packs
    expect(validateQuizPack(null)).toBe(false);
    expect(validateQuizPack({})).toBe(false);
    expect(validateQuizPack({ title: 'No Qs', questions: [] })).toBe(false);
    expect(validateQuizPack({ title: 'Bad options', questions: [{ text: 'Q', options: ['1'], correct: 0 }] })).toBe(
      false,
    );
  });
});
