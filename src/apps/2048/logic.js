// @ts-check
// 2048 Board representation, merge rules, and move simulation

/**
 * Slides and merges a single 1D row to the left.
 * Rules:
 * 1. Filter out zeros.
 * 2. Scan left-to-right; if two adjacent numbers match, merge them into one tile of value * 2.
 * 3. Each tile can merge at most once per move!
 * 4. Fill remainder with zeros.
 * @param {number[]} row
 * @returns {{ row: number[], score: number, merged: number[] }}
 */
export function slideRow(row) {
  const nonZeros = row.filter((v) => v !== 0);
  const result = [];
  const merged = [];
  let score = 0;

  let i = 0;
  while (i < nonZeros.length) {
    if (i + 1 < nonZeros.length && nonZeros[i] === nonZeros[i + 1]) {
      const mergedVal = nonZeros[i] * 2;
      result.push(mergedVal);
      merged.push(result.length - 1);
      score += mergedVal;
      i += 2; // Skip both merged tiles so result tile cannot merge again
    } else {
      result.push(nonZeros[i]);
      i += 1;
    }
  }

  while (result.length < row.length) {
    result.push(0);
  }

  return { row: result, score, merged };
}

/**
 * Creates empty NxN board
 * @param {number} size
 * @returns {number[][]}
 */
export function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

/**
 * @param {number[][]} board
 * @returns {number[][]}
 */
export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

/**
 * Moves the board in one of 4 directions.
 * @param {number[][]} board
 * @param {'left' | 'right' | 'up' | 'down'} direction
 * @returns {{ board: number[][], scoreGained: number, changed: boolean }}
 */
export function moveBoard(board, direction) {
  const size = board.length;
  let newBoard = cloneBoard(board);
  let scoreGained = 0;
  let changed = false;

  if (direction === 'left') {
    for (let r = 0; r < size; r++) {
      const res = slideRow(newBoard[r]);
      scoreGained += res.score;
      if (res.row.some((v, idx) => v !== newBoard[r][idx])) {
        changed = true;
      }
      newBoard[r] = res.row;
    }
  } else if (direction === 'right') {
    for (let r = 0; r < size; r++) {
      const reversed = [...newBoard[r]].reverse();
      const res = slideRow(reversed);
      scoreGained += res.score;
      const unreversed = res.row.reverse();
      if (unreversed.some((v, idx) => v !== newBoard[r][idx])) {
        changed = true;
      }
      newBoard[r] = unreversed;
    }
  } else if (direction === 'up') {
    for (let c = 0; c < size; c++) {
      const col = [];
      for (let r = 0; r < size; r++) col.push(newBoard[r][c]);
      const res = slideRow(col);
      scoreGained += res.score;
      for (let r = 0; r < size; r++) {
        if (newBoard[r][c] !== res.row[r]) changed = true;
        newBoard[r][c] = res.row[r];
      }
    }
  } else if (direction === 'down') {
    for (let c = 0; c < size; c++) {
      const col = [];
      for (let r = size - 1; r >= 0; r--) col.push(newBoard[r][c]);
      const res = slideRow(col);
      scoreGained += res.score;
      for (let r = 0; r < size; r++) {
        const val = res.row[size - 1 - r];
        if (newBoard[r][c] !== val) changed = true;
        newBoard[r][c] = val;
      }
    }
  }

  return { board: newBoard, scoreGained, changed };
}

/**
 * Spawns a new tile (90% chance of 2, 10% chance of 4) in an empty cell.
 * @param {number[][]} board
 * @param {import('../../games/engine/prng.js').SeededRng} [rng]
 * @returns {{ r: number, c: number, value: number } | null}
 */
export function spawnTile(board, rng) {
  const size = board.length;
  const emptyCells = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) emptyCells.push({ r, c });
    }
  }

  if (emptyCells.length === 0) return null;

  const randIdx = rng ? rng.int(0, emptyCells.length - 1) : Math.floor(Math.random() * emptyCells.length);
  const cell = emptyCells[randIdx];
  const value = rng ? (rng.next() < 0.9 ? 2 : 4) : Math.random() < 0.9 ? 2 : 4;
  board[cell.r][cell.c] = value;

  return { r: cell.r, c: cell.c, value };
}

/**
 * Checks if any valid moves remain on the board.
 * @param {number[][]} board
 * @returns {boolean}
 */
export function isGameOver(board) {
  const size = board.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) return false;
      if (c + 1 < size && board[r][c] === board[r][c + 1]) return false;
      if (r + 1 < size && board[r][c] === board[r + 1][c]) return false;
    }
  }

  return true;
}

/**
 * Returns the highest value tile on the board
 * @param {number[][]} board
 * @returns {number}
 */
export function getHighestTile(board) {
  let max = 0;
  for (const row of board) {
    for (const v of row) {
      if (v > max) max = v;
    }
  }
  return max;
}
