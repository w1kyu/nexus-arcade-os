import { describe, expect, it } from 'vitest';
import { KEY_FINGER_MAP } from '../../src/apps/typing/content.js';
import { calculateAccuracy, calculateConsistency, calculateRawWpm, calculateWpm } from '../../src/apps/typing/stats.js';

describe('Typing Trainer metrics & layout mapping', () => {
  it('calculates standard WPM and Raw WPM accurately (5 chars per word)', () => {
    // 300 chars in 60 seconds = 60 WPM
    expect(calculateWpm(300, 60)).toBe(60);

    // 150 chars in 30 seconds = 60 WPM
    expect(calculateWpm(150, 30)).toBe(60);

    // 500 keystrokes in 60 seconds = 100 Raw WPM
    expect(calculateRawWpm(500, 60)).toBe(100);

    // 0 elapsed seconds returns 0 without division by zero
    expect(calculateWpm(100, 0)).toBe(0);
  });

  it('calculates accuracy percentage accurately', () => {
    expect(calculateAccuracy(95, 100)).toBe(95);
    expect(calculateAccuracy(49, 50)).toBe(98);
    expect(calculateAccuracy(0, 0)).toBe(100);
  });

  it('evaluates consistency score based on standard deviation', () => {
    // Perfectly consistent pace
    expect(calculateConsistency([60, 60, 60, 60])).toBe(100);

    // High consistency
    const highCons = calculateConsistency([60, 62, 59, 61, 60]);
    expect(highCons).toBeGreaterThanOrEqual(95);

    // Erratic pace
    const erratic = calculateConsistency([20, 80, 10, 95, 30]);
    expect(erratic).toBeLessThan(70);
  });

  it('maps alphanumeric keys, space, and German umlauts to touch typing fingers', () => {
    expect(KEY_FINGER_MAP[' ']).toBe('thumb');
    expect(KEY_FINGER_MAP['f']).toBe('leftIndex');
    expect(KEY_FINGER_MAP['j']).toBe('rightIndex');
    expect(KEY_FINGER_MAP['a']).toBe('leftPinky');
    expect(KEY_FINGER_MAP[';']).toBe('rightPinky');

    // German umlauts
    expect(KEY_FINGER_MAP['ä']).toBe('rightPinky');
    expect(KEY_FINGER_MAP['ö']).toBe('rightRing');
    expect(KEY_FINGER_MAP['ü']).toBe('rightPinky');
    expect(KEY_FINGER_MAP['ß']).toBe('rightPinky');
  });
});
