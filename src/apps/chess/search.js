// @ts-check
// Chess AI: iterative-deepening alpha-beta with quiescence search, MVV-LVA / killer / history move
// ordering, and a material + piece-square-table evaluation. Pure: runs in the worker and in tests.

import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from './engine.js';

export const MATE = 100000;
const VALUE = [0, 100, 320, 330, 500, 900, 0];

// Piece-square tables from White's view, a8 first (the usual "simplified evaluation" shapes).
// prettier-ignore
const PST = {
  [PAWN]: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  [KNIGHT]: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  [BISHOP]: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  [ROOK]: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  [QUEEN]: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  [KING]: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};
// prettier-ignore
const KING_ENDGAME = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

/** Strength levels: depth limit, time budget, and the share of deliberately random moves. */
export const LEVELS = {
  1: { depth: 1, ms: 300, noise: 0.5 },
  2: { depth: 2, ms: 500, noise: 0.15 },
  3: { depth: 3, ms: 1000, noise: 0 },
  4: { depth: 4, ms: 2000, noise: 0 },
  5: { depth: 8, ms: 3000, noise: 0 },
};

/**
 * Static evaluation in centipawns from the view of the side to move.
 * @param {import('./engine.js').Position} pos
 */
export function evaluate(pos) {
  const board = pos.board;
  let score = 0;
  let heavy = 0;
  for (let sq = 0; sq < 120; sq++) {
    if (sq & 0x88) continue;
    const type = board[sq] & 7;
    if (type === QUEEN) heavy += 2;
    else if (type === ROOK) heavy += 1;
  }
  const endgame = heavy <= 2;
  for (let sq = 0; sq < 120; sq++) {
    if (sq & 0x88) continue;
    const piece = board[sq];
    if (!piece) continue;
    const type = piece & 7;
    const white = piece >> 3 === WHITE;
    const rank = sq >> 4;
    const index = (white ? 7 - rank : rank) * 8 + (sq & 7);
    const table = type === KING && endgame ? KING_ENDGAME : PST[type];
    const value = VALUE[type] + table[index];
    score += white ? value : -value;
  }
  return pos.turn === WHITE ? score : -score;
}

/**
 * @param {import('./engine.js').Position} pos The position is searched in place and restored.
 * @param {object} [options]
 * @param {number} [options.depth] Maximum depth
 * @param {number} [options.ms] Time budget
 * @param {number} [options.noise] Probability of a random legal move instead
 * @param {() => number} [options.random]
 * @param {() => number} [options.now]
 * @returns {{ move: import('./engine.js').Move | null, score: number, depth: number, nodes: number }}
 */
export function search(pos, { depth: maxDepth = 4, ms = 1000, noise = 0, random = Math.random, now = Date.now } = {}) {
  const rootMoves = pos.legalMoves();
  if (rootMoves.length === 0) return { move: null, score: pos.inCheck() ? -MATE : 0, depth: 0, nodes: 0 };
  if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0, nodes: 0 };
  if (random() < noise)
    return { move: rootMoves[Math.floor(random() * rootMoves.length)], score: 0, depth: 0, nodes: 0 };

  const deadline = now() + ms;
  let nodes = 0;
  let stop = false;
  /** @type {(import('./engine.js').Move | null)[][]} */
  const killers = [];
  const history = new Int32Array(16 * 128);

  /** @param {import('./engine.js').Move} m @param {number} ply */
  const orderScore = (m, ply) => {
    if (m.captured) return 100000 + VALUE[m.captured & 7] * 10 - VALUE[m.piece & 7];
    if (m.promo) return 90000 + VALUE[m.promo];
    const k = killers[ply];
    if (k && ((k[0] && k[0].from === m.from && k[0].to === m.to) || (k[1] && k[1].from === m.from && k[1].to === m.to)))
      return 80000;
    return history[m.piece * 128 + m.to];
  };

  /** @param {number} alpha @param {number} beta @returns {number} */
  const quiesce = (alpha, beta) => {
    nodes++;
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const us = pos.turn;
    const moves = pos.pseudoMoves(true);
    moves.sort((a, b) => orderScore(b, 0) - orderScore(a, 0));
    for (const m of moves) {
      pos.make(m);
      if (pos.isAttacked(pos.kings[us], us ^ 1)) {
        pos.unmake();
        continue;
      }
      const score = -quiesce(-beta, -alpha);
      pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  /**
   * @param {number} depth
   * @param {number} alpha
   * @param {number} beta
   * @param {number} ply
   * @returns {number}
   */
  const negamax = (depth, alpha, beta, ply) => {
    if ((++nodes & 2047) === 0 && now() > deadline) stop = true;
    if (stop) return 0;
    if (pos.halfmove >= 100 || pos.insufficientMaterial()) return 0;
    const us = pos.turn;
    const inCheck = pos.inCheck();
    if (inCheck && ply < 24) depth++;
    if (depth <= 0) return quiesce(alpha, beta);
    const moves = pos.pseudoMoves();
    moves.sort((a, b) => orderScore(b, ply) - orderScore(a, ply));
    let legal = 0;
    let best = -Infinity;
    for (const m of moves) {
      pos.make(m);
      if (pos.isAttacked(pos.kings[us], us ^ 1)) {
        pos.unmake();
        continue;
      }
      legal++;
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      pos.unmake();
      if (stop) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!m.captured) {
          const k = (killers[ply] ??= [null, null]);
          k[1] = k[0];
          k[0] = m;
          history[m.piece * 128 + m.to] += depth * depth;
        }
        break;
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;
    return best;
  };

  let ordered = rootMoves.map((move) => ({ move, score: orderScore(move, 0) }));
  ordered.sort((a, b) => b.score - a.score);
  let best = ordered[0].move;
  let bestScore = 0;
  let reached = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity;
    /** @type {{ move: import('./engine.js').Move, score: number }[]} */
    const scored = [];
    for (const { move } of ordered) {
      pos.make(move);
      const score = -negamax(depth - 1, -Infinity, -alpha, 1);
      pos.unmake();
      if (stop) break;
      scored.push({ move, score });
      if (score > alpha) alpha = score;
    }
    // A partly searched depth still counts: the previous best move is searched first.
    if (scored.length) {
      scored.sort((a, b) => b.score - a.score);
      best = scored[0].move;
      bestScore = scored[0].score;
    }
    if (stop) break;
    reached = depth;
    ordered = scored;
    if (Math.abs(bestScore) > MATE - 100) break;
  }
  return { move: best, score: bestScore, depth: reached, nodes };
}

/**
 * True when the side to move can force checkmate within `n` of its own moves.
 * @param {import('./engine.js').Position} pos
 * @param {number} n
 */
export function hasForcedMate(pos, n) {
  return matingMoves(pos, n).length > 0;
}

/**
 * Moves of the side to move that force checkmate within `n` own moves.
 * @param {import('./engine.js').Position} pos
 * @param {number} n
 * @returns {import('./engine.js').Move[]}
 */
export function matingMoves(pos, n) {
  return pos.legalMoves().filter((move) => {
    pos.make(move);
    const replies = pos.legalMoves();
    let forced;
    if (replies.length === 0) forced = pos.inCheck();
    else if (n <= 1) forced = false;
    else
      forced = replies.every((reply) => {
        pos.make(reply);
        const mate = hasForcedMate(pos, n - 1);
        pos.unmake();
        return mate;
      });
    pos.unmake();
    return forced;
  });
}
