import { describe, expect, it } from 'vitest';
import { applyMove, createState, legalMoves, outcome, perft, stateFromText } from '../../src/apps/checkers/logic.js';

describe('Checkers / Dame Rules and AI', () => {
  it('initializes standard (8x8) and international (10x10) boards correctly', () => {
    const std = createState('standard');
    expect(std.rules.size).toBe(8);
    expect(std.board.filter((x) => x === 1).length).toBe(12);
    expect(std.board.filter((x) => x === -1).length).toBe(12);

    const intl = createState('international');
    expect(intl.rules.size).toBe(10);
    expect(intl.board.filter((x) => x === 1).length).toBe(20);
    expect(intl.board.filter((x) => x === -1).length).toBe(20);
  });

  it('generates correct perft counts for standard draughts', () => {
    const s = createState('standard');
    expect(perft(s, 1)).toBe(7);
    expect(perft(s, 2)).toBe(49);
    expect(perft(s, 3)).toBe(302);
  });

  it('enforces mandatory jump captures', () => {
    const rows = ['........', '........', '........', '........', '...M....', '..m.....', '........', '........'];
    // Player 1's turn
    const s = stateFromText(rows, 1, 'standard');
    const moves = legalMoves(s);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.captures.length).toBeGreaterThan(0);
    }
  });

  it('crowns men into kings upon reaching the opposite rank', () => {
    const rows = ['........', '..m.....', '........', '........', '........', '........', '........', '........'];
    const s = stateFromText(rows, 1, 'standard');
    const moves = legalMoves(s);
    const advance = moves.find((m) => m.path[0] < 8);
    expect(advance).toBeDefined();
    if (advance) {
      const next = applyMove(s, advance);
      // Square should now contain a crowned king (piece = 2)
      expect(next.board[advance.path[0]]).toBe(2);
    }
  });

  it('detects terminal state when no legal moves remain', () => {
    // Player 1 has no pieces
    const rows = ['........', '........', '........', '........', '........', '........', '........', '...M....'];
    const s = stateFromText(rows, 1, 'standard');
    expect(outcome(s)).not.toBeNull();
  });
});
