import { describe, expect, it } from 'vitest';
import {
  BISHOP,
  Game,
  KNIGHT,
  Position,
  QUEEN,
  ROOK,
  START_FEN,
  WHITE,
  squareName,
} from '../../src/apps/chess/engine.js';
import { CHESS_PUZZLES } from '../../src/apps/chess/puzzles.js';
import { LEVELS, search } from '../../src/apps/chess/search.js';

describe('Nexus Chess Engine & Rules', () => {
  it('passes perft invariants on standard positions', () => {
    const pos = new Position(START_FEN);
    expect(pos.perft(1)).toBe(20);
    expect(pos.perft(2)).toBe(400);
    expect(pos.perft(3)).toBe(8902);
  });

  it('correctly handles castling on both sides', () => {
    // Position where both White and Black can castle both sides
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const pos = new Position(fen);
    const moves = pos.legalMoves().map((m) => pos.san(m));
    expect(moves).toContain('O-O');
    expect(moves).toContain('O-O-O');

    // Make kingside castling
    const o_o = pos.parseMove('O-O');
    expect(o_o).toBeDefined();
    pos.make(o_o);
    expect(pos.board[pos.kings[WHITE]]).toBe(6);
    expect(squareName(pos.kings[WHITE])).toBe('g1');
  });

  it('correctly executes en passant capture', () => {
    const pos = new Position('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    const epMove = pos.parseMove('exf6');
    expect(epMove).toBeDefined();
    pos.make(epMove);
    expect(squareName(epMove.to)).toBe('f6');
    // Captured black pawn on f5 is removed
    const f5Sq = 4 * 16 + 5;
    expect(pos.board[f5Sq]).toBe(0);
  });

  it('handles pawn promotion properly', () => {
    const pos = new Position('8/4P3/8/8/8/8/8/k6K w - - 0 1');
    const promos = pos.legalMoves().filter((m) => m.promo);
    expect(promos.length).toBe(4); // Q, R, B, N promotions
    const promoTypes = promos.map((m) => m.promo).sort();
    expect(promoTypes).toEqual([KNIGHT, BISHOP, ROOK, QUEEN].sort());
  });

  it('detects checkmate and stalemate correctly', () => {
    // Scholar's mate
    const game = new Game();
    ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'].forEach((m) => {
      expect(game.playText(m)).toBe(true);
    });
    const status = game.status();
    expect(status.state).toBe('checkmate');
    expect(status.winner).toBe(WHITE);

    // Stalemate position
    const gStale = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(gStale.status().state).toBe('stalemate');
  });

  it('detects threefold repetition draw', () => {
    const g = new Game();
    // Knight dance
    const sequence = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
    for (const m of sequence) {
      g.playText(m);
    }
    expect(g.status().state).toBe('draw');
    expect(g.status().reason).toBe('repetition');
  });

  it('detects insufficient material draw', () => {
    const g1 = new Game('8/8/8/4k3/8/8/4K3/8 w - - 0 1'); // K vs K
    expect(g1.status().state).toBe('draw');
    expect(g1.status().reason).toBe('material');

    const g2 = new Game('8/8/8/4k3/8/5B2/4K3/8 w - - 0 1'); // K+B vs K
    expect(g2.status().state).toBe('draw');
    expect(g2.status().reason).toBe('material');
  });

  it('verifies all bundled tactical chess puzzles are legal and solvable', () => {
    expect(CHESS_PUZZLES.length).toBeGreaterThanOrEqual(8);
    for (const p of CHESS_PUZZLES) {
      const pos = new Position(p.fen);
      for (const m of p.moves) {
        const parsed = pos.parseMove(m);
        expect(parsed, `Move ${m} in puzzle ${p.id}`).toBeDefined();
        pos.make(parsed);
      }
    }
  });

  it('AI finds mate in 1 quickly', () => {
    const pos = new Position('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    const res = search(pos, LEVELS[3]);
    expect(pos.san(res.move)).toBe('Qxf7#');
  });
});
