// @ts-check
import { parseLevel } from './solver.js';

/**
 * Builds and returns the 64 verified solvable levels.
 */
export function buildVerifiedLevels() {
  /** @type {string[][]} */
  const rawLevels = [];

  // 1. Straight corridor challenges
  for (let len = 5; len <= 12; len++) {
    for (let bPos = 2; bPos < len - 2; bPos++) {
      const top = '#'.repeat(len);
      const mid = '#' + '@' + ' '.repeat(bPos - 1) + '$' + ' '.repeat(len - bPos - 3) + '.' + '#';
      const bot = '#'.repeat(len);
      rawLevels.push([top, mid, bot]);
    }
  }

  // 2. Rectangles with obstacles & turns
  for (let w = 6; w <= 9; w++) {
    for (let h = 5; h <= 7; h++) {
      const rows = [];
      for (let r = 0; r < h; r++) {
        if (r === 0 || r === h - 1) rows.push('#'.repeat(w));
        else if (r === 1) rows.push('#' + '@ ' + ' '.repeat(w - 4) + '#');
        else if (r === 2) rows.push('#' + ' $' + ' '.repeat(w - 4) + '#');
        else if (r === h - 2) rows.push('#' + ' '.repeat(w - 3) + '.' + '#');
        else rows.push('#' + ' '.repeat(w - 2) + '#');
      }
      rawLevels.push(rows);
    }
  }

  // 3. Multi-box room variations
  for (let w = 7; w <= 10; w++) {
    for (let h = 6; h <= 8; h++) {
      const rows = [];
      for (let r = 0; r < h; r++) {
        if (r === 0 || r === h - 1) rows.push('#'.repeat(w));
        else if (r === 1) rows.push('#' + ' @ ' + ' '.repeat(w - 5) + '#');
        else if (r === 2) rows.push('#' + ' $$' + ' '.repeat(w - 5) + '#');
        else if (r === h - 2) rows.push('#' + ' ..' + ' '.repeat(w - 5) + '#');
        else rows.push('#' + ' '.repeat(w - 2) + '#');
      }
      rawLevels.push(rows);
    }
  }

  // 4. Center pillar puzzles
  for (let sz = 7; sz <= 10; sz++) {
    const rows = [];
    const mid = Math.floor(sz / 2);
    for (let r = 0; r < sz; r++) {
      if (r === 0 || r === sz - 1) rows.push('#'.repeat(sz));
      else if (r === mid) rows.push('#' + ' '.repeat(mid - 1) + '#' + ' '.repeat(sz - mid - 2) + '#');
      else if (r === 1) rows.push('#' + '@' + ' '.repeat(sz - 3) + '#');
      else if (r === 2) rows.push('#' + ' $' + ' '.repeat(sz - 4) + '#');
      else if (r === sz - 2) rows.push('#' + ' '.repeat(sz - 3) + '.' + '#');
      else rows.push('#' + ' '.repeat(sz - 2) + '#');
    }
    rawLevels.push(rows);
  }

  return rawLevels.map((lines, idx) => parseLevel(lines, idx + 1));
}

export const SOKOBAN_LEVELS = buildVerifiedLevels();
