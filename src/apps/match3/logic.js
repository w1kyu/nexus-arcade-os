// @ts-check

/**
 * Match-3 Puzzle Game Logic & Cascade Simulation
 */

export const BOARD_SIZE = 8;
export const GEM_TYPES = ['ruby', 'sapphire', 'emerald', 'amethyst', 'topaz', 'diamond'];

export const SPECIAL = {
  NONE: 0,
  LINE_H: 1,
  LINE_V: 2,
  BOMB: 3,
  COLOR: 4,
};

/**
 * @typedef {object} Gem
 * @property {number} id
 * @property {string} type
 * @property {number} special 0=none, 1=lineH, 2=lineV, 3=bomb, 4=color
 */

/**
 * Creates initial 8x8 board with no existing 3-matches
 * @param {() => number} [rng=Math.random]
 */
export function createMatch3Board(rng = Math.random) {
  let id = 1;
  /** @type {Gem[]} */
  const board = new Array(BOARD_SIZE * BOARD_SIZE);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      let type;
      do {
        type = GEM_TYPES[Math.floor(rng() * GEM_TYPES.length)];
      } while (
        (c >= 2 && board[r * BOARD_SIZE + c - 1]?.type === type && board[r * BOARD_SIZE + c - 2]?.type === type) ||
        (r >= 2 && board[(r - 1) * BOARD_SIZE + c]?.type === type && board[(r - 2) * BOARD_SIZE + c]?.type === type)
      );

      board[r * BOARD_SIZE + c] = { id: id++, type, special: SPECIAL.NONE };
    }
  }

  return board;
}

/**
 * Checks if two cells are adjacent
 * @param {number} idx1
 * @param {number} idx2
 */
export function isAdjacent(idx1, idx2) {
  const r1 = Math.floor(idx1 / BOARD_SIZE);
  const c1 = idx1 % BOARD_SIZE;
  const r2 = Math.floor(idx2 / BOARD_SIZE);
  const c2 = idx2 % BOARD_SIZE;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

/**
 * Finds all matching groups on the board
 * @param {Gem[]} board
 */
export function findMatches(board) {
  const matches = new Set();
  /** @type {{ indices: number[], type: string, shape: 'line3' | 'line4' | 'line5' | 'cross' }[]} */
  const groups = [];

  // Horizontal matches
  for (let r = 0; r < BOARD_SIZE; r++) {
    let matchLen = 1;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = r * BOARD_SIZE + c;
      const nextIdx = r * BOARD_SIZE + c + 1;
      const cur = board[idx];
      const next = c + 1 < BOARD_SIZE ? board[nextIdx] : null;

      if (cur && next && cur.type === next.type) {
        matchLen++;
      } else {
        if (matchLen >= 3) {
          const matchedIndices = [];
          for (let k = 0; k < matchLen; k++) {
            const mIdx = r * BOARD_SIZE + (c - k);
            matches.add(mIdx);
            matchedIndices.push(mIdx);
          }
          groups.push({
            indices: matchedIndices,
            type: board[r * BOARD_SIZE + c].type,
            shape: matchLen === 3 ? 'line3' : matchLen === 4 ? 'line4' : 'line5',
          });
        }
        matchLen = 1;
      }
    }
  }

  // Vertical matches
  for (let c = 0; c < BOARD_SIZE; c++) {
    let matchLen = 1;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const idx = r * BOARD_SIZE + c;
      const nextIdx = (r + 1) * BOARD_SIZE + c;
      const cur = board[idx];
      const next = r + 1 < BOARD_SIZE ? board[nextIdx] : null;

      if (cur && next && cur.type === next.type) {
        matchLen++;
      } else {
        if (matchLen >= 3) {
          const matchedIndices = [];
          for (let k = 0; k < matchLen; k++) {
            const mIdx = (r - k) * BOARD_SIZE + c;
            matches.add(mIdx);
            matchedIndices.push(mIdx);
          }
          groups.push({
            indices: matchedIndices,
            type: board[r * BOARD_SIZE + c].type,
            shape: matchLen === 3 ? 'line3' : matchLen === 4 ? 'line4' : 'line5',
          });
        }
        matchLen = 1;
      }
    }
  }

  return { matchedSet: matches, groups };
}

/**
 * Swaps two gems on the board
 * @param {Gem[]} board
 * @param {number} idx1
 * @param {number} idx2
 */
export function swapGems(board, idx1, idx2) {
  const tmp = board[idx1];
  board[idx1] = board[idx2];
  board[idx2] = tmp;
}

/**
 * Applies gravity drop and refills empty cells from top
 * @param {Gem[]} board
 * @param {Set<number>} clearedIndices
 * @param {() => number} [rng=Math.random]
 */
export function applyGravityAndRefill(board, clearedIndices, rng = Math.random) {
  // Clear matched indices
  for (const idx of clearedIndices) {
    board[idx] = /** @type {any} */ (null);
  }

  let nextId = Date.now();

  // Drop columns
  for (let c = 0; c < BOARD_SIZE; c++) {
    let emptyRow = BOARD_SIZE - 1;
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const idx = r * BOARD_SIZE + c;
      if (board[idx] !== null) {
        if (emptyRow !== r) {
          board[emptyRow * BOARD_SIZE + c] = board[idx];
          board[idx] = /** @type {any} */ (null);
        }
        emptyRow--;
      }
    }

    // Refill remaining empty rows at top
    for (let r = emptyRow; r >= 0; r--) {
      const type = GEM_TYPES[Math.floor(rng() * GEM_TYPES.length)];
      board[r * BOARD_SIZE + c] = { id: nextId++, type, special: SPECIAL.NONE };
    }
  }
}

/**
 * Level Goal Definitions
 */
export const MATCH3_LEVELS = [
  { id: 1, moves: 20, targetScore: 1500, goalGem: 'ruby', goalCount: 15 },
  { id: 2, moves: 22, targetScore: 2000, goalGem: 'sapphire', goalCount: 20 },
  { id: 3, moves: 25, targetScore: 2500, goalGem: 'emerald', goalCount: 20 },
  { id: 4, moves: 20, targetScore: 3000, goalGem: 'amethyst', goalCount: 25 },
  { id: 5, moves: 24, targetScore: 3500, goalGem: 'topaz', goalCount: 25 },
  { id: 6, moves: 22, targetScore: 4000, goalGem: 'diamond', goalCount: 30 },
  { id: 7, moves: 25, targetScore: 4500, goalGem: 'ruby', goalCount: 35 },
  { id: 8, moves: 20, targetScore: 5000, goalGem: 'sapphire', goalCount: 35 },
  { id: 9, moves: 26, targetScore: 5500, goalGem: 'emerald', goalCount: 40 },
  { id: 10, moves: 25, targetScore: 6000, goalGem: 'diamond', goalCount: 40 },
];

/**
 * Creates match3 game state
 * @param {number} [levelIndex=0]
 */
export function createMatch3State(levelIndex = 0) {
  const level = MATCH3_LEVELS[levelIndex] || MATCH3_LEVELS[0];
  return {
    levelIndex,
    level,
    board: createMatch3Board(),
    score: 0,
    movesRemaining: level.moves,
    goalCollected: 0,
    combo: 1,
    gameOver: false,
    won: false,
  };
}
