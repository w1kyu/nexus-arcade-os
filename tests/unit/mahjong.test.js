import { describe, it, expect } from 'vitest';
import {
  LAYOUTS,
  createDeck,
  areTilesMatching,
  isTileFree,
  generateSolvableDeal,
  findAvailableMatches,
} from '../../src/apps/mahjong/logic.js';

describe('Mahjong Solitaire Logic & Deal Solvability', () => {
  it('creates complete 144 tile deck with all traditional suits', () => {
    const deck = createDeck();
    expect(deck.length).toBe(144);

    const dots = deck.filter((t) => t.suit === 'dots');
    expect(dots.length).toBe(36);

    const bamboo = deck.filter((t) => t.suit === 'bamboo');
    expect(bamboo.length).toBe(36);

    const chars = deck.filter((t) => t.suit === 'chars');
    expect(chars.length).toBe(36);

    const winds = deck.filter((t) => t.suit === 'winds');
    expect(winds.length).toBe(16);

    const dragons = deck.filter((t) => t.suit === 'dragons');
    expect(dragons.length).toBe(12);

    const seasons = deck.filter((t) => t.suit === 'seasons');
    expect(seasons.length).toBe(4);

    const flowers = deck.filter((t) => t.suit === 'flowers');
    expect(flowers.length).toBe(4);
  });

  it('validates tile matching rules including seasons and flowers wildcards', () => {
    // Normal suit match
    expect(areTilesMatching({ suit: 'dots', val: 5 }, { suit: 'dots', val: 5 })).toBe(true);
    expect(areTilesMatching({ suit: 'dots', val: 5 }, { suit: 'dots', val: 6 })).toBe(false);
    expect(areTilesMatching({ suit: 'dots', val: 5 }, { suit: 'bamboo', val: 5 })).toBe(false);

    // Seasons match any season
    expect(areTilesMatching({ suit: 'seasons', val: '春' }, { suit: 'seasons', val: '冬' })).toBe(true);

    // Flowers match any flower
    expect(areTilesMatching({ suit: 'flowers', val: '梅' }, { suit: 'flowers', val: '菊' })).toBe(true);
  });

  it('detects free vs obstructed tiles based on elevation and lateral neighbors', () => {
    /** @type {any[]} */
    const tiles = [
      { id: 1, x: 10, y: 10, z: 0, matched: false }, // Center tile
      { id: 2, x: 8, y: 10, z: 0, matched: false }, // Left neighbor
      { id: 3, x: 12, y: 10, z: 0, matched: false }, // Right neighbor
      { id: 4, x: 10, y: 10, z: 1, matched: false }, // Tile on top
    ];

    // Blocked on top
    expect(isTileFree(tiles[0], tiles)).toBe(false);

    // Remove top tile
    tiles[3].matched = true;
    // Blocked on BOTH left and right
    expect(isTileFree(tiles[0], tiles)).toBe(false);

    // Free left side
    tiles[1].matched = true;
    // Now free! (open on left)
    expect(isTileFree(tiles[0], tiles)).toBe(true);
  });

  it('defines 4 valid 3D layouts', () => {
    const keys = Object.keys(LAYOUTS);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    for (const key of keys) {
      const layout = LAYOUTS[key];
      expect(layout.id).toBeDefined();
      expect(layout.name).toBeDefined();
      expect(layout.positions.length).toBeGreaterThan(20);
      expect(layout.positions.length % 2).toBe(0); // must be even
    }
  });

  it('generates verified solvable deal with available starting moves', () => {
    const tiles = generateSolvableDeal('turtle');
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.suit && t.val)).toBe(true);

    const matches = findAvailableMatches(tiles);
    expect(matches.length).toBeGreaterThan(0);
  });
});
