// @ts-check
// Solitaire Playing Cards and Shared PRNG Deal Generator

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_SYMBOLS = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};
export const SUIT_COLORS = {
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
};

export const RANK_NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * @typedef {object} Card
 * @property {string} id Unique card ID (e.g. "hearts-13-0")
 * @property {'spades' | 'hearts' | 'diamonds' | 'clubs'} suit
 * @property {number} rank 1..13 (Ace=1, King=13)
 * @property {boolean} faceUp
 */

/**
 * Creates a standard 52-card deck.
 * @param {number} [deckIndex=0]
 * @returns {Card[]}
 */
export function createDeck(deckIndex = 0) {
  /** @type {Card[]} */
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: `${suit}-${rank}-${deckIndex}`,
        suit,
        rank,
        faceUp: false,
      });
    }
  }
  return deck;
}

/**
 * Seeded Mulberry32 PRNG.
 * @param {number} seed
 */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a seeded random function.
 * @template T
 * @param {T[]} array
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function shuffle(array, rng = Math.random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deep clones cards or piles.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function cloneState(obj) {
  return JSON.parse(JSON.stringify(obj));
}
