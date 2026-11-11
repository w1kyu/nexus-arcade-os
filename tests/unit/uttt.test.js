import { describe, it, expect } from 'vitest';
import {
  createUTTTState,
  getLegalMoves,
  makeMove,
  undoMove,
  chooseAIMove,
  check3x3Winner,
  PLAYER_X,
  PLAYER_O,
  EMPTY,
} from '../../src/apps/uttt/logic.js';

describe('Ultimate Tic-Tac-Toe Logic & Rules', () => {
  it('initializes empty 9x9 board with free choice on first move', () => {
    const state = createUTTTState();
    expect(state.cells.length).toBe(81);
    expect(state.cells.every((c) => c === EMPTY)).toBe(true);
    expect(state.macro.length).toBe(9);
    expect(state.activeBoard).toBe(-1);
    expect(state.turn).toBe(PLAYER_X);
    expect(state.winner).toBe(EMPTY);

    const moves = getLegalMoves(state);
    expect(moves.length).toBe(81);
  });

  it('enforces forced sub-board targeting rule', () => {
    const state = createUTTTState();
    // Play in board 0, cell 4 (center)
    const success = makeMove(state, 0, 4);
    expect(success).toBe(true);
    expect(state.turn).toBe(PLAYER_O);
    // Opponent is now forced to play in sub-board 4!
    expect(state.activeBoard).toBe(4);

    const legal = getLegalMoves(state);
    expect(legal.length).toBe(9);
    expect(legal.every((m) => m.board === 4)).toBe(true);
  });

  it('claims macro sub-board upon 3-in-a-row in that sub-board', () => {
    const state = createUTTTState();
    // Sub-board 0 win for X: (0,0), (0,1), (0,2)
    state.macro[0] = EMPTY;
    makeMove(state, 0, 0); // X plays (0,0) -> activeBoard 0
    makeMove(state, 0, 3); // O plays (0,3) -> activeBoard 3
    makeMove(state, 3, 0); // X plays (3,0) -> activeBoard 0
    makeMove(state, 0, 4); // O plays (0,4) -> activeBoard 4
    makeMove(state, 4, 0); // X plays (4,0) -> activeBoard 0
    makeMove(state, 0, 5); // O plays (0,5) -> activeBoard 5
    makeMove(state, 5, 0); // X plays (5,0) -> activeBoard 0
    makeMove(state, 0, 6); // O plays (0,6) -> activeBoard 6
    makeMove(state, 6, 0); // X plays (6,0) -> activeBoard 0
    makeMove(state, 0, 7); // O plays (0,7) -> activeBoard 7
    makeMove(state, 7, 0); // X plays (7,0) -> activeBoard 0
    makeMove(state, 0, 8); // O plays (0,8) -> activeBoard 8
    makeMove(state, 8, 1); // X plays (8,1) -> activeBoard 1
    makeMove(state, 1, 0); // O plays (1,0) -> activeBoard 0

    // Check 3x3 line evaluation
    const sub0 = [PLAYER_X, PLAYER_X, PLAYER_X, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
    expect(check3x3Winner(sub0)).toBe(PLAYER_X);
  });

  it('gives free choice if target sub-board is already decided', () => {
    const state = createUTTTState();
    // Simulate sub-board 4 already won by X
    state.macro[4] = PLAYER_X;
    state.activeBoard = 0;

    // X plays into cell 4 of sub-board 0
    makeMove(state, 0, 4);

    // Because sub-board 4 is already won, activeBoard becomes -1 (free choice)
    expect(state.activeBoard).toBe(-1);
    const legal = getLegalMoves(state);
    // Should be able to play on any board except board 4
    expect(legal.every((m) => m.board !== 4)).toBe(true);
    expect(legal.length).toBe(71); // 7 full boards (63) + 8 open cells on board 0
  });

  it('undoes moves cleanly', () => {
    const state = createUTTTState();
    makeMove(state, 0, 4);
    expect(state.cells[4]).toBe(PLAYER_X);
    expect(state.activeBoard).toBe(4);

    undoMove(state);
    expect(state.cells[4]).toBe(EMPTY);
    expect(state.activeBoard).toBe(-1);
    expect(state.turn).toBe(PLAYER_X);
  });

  it('AI chooses valid legal moves across difficulties', () => {
    const state = createUTTTState();
    const moveEasy = chooseAIMove(state, 'easy');
    expect(moveEasy).not.toBeNull();
    expect(moveEasy.board).toBeGreaterThanOrEqual(0);
    expect(moveEasy.cell).toBeGreaterThanOrEqual(0);

    const moveHard = chooseAIMove(state, 'hard');
    expect(moveHard).not.toBeNull();
    expect(moveHard.board).toBeGreaterThanOrEqual(0);
    expect(moveHard.cell).toBeGreaterThanOrEqual(0);
  });
});
