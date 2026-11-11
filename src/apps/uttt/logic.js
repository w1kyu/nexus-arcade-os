// @ts-check

/**
 * Ultimate Tic-Tac-Toe (9x9 nested grid) Logic & AI
 */

export const EMPTY = 0;
export const PLAYER_X = 1;
export const PLAYER_O = 2;
export const TIE = 3;

/**
 * Creates empty 9x9 board state
 * Representation:
 * - cells: array of 81 numbers (0 = empty, 1 = X, 2 = O)
 * - macro: array of 9 numbers (0 = in progress, 1 = X won, 2 = O won, 3 = tie)
 * - activeBoard: -1 for free choice, or 0..8 for specific active sub-board
 */
export function createUTTTState() {
  return {
    cells: new Array(81).fill(EMPTY),
    macro: new Array(9).fill(EMPTY),
    activeBoard: -1, // -1 means free choice anywhere on valid boards
    turn: PLAYER_X,
    winner: EMPTY, // 0 = playing, 1 = X, 2 = O, 3 = Tie
    moveHistory:
      /** @type {{ board: number, cell: number, player: number, prevActive: number, macroWon: number }[]} */ ([]),
  };
}

/**
 * Sub-board line combinations (indices 0..8 within a sub-board)
 */
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Checks winner of a 3x3 array
 * @param {number[]} arr 9 numbers
 * @returns {number} 0 = none, 1 = X, 2 = O, 3 = Tie
 */
export function check3x3Winner(arr) {
  for (const [a, b, c] of WIN_LINES) {
    if (arr[a] !== EMPTY && arr[a] !== TIE && arr[a] === arr[b] && arr[a] === arr[c]) {
      return arr[a];
    }
  }
  if (arr.every((v) => v !== EMPTY)) return TIE;
  return EMPTY;
}

/**
 * Gets sub-board cells
 * @param {number[]} cells 81 cells
 * @param {number} board 0..8
 */
export function getSubBoard(cells, board) {
  const start = board * 9;
  return cells.slice(start, start + 9);
}

/**
 * Gets all legal moves for current state
 * @param {ReturnType<typeof createUTTTState>} state
 * @returns {{ board: number, cell: number }[]}
 */
export function getLegalMoves(state) {
  if (state.winner !== EMPTY) return [];

  const moves = [];
  const validBoards = [];

  if (state.activeBoard >= 0 && state.macro[state.activeBoard] === EMPTY) {
    validBoards.push(state.activeBoard);
  } else {
    // Free choice: any sub-board that isn't already decided
    for (let b = 0; b < 9; b++) {
      if (state.macro[b] === EMPTY) validBoards.push(b);
    }
  }

  for (const b of validBoards) {
    const base = b * 9;
    for (let c = 0; c < 9; c++) {
      if (state.cells[base + c] === EMPTY) {
        moves.push({ board: b, cell: c });
      }
    }
  }

  return moves;
}

/**
 * Makes a move
 * @param {ReturnType<typeof createUTTTState>} state
 * @param {number} board 0..8
 * @param {number} cell 0..8
 * @returns {boolean} true if valid move made
 */
export function makeMove(state, board, cell) {
  if (state.winner !== EMPTY) return false;

  // Validate board is active/legal
  if (state.activeBoard >= 0 && state.macro[state.activeBoard] === EMPTY && board !== state.activeBoard) {
    return false;
  }
  if (state.macro[board] !== EMPTY) return false;

  const idx = board * 9 + cell;
  if (state.cells[idx] !== EMPTY) return false;

  const player = state.turn;
  state.cells[idx] = player;

  // Check if sub-board was won
  const sub = getSubBoard(state.cells, board);
  const subWinner = check3x3Winner(sub);
  let macroWon = EMPTY;

  if (subWinner !== EMPTY) {
    state.macro[board] = subWinner;
    macroWon = subWinner;

    // Check if macro game was won
    const macroWinner = check3x3Winner(state.macro);
    if (macroWinner !== EMPTY) {
      state.winner = macroWinner;
    }
  }

  // Determine next active board
  const prevActive = state.activeBoard;
  if (state.macro[cell] === EMPTY) {
    state.activeBoard = cell;
  } else {
    // Next sub-board already won/full -> free choice
    state.activeBoard = -1;
  }

  state.moveHistory.push({ board, cell, player, prevActive, macroWon });
  state.turn = player === PLAYER_X ? PLAYER_O : PLAYER_X;
  return true;
}

/**
 * Undo last move
 * @param {ReturnType<typeof createUTTTState>} state
 */
export function undoMove(state) {
  const last = state.moveHistory.pop();
  if (!last) return false;

  state.cells[last.board * 9 + last.cell] = EMPTY;
  if (last.macroWon !== EMPTY) {
    state.macro[last.board] = EMPTY;
  }
  state.activeBoard = last.prevActive;
  state.turn = last.player;
  state.winner = EMPTY;
  return true;
}

/**
 * AI Move Selection (MCTS / Heuristic)
 * @param {ReturnType<typeof createUTTTState>} state
 * @param {'easy' | 'medium' | 'hard'} difficulty
 */
export function chooseAIMove(state, difficulty = 'medium') {
  const legal = getLegalMoves(state);
  if (legal.length === 0) return null;

  if (difficulty === 'easy') {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  // Heuristic / Minimax evaluation for Medium & Hard
  let bestScore = -Infinity;
  let bestMove = legal[0];

  for (const move of legal) {
    // Clone state
    const clone = {
      cells: [...state.cells],
      macro: [...state.macro],
      activeBoard: state.activeBoard,
      turn: state.turn,
      winner: state.winner,
      moveHistory: [],
    };

    makeMove(clone, move.board, move.cell);

    // Immediate win?
    if (clone.winner === state.turn) return move;

    let score = 0;
    // Reward claiming sub-boards
    if (clone.macro[move.board] === state.turn) score += 50;
    // Center sub-board is strategically powerful
    if (move.board === 4) score += 15;
    if (move.cell === 4) score += 10;
    // Penalize sending opponent to free choice
    if (clone.activeBoard === -1) score -= 20;

    if (difficulty === 'hard') {
      // 1-ply rollout simulation
      const opponentMoves = getLegalMoves(clone);
      let oppBest = 0;
      for (const oppMove of opponentMoves) {
        if (clone.macro[oppMove.board] === clone.turn) oppBest += 30;
      }
      score -= oppBest;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
