import { describe, expect, it } from 'vitest';
import { BUNDLED_PUZZLES, computeLineClues, generateProceduralPuzzle } from '../../src/apps/nonogram/puzzles.js';

describe('Nonogram (Picross) Clue Derivation and Generators', () => {
  it('correctly computes run clues from cell arrays', () => {
    expect(computeLineClues([1, 1, 0, 1])).toEqual([2, 1]);
    expect(computeLineClues([0, 0, 0])).toEqual([0]);
    expect(computeLineClues([1, 1, 1, 1, 1])).toEqual([5]);
    expect(computeLineClues([1, 0, 1, 0, 1])).toEqual([1, 1, 1]);
  });

  it('validates bundled puzzle integrity', () => {
    expect(BUNDLED_PUZZLES.length).toBeGreaterThanOrEqual(5);
    for (const p of BUNDLED_PUZZLES) {
      expect(p.rowClues.length).toBe(p.height);
      expect(p.colClues.length).toBe(p.width);
      expect(p.solution.length).toBe(p.height);
      expect(p.solution[0].length).toBe(p.width);
    }
  });

  it('generates consistent procedural puzzles with matching dimensions', () => {
    const p1 = generateProceduralPuzzle(10, 10, 42);
    expect(p1.width).toBe(10);
    expect(p1.height).toBe(10);
    expect(p1.rowClues.length).toBe(10);
    expect(p1.colClues.length).toBe(10);

    const p2 = generateProceduralPuzzle(10, 10, 42);
    expect(p1.solution).toEqual(p2.solution);
  });
});
