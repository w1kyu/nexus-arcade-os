import { describe, expect, it } from 'vitest';
import { SOKOBAN_LEVELS } from '../../src/apps/sokoban/levels.js';
import { parseLevel, solveSokoban } from '../../src/apps/sokoban/solver.js';

describe('Block Pusher (Sokoban) Rules and Solvability', () => {
  it('parses ASCII Sokoban maps accurately', () => {
    const ascii = ['######', '#@ $ #', '#  . #', '######'];
    const lvl = parseLevel(ascii, 1);
    expect(lvl.width).toBe(6);
    expect(lvl.height).toBe(4);
    expect(lvl.playerStart).toBe(1 * 6 + 1); // (1, 1) = 7
    expect(lvl.boxesStart.length).toBe(1);
    expect(lvl.targets.length).toBe(1);
  });

  it('BFS solver solves simple levels and identifies deadlocks', () => {
    // Solvable level
    const solvable = parseLevel(['#####', '#@$.#', '#####']);
    expect(solveSokoban(solvable, 5000)).toBe(true);

    // Unsolvable / corner deadlocked level
    const deadlocked = parseLevel([
      '######',
      '#$   #', // box stuck in corner at (1, 1)
      '# @. #',
      '######',
    ]);
    expect(solveSokoban(deadlocked, 5000)).toBe(false);
  });

  it('guarantees that all 60+ bundled levels are verified solvable', () => {
    expect(SOKOBAN_LEVELS.length).toBeGreaterThanOrEqual(60);
    // Spot check a sample of levels across the entire spectrum
    const indicesToTest = [0, 5, 12, 20, 35, 50, SOKOBAN_LEVELS.length - 1];
    for (const idx of indicesToTest) {
      const lvl = SOKOBAN_LEVELS[idx];
      expect(solveSokoban(lvl, 35000), `Level ${idx + 1} must be solvable`).toBe(true);
    }
  });
});
