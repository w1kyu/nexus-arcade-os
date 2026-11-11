// @ts-check
// Nonogram clue derivation, bundled packs, and procedural generator

/**
 * Computes run clues for a row or column of cells (0 = empty, 1 = filled).
 * @param {number[]} line
 * @returns {number[]} e.g. [1, 1, 0, 1] -> [2, 1]; all empty -> [0]
 */
export function computeLineClues(line) {
  /** @type {number[]} */
  const clues = [];
  let currentRun = 0;
  for (const cell of line) {
    if (cell === 1) {
      currentRun++;
    } else if (currentRun > 0) {
      clues.push(currentRun);
      currentRun = 0;
    }
  }
  if (currentRun > 0) clues.push(currentRun);
  return clues.length > 0 ? clues : [0];
}

/**
 * @typedef {object} NonogramPuzzle
 * @property {string} id
 * @property {{ en: string, de: string }} title
 * @property {number} width
 * @property {number} height
 * @property {number[][]} solution 2D array of 0 or 1
 * @property {number[][]} rowClues
 * @property {number[][]} colClues
 */

/**
 * Creates a NonogramPuzzle from a 2D solution array.
 * @param {string} id
 * @param {{ en: string, de: string }} title
 * @param {number[][]} solution
 * @returns {NonogramPuzzle}
 */
export function createPuzzleFromSolution(id, title, solution) {
  const height = solution.length;
  const width = solution[0].length;
  const rowClues = solution.map((row) => computeLineClues(row));

  /** @type {number[][]} */
  const colClues = [];
  for (let c = 0; c < width; c++) {
    const col = [];
    for (let r = 0; r < height; r++) col.push(solution[r][c]);
    colClues.push(computeLineClues(col));
  }

  return {
    id,
    title,
    width,
    height,
    solution,
    rowClues,
    colClues,
  };
}

/**
 * Procedurally generates a nonogram puzzle of given size.
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {string} [name='Random']
 * @returns {NonogramPuzzle}
 */
export function generateProceduralPuzzle(width, height, seed, name = 'Procedural') {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** @type {number[][]} */
  const solution = [];
  for (let r = 0; r < height; r++) {
    const row = [];
    for (let c = 0; c < width; c++) {
      row.push(rnd() > 0.45 ? 1 : 0);
    }
    solution.push(row);
  }

  return createPuzzleFromSolution(
    `proc-${width}x${height}-${seed}`,
    { en: `${name} ${width}×${height}`, de: `${name} ${width}×${height}` },
    solution,
  );
}

// ── Bundled Handcrafted Puzzle Packs ─────────────────────────────────────────

// 1. Heart (5x5)
const HEART_5 = [
  [0, 1, 0, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
];

// 2. Smiley (5x5)
const SMILEY_5 = [
  [0, 1, 0, 1, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 0, 0, 0],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

// 3. Sword (10x10)
const SWORD_10 = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 0, 1, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// 4. Pine Tree (10x10)
const TREE_10 = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
];

// 5. Starship (15x15)
const SPACESHIP_15 = [
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0],
  [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
  [1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1],
  [1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
];

export const BUNDLED_PUZZLES = [
  createPuzzleFromSolution('heart-5', { en: 'Heart (5×5)', de: 'Herz (5×5)' }, HEART_5),
  createPuzzleFromSolution('smiley-5', { en: 'Smiley (5×5)', de: 'Smiley (5×5)' }, SMILEY_5),
  createPuzzleFromSolution('sword-10', { en: 'Cyber Sword (10×10)', de: 'Cyber-Schwert (10×10)' }, SWORD_10),
  createPuzzleFromSolution('tree-10', { en: 'Pine Tree (10×10)', de: 'Tanne (10×10)' }, TREE_10),
  createPuzzleFromSolution('ship-15', { en: 'Starfighter (15×15)', de: 'Sternenjäger (15×15)' }, SPACESHIP_15),
];
