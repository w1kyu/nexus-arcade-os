// @ts-check
// Sokoban board parsing and BFS solver

/**
 * Standard Sokoban symbols:
 * '#' Wall
 * ' ' Floor
 * '.' Target
 * '$' Box
 * '*' Box on Target
 * '@' Player
 * '+' Player on Target
 */

export const WALL = '#';
export const FLOOR = ' ';
export const TARGET = '.';
export const BOX = '$';
export const BOX_ON_TARGET = '*';
export const PLAYER = '@';
export const PLAYER_ON_TARGET = '+';

/**
 * @typedef {object} SokobanLevel
 * @property {number} id
 * @property {number} width
 * @property {number} height
 * @property {string[]} map Array of rows
 * @property {number} playerStart
 * @property {number[]} boxesStart
 * @property {number[]} targets
 */

/**
 * Parses raw ASCII Sokoban level text.
 * @param {string | string[]} input
 * @param {number} [id=1]
 * @returns {SokobanLevel}
 */
export function parseLevel(input, id = 1) {
  const lines = Array.isArray(input) ? input : input.trim().split(/\r?\n/);
  const height = lines.length;
  const width = Math.max(...lines.map((l) => l.length));

  /** @type {string[]} */
  const map = [];
  let playerStart = -1;
  /** @type {number[]} */
  const boxesStart = [];
  /** @type {number[]} */
  const targets = [];

  for (let r = 0; r < height; r++) {
    const line = lines[r].padEnd(width, ' ');
    let rowChars = '';
    for (let c = 0; c < width; c++) {
      const ch = line[c];
      const idx = r * width + c;
      if (ch === WALL) {
        rowChars += WALL;
      } else if (ch === TARGET) {
        rowChars += TARGET;
        targets.push(idx);
      } else if (ch === BOX) {
        rowChars += FLOOR;
        boxesStart.push(idx);
      } else if (ch === BOX_ON_TARGET) {
        rowChars += TARGET;
        boxesStart.push(idx);
        targets.push(idx);
      } else if (ch === PLAYER) {
        rowChars += FLOOR;
        playerStart = idx;
      } else if (ch === PLAYER_ON_TARGET) {
        rowChars += TARGET;
        playerStart = idx;
        targets.push(idx);
      } else {
        rowChars += FLOOR;
      }
    }
    map.push(rowChars);
  }

  boxesStart.sort((a, b) => a - b);
  targets.sort((a, b) => a - b);

  return {
    id,
    width,
    height,
    map,
    playerStart,
    boxesStart,
    targets,
  };
}

/**
 * Breadth-first search solver to verify solvability.
 * Returns true if a solution exists within the node limit.
 * @param {SokobanLevel} level
 * @param {number} [maxNodes=25000]
 */
export function solveSokoban(level, maxNodes = 25000) {
  const { width, height, map, playerStart, boxesStart, targets } = level;
  const targetSet = new Set(targets);

  const isWall = (/** @type {number} */ idx) => {
    const r = Math.floor(idx / width);
    const c = idx % width;
    if (r < 0 || r >= height || c < 0 || c >= width) return true;
    return map[r][c] === WALL;
  };

  const isWin = (/** @type {number[]} */ boxes) => {
    return boxes.every((b) => targetSet.has(b));
  };

  if (isWin(boxesStart)) return true;

  // Directions: [-width, width, -1, 1] (Up, Down, Left, Right)
  const DIRS = [-width, width, -1, 1];

  const stateKey = (/** @type {number} */ p, /** @type {number[]} */ b) => `${p}:${b.join(',')}`;

  /** @type {{ p: number, b: number[] }[]} */
  const queue = [{ p: playerStart, b: boxesStart }];
  const visited = new Set([stateKey(playerStart, boxesStart)]);

  let nodes = 0;
  while (queue.length > 0 && nodes < maxNodes) {
    nodes++;
    const { p, b } = queue.shift();
    const boxSet = new Set(b);

    for (const d of DIRS) {
      const np = p + d;
      // Cannot walk into walls
      if (isWall(np)) continue;

      if (boxSet.has(np)) {
        // Pushing box to nnp
        const nnp = np + d;
        if (isWall(nnp) || boxSet.has(nnp)) continue;

        const newBoxes = b.map((bx) => (bx === np ? nnp : bx)).sort((x, y) => x - y);
        if (isWin(newBoxes)) return true;

        const key = stateKey(np, newBoxes);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ p: np, b: newBoxes });
        }
      } else {
        // Simple step
        const key = stateKey(np, b);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ p: np, b });
        }
      }
    }
  }

  return false;
}
