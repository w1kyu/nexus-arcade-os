import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  getHighestTile,
  isGameOver,
  moveBoard,
  slideRow,
  spawnTile,
} from '../../src/apps/2048/logic.js';

describe('2048 — Merge and Movement Logic', () => {
  it('slides and merges a row correctly (each tile merges at most once)', () => {
    // Basic slide
    expect(slideRow([2, 0, 0, 2]).row).toEqual([4, 0, 0, 0]);

    // Multiple merges in one row
    expect(slideRow([2, 2, 2, 2]).row).toEqual([4, 4, 0, 0]);

    // Three of the same number: first two merge, third stays
    expect(slideRow([2, 2, 2, 0]).row).toEqual([4, 2, 0, 0]);

    // Already merged tile cannot merge again in the same move
    expect(slideRow([4, 2, 2, 0]).row).toEqual([4, 4, 0, 0]);
    expect(slideRow([2, 2, 4, 8]).row).toEqual([4, 4, 8, 0]);
  });

  it('calculates score gained from merges', () => {
    const res = slideRow([4, 4, 8, 8]);
    expect(res.row).toEqual([8, 16, 0, 0]);
    expect(res.score).toBe(8 + 16);
  });

  it('moves the board in all 4 directions', () => {
    const board = [
      [2, 0, 0, 2],
      [0, 2, 2, 0],
      [4, 4, 0, 0],
      [0, 0, 0, 0],
    ];

    // Move left
    const leftRes = moveBoard(board, 'left');
    expect(leftRes.board[0]).toEqual([4, 0, 0, 0]);
    expect(leftRes.board[1]).toEqual([4, 0, 0, 0]);
    expect(leftRes.board[2]).toEqual([8, 0, 0, 0]);
    expect(leftRes.changed).toBe(true);

    // Move right
    const rightRes = moveBoard(board, 'right');
    expect(rightRes.board[0]).toEqual([0, 0, 0, 4]);
    expect(rightRes.board[1]).toEqual([0, 0, 0, 4]);
    expect(rightRes.board[2]).toEqual([0, 0, 0, 8]);

    // Move up
    const upRes = moveBoard(board, 'up');
    expect(upRes.board[0][0]).toBe(2);
    expect(upRes.board[1][0]).toBe(4);

    // Move down
    const downRes = moveBoard(board, 'down');
    expect(downRes.board[3][0]).toBe(4);
  });

  it('spawns tiles (2 or 4) only in empty cells', () => {
    const board = createEmptyBoard(4);
    const spawned = spawnTile(board);
    expect(spawned).not.toBeNull();
    expect([2, 4]).toContain(spawned.value);
    expect(board[spawned.r][spawned.c]).toBe(spawned.value);
  });

  it('detects game over state when no moves are possible', () => {
    const fullBoardNoMoves = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(isGameOver(fullBoardNoMoves)).toBe(true);

    const fullBoardWithMove = [
      [2, 4, 2, 4],
      [4, 4, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(isGameOver(fullBoardWithMove)).toBe(false);
  });

  it('computes the highest tile correctly', () => {
    const board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [0, 0, 0, 0],
    ];
    expect(getHighestTile(board)).toBe(4096);
  });
});
