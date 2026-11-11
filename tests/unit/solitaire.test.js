import { describe, expect, it } from 'vitest';
import { createDeck, mulberry32, shuffle } from '../../src/apps/solitaire/cards.js';
import {
  canFreeCellTableau,
  canKlondikeFoundation,
  canKlondikeTableau,
  canSpiderTableau,
  checkSpiderRun,
  createFreeCell,
  createKlondike,
  createSpider,
  maxFreeCellMove,
} from '../../src/apps/solitaire/games.js';

describe('Solitaire Collection Rules & Invariants', () => {
  it('creates complete and distinct 52-card decks', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(52);
    for (const suit of ['spades', 'hearts', 'diamonds', 'clubs']) {
      const suitCards = deck.filter((c) => c.suit === suit);
      expect(suitCards.length).toBe(13);
      const ranks = suitCards.map((c) => c.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    }
  });

  it('guarantees deterministic deals with mulberry32 PRNG', () => {
    const rng1 = mulberry32(424242);
    const rng2 = mulberry32(424242);
    const deck1 = shuffle(createDeck(), rng1);
    const deck2 = shuffle(createDeck(), rng2);
    expect(deck1.map((c) => c.id)).toEqual(deck2.map((c) => c.id));
  });

  it('initializes Klondike with standard 7-cascade layout and 24 stock cards', () => {
    const k = createKlondike(12345, 1);
    expect(k.tableau.length).toBe(7);
    for (let col = 0; col < 7; col++) {
      expect(k.tableau[col].length).toBe(col + 1);
      // Top card is face up
      expect(k.tableau[col][col].faceUp).toBe(true);
      // Preceding cards are face down
      for (let r = 0; r < col; r++) {
        expect(k.tableau[col][r].faceUp).toBe(false);
      }
    }
    expect(k.stock.length).toBe(24);
    expect(k.waste.length).toBe(0);
    expect(k.foundations.every((f) => f.length === 0)).toBe(true);
  });

  it('validates Klondike foundation placement rules', () => {
    const foundation = [];
    // Only Ace can be placed on empty foundation
    const twoHearts = { id: 'h2', suit: 'hearts', rank: 2, faceUp: true };
    const aceHearts = { id: 'h1', suit: 'hearts', rank: 1, faceUp: true };
    expect(canKlondikeFoundation(twoHearts, foundation)).toBe(false);
    expect(canKlondikeFoundation(aceHearts, foundation)).toBe(true);

    foundation.push(aceHearts);
    // Same suit rank + 1 is valid
    expect(canKlondikeFoundation(twoHearts, foundation)).toBe(true);
    // Different suit is invalid
    const twoSpades = { id: 's2', suit: 'spades', rank: 2, faceUp: true };
    expect(canKlondikeFoundation(twoSpades, foundation)).toBe(false);
  });

  it('validates Klondike tableau placement rules (alternating color, descending rank)', () => {
    const emptyCol = [];
    const kingSpades = { id: 'sk', suit: 'spades', rank: 13, faceUp: true };
    const queenHearts = { id: 'qh', suit: 'hearts', rank: 12, faceUp: true };
    // Only King on empty column
    expect(canKlondikeTableau(queenHearts, emptyCol)).toBe(false);
    expect(canKlondikeTableau(kingSpades, emptyCol)).toBe(true);

    const colWithKing = [kingSpades];
    // Red Queen on Black King is valid
    expect(canKlondikeTableau(queenHearts, colWithKing)).toBe(true);
    // Black Queen on Black King is invalid
    const queenClubs = { id: 'qc', suit: 'clubs', rank: 12, faceUp: true };
    expect(canKlondikeTableau(queenClubs, colWithKing)).toBe(false);
  });

  it('initializes FreeCell with 8 columns all face up and computes max movable cards', () => {
    const fc = createFreeCell(999);
    expect(fc.tableau.length).toBe(8);
    // 4 cols of 7, 4 cols of 6 = 52
    expect(fc.tableau.slice(0, 4).every((c) => c.length === 7)).toBe(true);
    expect(fc.tableau.slice(4).every((c) => c.length === 6)).toBe(true);
    expect(fc.tableau.flat().every((c) => c.faceUp)).toBe(true);

    // Max move formula: (1 + freecells) * 2^(emptyCols)
    // 4 empty freecells, 0 empty cols: (1 + 4) * 2^0 = 5
    expect(maxFreeCellMove(4, 0, false)).toBe(5);
    // 4 empty freecells, 1 empty col (not target): (1 + 4) * 2^1 = 10
    expect(maxFreeCellMove(4, 1, false)).toBe(10);

    const queenHearts = { id: 'qh', suit: 'hearts', rank: 12, faceUp: true };
    const kingSpades = { id: 'sk', suit: 'spades', rank: 13, faceUp: true };
    expect(canFreeCellTableau(queenHearts, [])).toBe(true);
    expect(canFreeCellTableau(queenHearts, [kingSpades])).toBe(true);
  });

  it('initializes Spider and clears completed runs from K to A', () => {
    const sp = createSpider(777, 1);
    expect(sp.tableau.length).toBe(10);
    expect(sp.stock.length).toBe(5);
    expect(sp.stock.every((d) => d.length === 10)).toBe(true);

    const c1 = [{ id: 's9', suit: 'spades', rank: 9, faceUp: true }];
    const colTen = [{ id: 's10', suit: 'spades', rank: 10, faceUp: true }];
    expect(canSpiderTableau(c1, colTen)).toBe(true);
    expect(canSpiderTableau(c1, [])).toBe(true);

    // Complete run of spades K..A
    const col = [];
    for (let rank = 13; rank >= 1; rank--) {
      col.push({ id: `s-${rank}`, suit: 'spades', rank, faceUp: true });
    }
    expect(checkSpiderRun(col)).toBe(true);
    expect(col.length).toBe(0);
  });
});
