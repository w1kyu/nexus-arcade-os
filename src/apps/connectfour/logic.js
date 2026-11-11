// @ts-check
// Connect Four rules and AI (negamax with alpha-beta pruning). Pure: no DOM.

export const COLS = 7;
export const ROWS = 6;

/** Search depth and share of deliberately random moves per difficulty. */
export const DIFFICULTIES = {
  easy: { depth: 2, random: 0.3 },
  medium: { depth: 4, random: 0.05 },
  hard: { depth: 8, random: 0 },
};

/** Board cells: 0 empty, 1 or 2; index = row * COLS + col, row 0 is the top. */
export const createBoard = () => new Int8Array(COLS * ROWS);

/**
 * Row a disc dropped into `col` lands on, or -1 when the column is full.
 * @param {Int8Array} board
 * @param {number} col
 */
export function landingRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === 0) return r;
  return -1;
}

/**
 * @param {Int8Array} board
 * @param {number} col
 * @param {number} player
 * @returns {number} the row, or -1 if the column is full
 */
export function drop(board, col, player) {
  const row = landingRow(board, col);
  if (row >= 0) board[row * COLS + col] = player;
  return row;
}

/** @param {Int8Array} board */
export const validMoves = (board) => MOVE_ORDER.filter((c) => board[c] === 0);

/** @param {Int8Array} board */
export const isFull = (board) => validMoves(board).length === 0;

/** Center columns first: better play and better pruning. */
const MOVE_ORDER = [3, 2, 4, 1, 5, 0, 6];

/** Every line of four cells on the board. */
const LINES = (() => {
  /** @type {number[][]} */
  const lines = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        const er = r + 3 * dr;
        const ec = c + 3 * dc;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        lines.push([0, 1, 2, 3].map((i) => (r + i * dr) * COLS + c + i * dc));
      }
  return lines;
})();

/**
 * @param {Int8Array} board
 * @returns {{ player: number, cells: number[] } | null}
 */
export function findWin(board) {
  for (const line of LINES) {
    const p = board[line[0]];
    if (p && board[line[1]] === p && board[line[2]] === p && board[line[3]] === p) return { player: p, cells: line };
  }
  return null;
}

/**
 * Static evaluation from `player`'s view: open twos and threes, center control.
 * @param {Int8Array} board
 * @param {number} player
 */
export function evaluate(board, player) {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = board[r * COLS + 3];
    if (v === player) score += 3;
    else if (v) score -= 3;
  }
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const i of line) {
      if (board[i] === player) mine++;
      else if (board[i]) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) score += 50;
    else if (mine === 2) score += 6;
    else if (theirs === 3) score -= 50;
    else if (theirs === 2) score -= 6;
  }
  return score;
}

const WIN = 100000;

/**
 * @param {Int8Array} board
 * @param {number} player Player to move
 * @param {number} depth
 * @param {number} alpha
 * @param {number} beta
 * @returns {number}
 */
function negamax(board, player, depth, alpha, beta) {
  const win = findWin(board);
  if (win) return win.player === player ? WIN + depth : -WIN - depth;
  const moves = validMoves(board);
  if (moves.length === 0) return 0;
  if (depth === 0) return evaluate(board, player);
  let best = -Infinity;
  for (const col of moves) {
    const row = drop(board, col, player);
    const score = -negamax(board, 3 - player, depth - 1, -beta, -alpha);
    board[row * COLS + col] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * The AI's column. Ties are broken with `random` so games differ.
 * @param {Int8Array} board
 * @param {number} player
 * @param {keyof typeof DIFFICULTIES} difficulty
 * @param {() => number} [random]
 * @returns {number} column, or -1 when the board is full
 */
export function chooseMove(board, player, difficulty, random = Math.random) {
  const moves = validMoves(board);
  if (moves.length === 0) return -1;
  const { depth, random: noise } = DIFFICULTIES[difficulty];
  // Even the easy AI takes a win and blocks an immediate loss.
  for (const who of [player, 3 - player])
    for (const col of moves) {
      const row = drop(board, col, who);
      const won = findWin(board);
      board[row * COLS + col] = 0;
      if (won) return col;
    }
  if (random() < noise) return moves[Math.floor(random() * moves.length)];
  let best = -Infinity;
  /** @type {number[]} */
  let bestCols = [];
  for (const col of moves) {
    const row = drop(board, col, player);
    const score = -negamax(board, 3 - player, depth - 1, -Infinity, Infinity);
    board[row * COLS + col] = 0;
    if (score > best) {
      best = score;
      bestCols = [col];
    } else if (score === best) bestCols.push(col);
  }
  return bestCols[Math.floor(random() * bestCols.length)];
}
