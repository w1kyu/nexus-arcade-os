// @ts-check
// 30 Handcrafted Breakout Levels
// Block types:
// 0: Empty
// 1: Normal (1 hit, Cyan)
// 2: Multi-hit (2 hits, Orange)
// 3: Heavy (3 hits, Purple)
// 4: Unbreakable (Metal/Gray)
// 5: Explosive (Red, detonates adjacent blocks)
// 6: Power-up carrier (Gold/Sparkle)

export const COLS = 10;
export const ROWS = 12;

/**
 * @typedef {{ id: number, name: string, layout: number[][] }} BreakoutLevel
 */

/**
 * Creates 30 levels with diverse geometric patterns and challenges
 * @returns {BreakoutLevel[]}
 */
export function createBreakoutLevels() {
  /** @type {BreakoutLevel[]} */
  const levels = [];

  const add = (id, name, patternFn) => {
    /** @type {number[][]} */
    const layout = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push(patternFn(r, c));
      }
      layout.push(row);
    }
    levels.push({ id, name, layout });
  };

  // 1: First Steps (simple stripes)
  add(1, 'First Steps', (r, _c) => (r >= 2 && r <= 5 ? (r === 2 ? 6 : 1) : 0));

  // 2: Rainbow Rows (multi-layer)
  add(2, 'Rainbow Rows', (r, _c) => (r >= 1 && r <= 5 ? (r === 1 ? 2 : r === 3 ? 6 : 1) : 0));

  // 3: Checkerboard
  add(3, 'Checkerboard', (r, c) => (r >= 1 && r <= 6 ? ((r + c) % 2 === 0 ? 1 : 2) : 0));

  // 4: Pyramid
  add(4, 'Pyramid', (r, c) => {
    if (r >= 1 && r <= 5 && c >= 4 - r && c <= 5 + r) {
      return r === 1 ? 6 : r === 5 ? 2 : 1;
    }
    return 0;
  });

  // 5: Inverted Pyramid
  add(5, 'Inverted Pyramid', (r, c) => {
    if (r >= 1 && r <= 5 && c >= r - 1 && c <= 10 - r) {
      return r === 5 ? 6 : 1;
    }
    return 0;
  });

  // 6: Diamond
  add(6, 'Diamond Core', (r, c) => {
    const dist = Math.abs(c - 4.5) + Math.abs(r - 4.5);
    if (dist <= 3.5) {
      if (dist <= 1) return 6;
      return dist <= 2 ? 2 : 1;
    }
    return 0;
  });

  // 7: Fortress Wall (unbreakables with gate)
  add(7, 'Fortress Wall', (r, c) => {
    if (r === 4) return c === 4 || c === 5 ? 5 : 4;
    if (r >= 1 && r <= 3) return (r + c) % 3 === 0 ? 6 : 2;
    return 0;
  });

  // 8: Bomb Alley (explosives)
  add(8, 'Bomb Alley', (r, c) => {
    if (r >= 2 && r <= 6) {
      if (c === 2 || c === 7) return 5;
      return 1;
    }
    return 0;
  });

  // 9: Space Invader
  add(9, 'Space Invader', (r, c) => {
    const invader = [
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    ];
    if (r < invader.length) {
      const v = invader[r][c];
      return v ? (r === 2 && (c === 4 || c === 5) ? 6 : 1) : 0;
    }
    return 0;
  });

  // 10: Triple Threat (heavy 3-hit blocks)
  add(10, 'Triple Threat', (r, _c) => {
    if (r >= 2 && r <= 4) return 3;
    if (r === 5) return 6;
    return 0;
  });

  // 11: Columns of Doom
  add(11, 'Columns of Doom', (r, c) => (r >= 1 && r <= 6 && c % 2 === 1 ? (r === 1 ? 6 : 2) : 0));

  // 12: Target Reticle
  add(12, 'Target Reticle', (r, c) => {
    if (r === 4 || c === 4 || c === 5) return 1;
    if (Math.abs(c - 4.5) === 3.5 || Math.abs(r - 4) === 3) return 2;
    if (r === 4 && (c === 4 || c === 5)) return 6;
    return 0;
  });

  // 13: X-Marks
  add(13, 'Crossfire', (r, c) => {
    if (c === r || c === 9 - r) return 5;
    if (r >= 1 && r <= 7) return 1;
    return 0;
  });

  // 14: Castle Gate
  add(14, 'Castle Gate', (r, c) => {
    if (c === 0 || c === 9) return r >= 1 && r <= 7 ? 4 : 0;
    if (r === 2) return 4;
    if (r >= 3 && r <= 6) return (r + c) % 2 === 0 ? 6 : 2;
    return 0;
  });

  // 15: Honeycomb
  add(15, 'Honeycomb', (r, c) => (r >= 1 && r <= 6 ? ((r % 2 === 0 ? c % 2 === 0 : c % 2 !== 0) ? 2 : 1) : 0));

  // 16: Minefield (heavy explosive mix)
  add(16, 'Minefield', (r, c) => (r >= 1 && r <= 6 ? ((r * 3 + c * 7) % 5 === 0 ? 5 : (r + c) % 4 === 0 ? 6 : 1) : 0));

  // 17: Hourglass
  add(17, 'Hourglass', (r, c) => {
    if (r >= 1 && r <= 3 && c >= r - 1 && c <= 10 - r) return 2;
    if (r >= 4 && r <= 6 && c >= 6 - r && c <= 3 + r) return 2;
    if (r === 3 || r === 4) return 6;
    return 0;
  });

  // 18: Citadel
  add(18, 'Citadel', (r, c) => {
    if (r === 3 && c >= 2 && c <= 7) return 4;
    if (r >= 1 && r <= 6) return (r + c) % 3 === 0 ? 3 : 1;
    return 0;
  });

  // 19: Helix
  add(19, 'DNA Helix', (r, c) => {
    const shift = Math.floor(Math.sin(r * 0.8) * 3) + 4;
    if (Math.abs(c - shift) <= 1 && r >= 1 && r <= 8) return 6;
    if (r >= 1 && r <= 8 && c % 3 === 0) return 2;
    return 0;
  });

  // 20: Titanium Vault
  add(20, 'Titanium Vault', (r, c) => {
    if ((r === 1 || r === 6) && c >= 2 && c <= 7) return 4;
    if ((c === 2 || c === 7) && r >= 2 && r <= 5) return 4;
    if (r >= 2 && r <= 5 && c >= 3 && c <= 6) return 6;
    return 1;
  });

  // 21: Wave Motion
  add(21, 'Wave Motion', (r, c) => {
    const waveR = Math.floor(Math.sin(c * 0.7) * 2) + 3;
    if (r === waveR) return 5;
    if (r === waveR - 1 || r === waveR + 1) return 1;
    return 0;
  });

  // 22: Binary Matrix
  add(22, 'Binary Matrix', (r, c) => (r >= 1 && r <= 6 ? ((c ^ r) % 2 === 0 ? 3 : 1) : 0));

  // 23: Skull Island
  add(23, 'Skull Island', (r, c) => {
    if (r >= 1 && r <= 6 && c >= 1 && c <= 8) {
      if (r === 3 && (c === 3 || c === 6)) return 0; // Eye sockets
      if (r === 5 && (c === 4 || c === 5)) return 5; // Nose bomb
      return 2;
    }
    return 0;
  });

  // 24: Maze of Light
  add(24, 'Maze of Light', (r, c) => {
    if (r % 2 === 1 && c !== (r % 4 === 1 ? 1 : 8)) return 4;
    if (r % 2 === 0 && r <= 6) return 6;
    return 0;
  });

  // 25: Supernova
  add(25, 'Supernova', (r, c) => {
    if (r === 4 && (c === 4 || c === 5)) return 5;
    const dist = Math.hypot(c - 4.5, r - 4);
    if (dist <= 3) return 3;
    if (dist <= 4.5) return 1;
    return 0;
  });

  // 26: Grid Lock
  add(26, 'Grid Lock', (r, c) => {
    if (r % 2 === 0 && c % 2 === 0 && r >= 2 && r <= 6) return 4;
    if (r >= 1 && r <= 7) return (r + c) % 3 === 0 ? 6 : 2;
    return 0;
  });

  // 27: Iron Curtain
  add(27, 'Iron Curtain', (r, _c) => {
    if (r === 3) return 4;
    if (r === 2) return 5;
    if (r >= 4 && r <= 7) return 3;
    return 0;
  });

  // 28: Dragon Wings
  add(28, 'Dragon Wings', (r, c) => {
    const dist = Math.abs(c - 4.5);
    if (r >= dist && r <= dist + 2) return 2;
    if (r === 6) return 6;
    return 0;
  });

  // 29: Armageddon
  add(29, 'Armageddon', (r, c) => {
    if (r >= 1 && r <= 6) {
      if ((r + c) % 4 === 0) return 5;
      if ((r + c) % 3 === 0) return 3;
      return 2;
    }
    return 0;
  });

  // 30: Grand Nexus
  add(30, 'Grand Nexus', (r, c) => {
    if (r === 1 || r === 7) return 4;
    if (c === 0 || c === 9) return 4;
    if (r === 4 && (c === 4 || c === 5)) return 6;
    return (r + c) % 2 === 0 ? 3 : 2;
  });

  return levels;
}
