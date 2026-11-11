// @ts-check
// Checkers / draughts rules and AI. Pure: no DOM.
//
// Pieces: 1 man / 2 king of player 1 (starts at the bottom, moves up), -1 / -2 of player 2.
// Squares are indexed row * size + col, row 0 at the top; only dark squares ((row + col) odd) are used.

/**
 * @typedef {object} Rules
 * @property {number} size Board width and height
 * @property {number} rows Rows of men per side
 * @property {boolean} backwardCapture Men may capture backwards
 * @property {boolean} flyingKings Kings move and capture along whole diagonals
 * @property {boolean} majority A move must capture as many pieces as possible
 */

/** @type {Record<'standard' | 'international', Rules>} */
export const VARIANTS = {
  standard: { size: 8, rows: 3, backwardCapture: false, flyingKings: false, majority: false },
  international: { size: 10, rows: 4, backwardCapture: true, flyingKings: true, majority: true },
};

/** Plies without a capture or a man move after which the game is drawn. */
export const QUIET_LIMIT = 80;

/**
 * @typedef {object} State
 * @property {Rules} rules
 * @property {Int8Array} board
 * @property {1 | -1} turn
 * @property {number} quiet Plies since the last capture or man move
 */

/**
 * @typedef {object} Move
 * @property {number} from
 * @property {number[]} path Squares the piece lands on, in order (one entry for a simple move)
 * @property {number[]} captures Squares of the captured pieces
 */

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/**
 * @param {keyof typeof VARIANTS} [variant]
 * @returns {State}
 */
export function createState(variant = 'standard') {
  const rules = VARIANTS[variant];
  const { size, rows } = rules;
  const board = new Int8Array(size * size);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < rows) board[r * size + c] = -1;
      else if (r >= size - rows) board[r * size + c] = 1;
    }
  return { rules, board, turn: 1, quiet: 0 };
}

/**
 * Builds a position from rows of text (top row first): `.` empty, `m`/`k` player 1, `M`/`K` player 2.
 * @param {string[]} rowsText
 * @param {1 | -1} turn
 * @param {keyof typeof VARIANTS} [variant]
 * @returns {State}
 */
export function stateFromText(rowsText, turn, variant = 'standard') {
  const rules = VARIANTS[variant];
  const board = new Int8Array(rules.size * rules.size);
  const map = { m: 1, k: 2, M: -1, K: -2 };
  rowsText.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      board[r * rules.size + c] = map[/** @type {keyof typeof map} */ (ch)] ?? 0;
    });
  });
  return { rules, board, turn, quiet: 0 };
}

/**
 * Capture sequences of the piece on `from`, each complete (no further jump possible).
 * Captured pieces stay on the board until the move ends: they cannot be jumped twice and block the way.
 * @param {State} state
 * @param {number} from
 * @returns {Move[]}
 */
function capturesFrom(state, from) {
  const { rules, board } = state;
  const { size } = rules;
  const piece = board[from];
  const side = Math.sign(piece);
  const king = Math.abs(piece) === 2;
  const flying = king && rules.flyingKings;
  /** @type {Move[]} */
  const moves = [];
  /** @type {number[]} */
  const path = [];
  /** @type {number[]} */
  const taken = [];
  const empty = (/** @type {number} */ sq) => board[sq] === 0 || sq === from;

  /** @param {number} sq */
  const walk = (sq) => {
    let extended = false;
    const r0 = Math.floor(sq / size);
    const c0 = sq % size;
    for (const [dr, dc] of DIRS) {
      if (!king && !rules.backwardCapture && dr !== -side) continue;
      let r = r0 + dr;
      let c = c0 + dc;
      if (flying) while (r >= 0 && r < size && c >= 0 && c < size && empty(r * size + c)) ((r += dr), (c += dc));
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const victim = r * size + c;
      if (Math.sign(board[victim]) !== -side || taken.includes(victim)) continue;
      r += dr;
      c += dc;
      while (r >= 0 && r < size && c >= 0 && c < size && empty(r * size + c)) {
        const land = r * size + c;
        extended = true;
        path.push(land);
        taken.push(victim);
        // English rule: a man reaching the king row is crowned and its move ends.
        const crowned = !king && !rules.flyingKings && r === (side === 1 ? 0 : size - 1);
        if (crowned) moves.push({ from, path: [...path], captures: [...taken] });
        else walk(land);
        path.pop();
        taken.pop();
        if (!flying) break;
        r += dr;
        c += dc;
      }
    }
    if (!extended && path.length) moves.push({ from, path: [...path], captures: [...taken] });
  };
  walk(from);
  return moves;
}

/**
 * @param {State} state
 * @param {number} from
 * @returns {Move[]}
 */
function stepsFrom(state, from) {
  const { rules, board } = state;
  const { size } = rules;
  const piece = board[from];
  const side = Math.sign(piece);
  const king = Math.abs(piece) === 2;
  /** @type {Move[]} */
  const moves = [];
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  for (const [dr, dc] of DIRS) {
    if (!king && dr !== -side) continue;
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === 0) {
      moves.push({ from, path: [r * size + c], captures: [] });
      if (!(king && rules.flyingKings)) break;
      r += dr;
      c += dc;
    }
  }
  return moves;
}

/**
 * All legal moves of the side to move. Captures are mandatory; with the majority rule only the
 * sequences taking the most pieces are legal.
 * @param {State} state
 * @returns {Move[]}
 */
export function legalMoves(state) {
  const { board, turn, rules } = state;
  /** @type {Move[]} */
  let captures = [];
  for (let sq = 0; sq < board.length; sq++)
    if (Math.sign(board[sq]) === turn) captures.push(...capturesFrom(state, sq));
  if (captures.length) {
    if (rules.majority) {
      const most = Math.max(...captures.map((m) => m.captures.length));
      captures = captures.filter((m) => m.captures.length === most);
    }
    return captures;
  }
  /** @type {Move[]} */
  const steps = [];
  for (let sq = 0; sq < board.length; sq++) if (Math.sign(board[sq]) === turn) steps.push(...stepsFrom(state, sq));
  return steps;
}

/**
 * @param {State} state
 * @param {Move} move
 * @returns {State}
 */
export function applyMove(state, move) {
  const { rules, turn } = state;
  const board = state.board.slice();
  const to = /** @type {number} */ (move.path.at(-1));
  let piece = board[move.from];
  const wasMan = Math.abs(piece) === 1;
  board[move.from] = 0;
  for (const sq of move.captures) board[sq] = 0;
  const row = Math.floor(to / rules.size);
  if (wasMan && row === (turn === 1 ? 0 : rules.size - 1)) piece = /** @type {any} */ (2 * turn);
  board[to] = piece;
  return {
    rules,
    board,
    turn: /** @type {1 | -1} */ (-turn),
    quiet: move.captures.length || wasMan ? 0 : state.quiet + 1,
  };
}

/**
 * @param {State} state
 * @returns {{ over: boolean, winner: 1 | -1 | 0 }} winner 0 = draw (or still running)
 */
export function outcome(state) {
  if (legalMoves(state).length === 0) return { over: true, winner: /** @type {1 | -1} */ (-state.turn) };
  if (state.quiet >= QUIET_LIMIT) return { over: true, winner: 0 };
  return { over: false, winner: 0 };
}

/** @param {State} state @param {number} depth @returns {number} */
export function perft(state, depth) {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of legalMoves(state)) nodes += perft(applyMove(state, move), depth - 1);
  return nodes;
}

/** @param {State} state */
export function countPieces(state) {
  const count = { 1: { men: 0, kings: 0 }, [-1]: { men: 0, kings: 0 } };
  for (const p of state.board) {
    if (!p) continue;
    const side = count[/** @type {1 | -1} */ (Math.sign(p))];
    if (Math.abs(p) === 2) side.kings++;
    else side.men++;
  }
  return count;
}

/**
 * Material and advancement from the view of the side to move.
 * @param {State} state
 */
export function evaluate(state) {
  const { board, rules, turn } = state;
  const { size } = rules;
  const kingValue = rules.flyingKings ? 320 : 180;
  let score = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (!p) continue;
    const side = Math.sign(p);
    const r = Math.floor(sq / size);
    const c = sq % size;
    let v;
    if (Math.abs(p) === 2) v = kingValue;
    else {
      const advance = side === 1 ? size - 1 - r : r;
      v = 100 + advance * 4;
      // Men on the back row guard against enemy kings.
      if (advance === 0) v += 8;
    }
    if (c > 0 && c < size - 1) v += 3;
    score += side * v;
  }
  return score * turn;
}

const WIN = 1e6;

/** Search depth limits and time budgets (ms). */
export const DIFFICULTIES = {
  easy: { depth: 2, ms: 200, random: 0.35 },
  medium: { depth: 4, ms: 400, random: 0 },
  hard: { depth: 10, ms: 900, random: 0 },
};

/**
 * Iterative-deepening alpha-beta. Returns null when the side to move has no move.
 * @param {State} state
 * @param {keyof typeof DIFFICULTIES} difficulty
 * @param {{ random?: () => number, now?: () => number }} [options]
 * @returns {Move | null}
 */
export function chooseMove(state, difficulty, { random = Math.random, now = Date.now } = {}) {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  const { depth: maxDepth, ms, random: noise } = DIFFICULTIES[difficulty];
  if (random() < noise) return moves[Math.floor(random() * moves.length)];
  const deadline = now() + ms;
  let timedOut = false;
  let nodes = 0;

  /**
   * @param {State} s
   * @param {number} depth
   * @param {number} alpha
   * @param {number} beta
   * @param {number} ply
   * @returns {number}
   */
  const search = (s, depth, alpha, beta, ply) => {
    if ((++nodes & 1023) === 0 && now() > deadline) timedOut = true;
    if (timedOut) return 0;
    if (s.quiet >= QUIET_LIMIT) return 0;
    const list = legalMoves(s);
    if (list.length === 0) return -WIN + ply;
    // Never stop in the middle of an exchange.
    if (depth <= 0 && list[0].captures.length === 0) return evaluate(s);
    let best = -Infinity;
    for (const m of list) {
      const score = -search(applyMove(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  };

  let ordered = moves.map((move) => ({ move, score: 0 }));
  let best = ordered[0].move;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity;
    /** @type {{ move: Move, score: number }[]} */
    const scored = [];
    for (const { move } of ordered) {
      const score = -search(applyMove(state, move), depth - 1, -Infinity, -alpha + 1, 1);
      if (timedOut) break;
      scored.push({ move, score });
      if (score > alpha) alpha = score;
    }
    if (timedOut) break;
    scored.sort((a, b) => b.score - a.score);
    ordered = scored;
    const top = scored.filter((s) => s.score === scored[0].score);
    best = top[Math.floor(random() * top.length)].move;
    if (Math.abs(scored[0].score) > WIN / 2) break;
  }
  return best;
}
