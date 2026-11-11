import { describe, expect, it } from 'vitest';
import {
  I_KICK_DATA,
  JLSTZ_KICK_DATA,
  SHAPES,
  TETROMINO_NAMES,
  createSevenBag,
  getWallKicks,
} from '../../src/apps/blockfall/srs.js';

describe('Blockfall SRS and piece definitions', () => {
  it('defines all 7 tetrominoes with 4 rotation states', () => {
    expect(TETROMINO_NAMES).toHaveLength(7);
    for (const name of TETROMINO_NAMES) {
      const shape = SHAPES[name];
      expect(shape).toBeDefined();
      expect(shape).toHaveLength(4);
      // Each state is 2D matrix
      for (const rot of shape) {
        expect(Array.isArray(rot)).toBe(true);
        expect(rot.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('generates 7-bag containing exactly one of each tetromino', () => {
    const bag = createSevenBag();
    expect(bag).toHaveLength(7);
    const sorted = [...bag].sort();
    expect(sorted).toEqual([...TETROMINO_NAMES].sort());
  });

  it('provides standard SRS wall kicks for JLSTZ and I pieces', () => {
    // JLSTZ 0 -> 1 kick tests
    const jKicks = getWallKicks('J', 0, 1);
    expect(jKicks).toEqual(JLSTZ_KICK_DATA['0->1']);
    expect(jKicks).toHaveLength(5);
    expect(jKicks[0]).toEqual([0, 0]);

    // I piece 0 -> 1 kick tests
    const iKicks = getWallKicks('I', 0, 1);
    expect(iKicks).toEqual(I_KICK_DATA['0->1']);
    expect(iKicks).toHaveLength(5);
    expect(iKicks[0]).toEqual([0, 0]);

    // O piece requires no kicks
    const oKicks = getWallKicks('O', 0, 1);
    expect(oKicks).toEqual([[0, 0]]);
  });

  it('preserves mino cell counts across all rotations', () => {
    // I has 4, J has 4, L has 4, O has 4, S has 4, T has 4, Z has 4
    for (const name of TETROMINO_NAMES) {
      for (let rot = 0; rot < 4; rot++) {
        const matrix = SHAPES[name][rot];
        const minos = matrix.flat().filter((c) => c === 1).length;
        expect(minos).toBe(4);
      }
    }
  });
});
