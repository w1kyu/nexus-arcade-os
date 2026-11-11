// @ts-check

/**
 * Cellular Automata Sandbox Logic & Multiple Rule Systems
 */

export const COLS = 60;
export const ROWS = 45;

export const RULES = {
  conway: {
    id: 'conway',
    name: "Conway's Life (B3/S23)",
    birth: [3],
    survival: [2, 3],
    states: 2,
  },
  highlife: {
    id: 'highlife',
    name: 'HighLife (B36/S23)',
    birth: [3, 6],
    survival: [2, 3],
    states: 2,
  },
  seeds: {
    id: 'seeds',
    name: 'Seeds (B2/S)',
    birth: [2],
    survival: [],
    states: 2,
  },
  brians_brain: {
    id: 'brians_brain',
    name: "Brian's Brain (3-State)",
    birth: [2],
    survival: [],
    states: 3, // 0 = off, 1 = alive, 2 = dying
  },
  day_night: {
    id: 'day_night',
    name: 'Day & Night (B3678/S34678)',
    birth: [3, 6, 7, 8],
    survival: [3, 4, 6, 7, 8],
    states: 2,
  },
};

/**
 * Pattern Library
 */
export const PATTERNS = {
  glider: {
    name: 'Glider',
    width: 3,
    height: 3,
    cells: [
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
  lwss: {
    name: 'Lightweight Spaceship',
    width: 5,
    height: 4,
    cells: [
      [0, 1, 0, 0, 1],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 0],
    ],
  },
  blinker: {
    name: 'Blinker',
    width: 3,
    height: 1,
    cells: [[1, 1, 1]],
  },
  pulsar: {
    name: 'Pulsar',
    width: 13,
    height: 13,
    cells: [
      [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
    ],
  },
  gosper_gun: {
    name: 'Gosper Glider Gun',
    width: 36,
    height: 9,
    cells: createGosperGunCells(),
  },
};

function createGosperGunCells() {
  const g = Array.from({ length: 9 }, () => new Array(36).fill(0));
  // Left square
  g[4][0] = 1;
  g[4][1] = 1;
  g[5][0] = 1;
  g[5][1] = 1;
  // Left mechanism
  g[4][10] = 1;
  g[5][10] = 1;
  g[6][10] = 1;
  g[3][11] = 1;
  g[7][11] = 1;
  g[2][12] = 1;
  g[8][12] = 1;
  g[2][13] = 1;
  g[8][13] = 1;
  g[5][14] = 1;
  g[3][15] = 1;
  g[7][15] = 1;
  g[4][16] = 1;
  g[5][16] = 1;
  g[6][16] = 1;
  g[5][17] = 1;
  // Right mechanism
  g[2][20] = 1;
  g[3][20] = 1;
  g[4][20] = 1;
  g[2][21] = 1;
  g[3][21] = 1;
  g[4][21] = 1;
  g[1][22] = 1;
  g[5][22] = 1;
  g[0][24] = 1;
  g[1][24] = 1;
  g[5][24] = 1;
  g[6][24] = 1;
  // Right square
  g[2][34] = 1;
  g[3][34] = 1;
  g[2][35] = 1;
  g[3][35] = 1;
  return g;
}

/**
 * Creates empty grid of cells (Uint8Array)
 */
export function createGrid() {
  return new Uint8Array(COLS * ROWS);
}

/**
 * Counts 8-neighbors with toroidal wrap
 * @param {Uint8Array} grid
 * @param {number} x
 * @param {number} y
 */
export function countNeighbors(grid, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (x + dx + COLS) % COLS;
      const ny = (y + dy + ROWS) % ROWS;
      if (grid[ny * COLS + nx] === 1) count++;
    }
  }
  return count;
}

/**
 * Advances the simulation by 1 generation
 * @param {Uint8Array} grid
 * @param {keyof typeof RULES} [ruleId='conway']
 */
export function stepGeneration(grid, ruleId = 'conway') {
  const rule = RULES[ruleId] || RULES.conway;
  const next = new Uint8Array(COLS * ROWS);

  if (rule.states === 3) {
    // Brian's Brain: 0 = off, 1 = alive, 2 = dying
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const idx = y * COLS + x;
        const state = grid[idx];
        if (state === 1) {
          next[idx] = 2; // alive becomes dying
        } else if (state === 2) {
          next[idx] = 0; // dying becomes off
        } else {
          // Off cell is born if exactly 2 neighbors are alive (state 1)
          const n = countNeighbors(grid, x, y);
          if (n === 2) next[idx] = 1;
        }
      }
    }
  } else {
    // 2-state rules (Conway, HighLife, Seeds, Day&Night)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const idx = y * COLS + x;
        const alive = grid[idx] === 1;
        const n = countNeighbors(grid, x, y);

        if (alive) {
          next[idx] = rule.survival.includes(n) ? 1 : 0;
        } else {
          next[idx] = rule.birth.includes(n) ? 1 : 0;
        }
      }
    }
  }

  return next;
}

/**
 * Stamps a pattern onto the grid
 * @param {Uint8Array} grid
 * @param {keyof typeof PATTERNS} patternKey
 * @param {number} startX
 * @param {number} startY
 */
export function stampPattern(grid, patternKey, startX, startY) {
  const p = PATTERNS[patternKey];
  if (!p) return;

  for (let r = 0; r < p.height; r++) {
    for (let c = 0; c < p.width; c++) {
      if (p.cells[r][c] === 1) {
        const gx = (startX + c) % COLS;
        const gy = (startY + r) % ROWS;
        grid[gy * COLS + gx] = 1;
      }
    }
  }
}

/**
 * Counts live cells (state === 1)
 * @param {Uint8Array} grid
 */
export function getPopulation(grid) {
  let pop = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 1) pop++;
  }
  return pop;
}
