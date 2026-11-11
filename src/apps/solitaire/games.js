// @ts-check
import { SUIT_COLORS, SUITS, createDeck, mulberry32, shuffle } from './cards.js';

/**
 * Klondike Solitaire Engine
 * @param {number} seed
 * @param {1 | 3} [drawCount=1]
 */
export function createKlondike(seed, drawCount = 1) {
  const rng = mulberry32(seed);
  const deck = shuffle(createDeck(0), rng);

  /** @type {import('./cards.js').Card[][]} */
  const tableau = [[], [], [], [], [], [], []];
  let cardIdx = 0;
  for (let col = 0; col < 7; col++) {
    for (let r = 0; r <= col; r++) {
      const card = deck[cardIdx++];
      card.faceUp = r === col;
      tableau[col].push(card);
    }
  }

  const stock = deck.slice(cardIdx).map((c) => ({ ...c, faceUp: false }));
  /** @type {import('./cards.js').Card[]} */
  const waste = [];
  /** @type {import('./cards.js').Card[][]} */
  const foundations = [[], [], [], []];

  return {
    type: 'klondike',
    drawCount,
    seed,
    stock,
    waste,
    foundations,
    tableau,
  };
}

/**
 * FreeCell Solitaire Engine
 * @param {number} seed
 */
export function createFreeCell(seed) {
  const rng = mulberry32(seed);
  const deck = shuffle(createDeck(0), rng).map((c) => ({ ...c, faceUp: true }));

  /** @type {import('./cards.js').Card[][]} */
  const tableau = [[], [], [], [], [], [], [], []];
  deck.forEach((card, i) => {
    tableau[i % 8].push(card);
  });

  /** @type {(import('./cards.js').Card | null)[]} */
  const freecells = [null, null, null, null];
  /** @type {import('./cards.js').Card[][]} */
  const foundations = [[], [], [], []];

  return {
    type: 'freecell',
    seed,
    freecells,
    foundations,
    tableau,
  };
}

/**
 * Spider Solitaire Engine
 * @param {number} seed
 * @param {1 | 2 | 4} [suits=1]
 */
export function createSpider(seed, suits = 1) {
  const rng = mulberry32(seed);
  /** @type {import('./cards.js').Card[]} */
  let deck = [];

  if (suits === 1) {
    for (let d = 0; d < 8; d++) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: `spades-${rank}-${d}`, suit: 'spades', rank, faceUp: false });
      }
    }
  } else if (suits === 2) {
    for (let d = 0; d < 4; d++) {
      for (const suit of ['spades', 'hearts']) {
        for (let rank = 1; rank <= 13; rank++) {
          deck.push({ id: `${suit}-${rank}-${d}`, suit: /** @type {any} */ (suit), rank, faceUp: false });
        }
      }
    }
  } else {
    for (let d = 0; d < 2; d++) {
      for (const suit of SUITS) {
        for (let rank = 1; rank <= 13; rank++) {
          deck.push({ id: `${suit}-${rank}-${d}`, suit: /** @type {any} */ (suit), rank, faceUp: false });
        }
      }
    }
  }

  deck = shuffle(deck, rng);

  /** @type {import('./cards.js').Card[][]} */
  const tableau = [[], [], [], [], [], [], [], [], [], []];
  let cardIdx = 0;
  for (let c = 0; c < 10; c++) {
    const total = c < 4 ? 6 : 5;
    for (let r = 0; r < total; r++) {
      const card = deck[cardIdx++];
      card.faceUp = r === total - 1;
      tableau[c].push(card);
    }
  }

  /** @type {import('./cards.js').Card[][]} 5 deals of 10 cards */
  const stock = [];
  for (let deal = 0; deal < 5; deal++) {
    const pack = [];
    for (let c = 0; c < 10; c++) {
      pack.push({ ...deck[cardIdx++], faceUp: true });
    }
    stock.push(pack);
  }

  return {
    type: 'spider',
    suits,
    seed,
    stock,
    tableau,
    completedSuits: 0,
  };
}

// ── Rule Validation Helpers ──────────────────────────────────────────────────

/**
 * Checks if a card can be placed onto a Klondike foundation pile.
 * @param {import('./cards.js').Card} card
 * @param {import('./cards.js').Card[]} foundation
 */
export function canKlondikeFoundation(card, foundation) {
  if (!foundation.length) return card.rank === 1;
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && top.rank === card.rank - 1;
}

/**
 * Checks if a card or stack can be placed onto a Klondike tableau pile.
 * @param {import('./cards.js').Card} card
 * @param {import('./cards.js').Card[]} tableauCol
 */
export function canKlondikeTableau(card, tableauCol) {
  if (!tableauCol.length) return card.rank === 13; // Only King on empty
  const top = tableauCol[tableauCol.length - 1];
  if (!top.faceUp) return false;
  return SUIT_COLORS[top.suit] !== SUIT_COLORS[card.suit] && top.rank === card.rank + 1;
}

/**
 * Checks if a card or stack can be placed onto a FreeCell tableau pile.
 * @param {import('./cards.js').Card} card
 * @param {import('./cards.js').Card[]} tableauCol
 */
export function canFreeCellTableau(card, tableauCol) {
  if (!tableauCol.length) return true; // Any card on empty in FreeCell
  const top = tableauCol[tableauCol.length - 1];
  return SUIT_COLORS[top.suit] !== SUIT_COLORS[card.suit] && top.rank === card.rank + 1;
}

/**
 * Max cards movable at once in FreeCell.
 * @param {number} emptyCells
 * @param {number} emptyCols
 * @param {boolean} targetIsEmptyCol
 */
export function maxFreeCellMove(emptyCells, emptyCols, targetIsEmptyCol) {
  const effectiveEmptyCols = targetIsEmptyCol ? Math.max(0, emptyCols - 1) : emptyCols;
  return (1 + emptyCells) * 2 ** effectiveEmptyCols;
}

/**
 * Checks if cards in Spider can be moved onto a tableau column.
 * @param {import('./cards.js').Card[]} cards
 * @param {import('./cards.js').Card[]} tableauCol
 */
export function canSpiderTableau(cards, tableauCol) {
  if (!cards.length) return false;
  // All cards in moving stack must be in sequence and of same suit
  for (let i = 0; i < cards.length - 1; i++) {
    if (cards[i].suit !== cards[i + 1].suit || cards[i].rank !== cards[i + 1].rank + 1) {
      return false;
    }
  }
  if (!tableauCol.length) return true;
  const top = tableauCol[tableauCol.length - 1];
  return top.rank === cards[0].rank + 1;
}

/**
 * Checks and clears completed King-to-Ace same-suit runs in Spider column.
 * Returns true if a run was removed.
 * @param {import('./cards.js').Card[]} col
 */
export function checkSpiderRun(col) {
  if (col.length < 13) return false;
  for (let i = col.length - 13; i <= col.length - 13; i++) {
    const run = col.slice(i, i + 13);
    const suit = run[0].suit;
    let valid = true;
    for (let j = 0; j < 13; j++) {
      if (!run[j].faceUp || run[j].suit !== suit || run[j].rank !== 13 - j) {
        valid = false;
        break;
      }
    }
    if (valid) {
      col.splice(i, 13);
      if (col.length && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
      }
      return true;
    }
  }
  return false;
}
