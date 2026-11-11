import { describe, it, expect } from 'vitest';
import {
  createMatch3Board,
  isAdjacent,
  findMatches,
  swapGems,
  applyGravityAndRefill,
  createMatch3State,
  MATCH3_LEVELS,
  BOARD_SIZE,
} from '../../src/apps/match3/logic.js';

describe('Match-3 Puzzle Engine & Combos', () => {
  it('generates 8x8 grid without any initial 3-in-a-row matches', () => {
    const board = createMatch3Board();
    expect(board.length).toBe(64);
    expect(board.every((g) => g && g.type)).toBe(true);

    const { matchedSet } = findMatches(board);
    expect(matchedSet.size).toBe(0);
  });

  it('correctly calculates cell adjacency for swaps', () => {
    expect(isAdjacent(0, 1)).toBe(true); // horizontal neighbors
    expect(isAdjacent(0, 8)).toBe(true); // vertical neighbors
    expect(isAdjacent(0, 9)).toBe(false); // diagonal
    expect(isAdjacent(0, 2)).toBe(false); // distance 2
  });

  it('detects horizontal and vertical 3-matches', () => {
    const board = createMatch3Board();
    // Force a horizontal match-3
    board[0].type = 'ruby';
    board[1].type = 'ruby';
    board[2].type = 'ruby';

    const { matchedSet, groups } = findMatches(board);
    expect(matchedSet.has(0)).toBe(true);
    expect(matchedSet.has(1)).toBe(true);
    expect(matchedSet.has(2)).toBe(true);
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });

  it('swaps two gems and applies gravity refill after clearing matches', () => {
    const board = createMatch3Board();
    const g0 = board[0];
    const g1 = board[1];

    swapGems(board, 0, 1);
    expect(board[0]).toBe(g1);
    expect(board[1]).toBe(g0);

    // Clear matched cells
    const cleared = new Set([0, 1, 2]);
    applyGravityAndRefill(board, cleared);

    // Board should be completely full again with 64 gems
    expect(board.length).toBe(64);
    expect(board.every((g) => g && g.type)).toBe(true);
  });

  it('defines 10 levels with specific objectives and move budgets', () => {
    expect(MATCH3_LEVELS.length).toBeGreaterThanOrEqual(10);
    for (const lvl of MATCH3_LEVELS) {
      expect(lvl.moves).toBeGreaterThan(10);
      expect(lvl.targetScore).toBeGreaterThan(1000);
      expect(lvl.goalGem).toBeDefined();
      expect(lvl.goalCount).toBeGreaterThan(0);
    }

    const state = createMatch3State(0);
    expect(state.movesRemaining).toBe(MATCH3_LEVELS[0].moves);
    expect(state.board.length).toBe(BOARD_SIZE * BOARD_SIZE);
  });
});
