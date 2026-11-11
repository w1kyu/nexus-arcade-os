import { describe, expect, it } from 'vitest';
import {
  COLS,
  ROWS,
  chooseMove,
  createBoard,
  drop,
  findWin,
  isFull,
  landingRow,
  validMoves,
} from '../../src/apps/connectfour/logic.js';

describe('Connect Four Logic & AI', () => {
  it('creates an empty board of correct dimensions', () => {
    const b = createBoard();
    expect(b.length).toBe(COLS * ROWS);
    expect(isFull(b)).toBe(false);
    expect(validMoves(b).length).toBe(COLS);
  });

  it('correctly calculates landing row when dropping discs', () => {
    const b = createBoard();
    expect(landingRow(b, 3)).toBe(ROWS - 1);
    const r1 = drop(b, 3, 1);
    expect(r1).toBe(ROWS - 1);
    expect(landingRow(b, 3)).toBe(ROWS - 2);
    const r2 = drop(b, 3, 2);
    expect(r2).toBe(ROWS - 2);
  });

  it('detects horizontal, vertical, and diagonal wins', () => {
    // Horizontal win for player 1
    const bH = createBoard();
    drop(bH, 0, 1);
    drop(bH, 1, 1);
    drop(bH, 2, 1);
    drop(bH, 3, 1);
    const winH = findWin(bH);
    expect(winH).not.toBeNull();
    expect(winH?.player).toBe(1);

    // Vertical win for player 2
    const bV = createBoard();
    drop(bV, 4, 2);
    drop(bV, 4, 2);
    drop(bV, 4, 2);
    drop(bV, 4, 2);
    const winV = findWin(bV);
    expect(winV).not.toBeNull();
    expect(winV?.player).toBe(2);

    // Diagonal win
    const bD = createBoard();
    // col 0: 1
    drop(bD, 0, 1);
    // col 1: 2, 1
    drop(bD, 1, 2);
    drop(bD, 1, 1);
    // col 2: 2, 2, 1
    drop(bD, 2, 2);
    drop(bD, 2, 2);
    drop(bD, 2, 1);
    // col 3: 2, 2, 2, 1
    drop(bD, 3, 2);
    drop(bD, 3, 2);
    drop(bD, 3, 2);
    drop(bD, 3, 1);
    const winD = findWin(bD);
    expect(winD).not.toBeNull();
    expect(winD?.player).toBe(1);
  });

  it('AI blocks immediate opponent winning move on hard', () => {
    const b = createBoard();
    // Human (player 1) has 3 in a row in cols 1, 2, 3 on bottom row
    drop(b, 1, 1);
    drop(b, 2, 1);
    drop(b, 3, 1);
    // AI (player 2) should block col 0 or col 4
    const aiMove = chooseMove(b, 2, 'hard', () => 0.5);
    expect([0, 4]).toContain(aiMove);
  });
});
