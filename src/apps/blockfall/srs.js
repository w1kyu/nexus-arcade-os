// @ts-check
// Super Rotation System (SRS) piece definitions and kick tables for Blockfall

export const TETROMINO_NAMES = /** @type {const} */ (['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
/** @typedef {typeof TETROMINO_NAMES[number]} TetrominoType */

export const TETROMINO_COLORS = {
  I: '#00f0ff',
  J: '#0055ff',
  L: '#ff8800',
  O: '#ffdd00',
  S: '#00e676',
  T: '#b026ff',
  Z: '#ff3366',
};

/**
 * Matrices for each piece in 4 rotation states (0 = spawn, 1 = R, 2 = 2, 3 = L)
 * In grid coordinates: row 0 is top, col 0 is left.
 * @type {Record<TetrominoType, number[][][]>}
 */
export const SHAPES = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  ],
  O: [
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
  ],
  S: [
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  T: [
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  ],
};

/**
 * SRS Wall Kick Offsets
 * Note: standard SRS coordinates assume +y is UP.
 * In 2D grid matrix coordinates, +y is DOWN.
 * Therefore, matrix offset dy = -srs_y.
 * The offsets below are already converted to [dx, dy] where:
 * dx > 0 moves right, dx < 0 moves left.
 * dy > 0 moves down, dy < 0 moves up.
 */

/** @type {Record<string, [number, number][]>} */
export const JLSTZ_KICK_DATA = {
  '0->1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '1->0': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '1->2': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '2->1': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '2->3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '3->2': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '3->0': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '0->3': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
};

/** @type {Record<string, [number, number][]>} */
export const I_KICK_DATA = {
  '0->1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '1->0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '1->2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  '2->1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '2->3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  '3->2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  '3->0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  '0->3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
};

/**
 * Gets wall kick test offsets for rotating from fromRot to toRot
 * @param {TetrominoType} type
 * @param {number} fromRot (0..3)
 * @param {number} toRot (0..3)
 * @returns {[number, number][]}
 */
export function getWallKicks(type, fromRot, toRot) {
  if (type === 'O') {
    return [[0, 0]];
  }
  const key = `${fromRot}->${toRot}`;
  if (type === 'I') {
    return I_KICK_DATA[key] || [[0, 0]];
  }
  return JLSTZ_KICK_DATA[key] || [[0, 0]];
}

/**
 * Generates a standard randomized 7-bag
 * @param {() => number} [randomFn] PRNG returning 0..1
 * @returns {TetrominoType[]}
 */
export function createSevenBag(randomFn = Math.random) {
  const bag = [...TETROMINO_NAMES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const temp = bag[i];
    bag[i] = bag[j];
    bag[j] = temp;
  }
  return bag;
}
