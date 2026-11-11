import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, MinesweeperBoard } from '../../src/apps/minesweeper/logic.js';

describe('Minesweeper logic & invariants', () => {
  it('guarantees safe first click and opens an area (0 adjacent mines at first click)', () => {
    const board = new MinesweeperBoard(9, 9, 10);
    expect(board.minesPlaced).toBe(false);

    // First click at (4, 4)
    const res = board.reveal(4, 4);
    expect(board.minesPlaced).toBe(true);
    expect(res.status).toBe('safe');
    expect(board.gameOver).toBe(false);

    // Cell (4, 4) must NOT be a mine and must have 0 adjacent mines
    expect(board.grid[4][4].mine).toBe(false);
    expect(board.grid[4][4].adjacentMines).toBe(0);

    // None of the 8 neighbors can be mines
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        expect(board.grid[4 + dr][4 + dc].mine).toBe(false);
      }
    }

    // Opening area must contain more than 1 cell because 0-cell cascades to neighbors
    expect(res.openedCells.length).toBeGreaterThan(1);
  });

  it('correctly places the exact requested mine count across standard difficulties', () => {
    for (const [, cfg] of Object.entries(DIFFICULTIES)) {
      const board = new MinesweeperBoard(cfg.rows, cfg.cols, cfg.mines);
      board.placeMines(0, 0);

      let mineCount = 0;
      for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
          if (board.grid[r][c].mine) mineCount++;
        }
      }
      expect(mineCount).toBe(cfg.mines);
    }
  });

  it('cycles mark state: none -> flag -> question -> none', () => {
    const board = new MinesweeperBoard(9, 9, 10);
    expect(board.grid[1][1].mark).toBe('none');

    expect(board.toggleMark(1, 1)).toBe('flag');
    expect(board.flagsCount).toBe(1);

    expect(board.toggleMark(1, 1)).toBe('question');
    expect(board.flagsCount).toBe(0);

    expect(board.toggleMark(1, 1)).toBe('none');
    expect(board.flagsCount).toBe(0);
  });

  it('performs safe chording when adjacent flags match number', () => {
    const board = new MinesweeperBoard(3, 3, 1);
    // Force grid:
    // [0, 0] = safe (revealed, 1 mine)
    // [0, 1] = mine (flagged)
    // [1, 0] = safe (unrevealed)
    // [1, 1] = safe (unrevealed)
    board.grid[0][1].mine = true;
    board.grid[0][0].adjacentMines = 1;
    board.grid[0][0].revealed = true;
    board.minesPlaced = true;
    board.totalMines = 1;
    board.revealedCount = 1;

    // Flag the mine
    board.toggleMark(0, 1);

    // Chord on (0, 0)
    const res = board.chord(0, 0);
    expect(res.status).not.toBe('mine');
    expect(board.grid[1][0].revealed).toBe(true);
    expect(board.grid[1][1].revealed).toBe(true);
  });

  it('triggers game over when chording with incorrect flag', () => {
    const board = new MinesweeperBoard(3, 3, 1);
    board.grid[0][1].mine = true; // Real mine
    board.grid[0][0].adjacentMines = 1;
    board.grid[0][0].revealed = true;
    board.minesPlaced = true;
    board.totalMines = 1;
    board.revealedCount = 1;

    // Wrongly flag (1, 0) instead of (0, 1)
    board.toggleMark(1, 0);

    // Chord on (0, 0) -> should reveal real mine at (0, 1) and explode
    const res = board.chord(0, 0);
    expect(res.status).toBe('mine');
    expect(board.gameOver).toBe(true);
    expect(board.won).toBe(false);
  });
});
