import { describe, expect, it } from 'vitest';
import { countSolutions, findHint, generateSudoku, isValidPlacement, solve } from '../../src/apps/sudoku/solver.js';

describe('Sudoku solver, generator, and hint engine', () => {
  it('correctly validates row, column, and 3x3 box constraints', () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    board[0][0] = 5;

    // Same row cannot have 5
    expect(isValidPlacement(board, 0, 5, 5)).toBe(false);
    expect(isValidPlacement(board, 0, 5, 6)).toBe(true);

    // Same column cannot have 5
    expect(isValidPlacement(board, 5, 0, 5)).toBe(false);
    expect(isValidPlacement(board, 5, 0, 6)).toBe(true);

    // Same 3x3 box cannot have 5
    expect(isValidPlacement(board, 1, 1, 5)).toBe(false);
    expect(isValidPlacement(board, 1, 1, 7)).toBe(true);
  });

  it('solves a standard board and verifies validity', () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    const solved = solve(board);
    expect(solved).toBe(true);

    // Verify all cells filled and valid
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(board[r][c]).toBeGreaterThanOrEqual(1);
        expect(board[r][c]).toBeLessThanOrEqual(9);
        expect(isValidPlacement(board, r, c, board[r][c])).toBe(true);
      }
    }
  });

  it('guarantees unique solution for generated puzzles', () => {
    const { puzzle, solution } = generateSudoku('veryEasy');
    expect(puzzle).toHaveLength(9);
    expect(solution).toHaveLength(9);

    // Must have exactly 1 unique solution
    const solutionsCount = countSolutions(puzzle, 2);
    expect(solutionsCount).toBe(1);
  });

  it('identifies Naked Single technique in hint engine', () => {
    // Construct a board where (0, 0) has only candidate 9
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    // Fill row with 1..8
    for (let c = 1; c <= 8; c++) {
      board[0][c] = c;
    }
    const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
    solution[0][0] = 9;

    const hint = findHint(board, solution);
    expect(hint).not.toBeNull();
    expect(hint?.r).toBe(0);
    expect(hint?.c).toBe(0);
    expect(hint?.value).toBe(9);
    expect(hint?.technique).toBe('Naked Single');
  });
});
