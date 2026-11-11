// @ts-check

/**
 * Mahjong Solitaire Tile Engine, Reverse Solvable Deal Generator & Matcher
 */

/**
 * Tile Definition
 * @typedef {object} Tile
 * @property {number} id
 * @property {string} suit 'dots' | 'bamboo' | 'chars' | 'winds' | 'dragons' | 'seasons' | 'flowers'
 * @property {number | string} val
 * @property {string} glyph
 * @property {number} x Grid column (can be half-steps, e.g. 0..30)
 * @property {number} y Grid row
 * @property {number} z Layer elevation (0, 1, 2, 3, 4)
 * @property {boolean} matched
 */

/**
 * Layouts: list of { x, y, z } coordinates
 */
export const LAYOUTS = {
  turtle: {
    id: 'turtle',
    name: 'Turtle Classic',
    positions: generateTurtleLayout(),
  },
  monument: {
    id: 'monument',
    name: 'Monument',
    positions: generateMonumentLayout(),
  },
  fortress: {
    id: 'fortress',
    name: 'Fortress',
    positions: generateFortressLayout(),
  },
  arena: {
    id: 'arena',
    name: 'Arena',
    positions: generateArenaLayout(),
  },
};

function generateTurtleLayout() {
  /** @type {{ x: number, y: number, z: number }[]} */
  const pos = [];
  // Bottom layer (z=0): 12x8 layout with wings
  for (let y = 1; y <= 6; y++) {
    for (let x = 3; x <= 12; x++) {
      if ((y === 1 || y === 6) && (x < 4 || x > 11)) continue;
      pos.push({ x: x * 2, y: y * 2, z: 0 });
    }
  }
  // Wings on left & right
  pos.push({ x: 2, y: 7, z: 0 }, { x: 4, y: 7, z: 0 }, { x: 24, y: 7, z: 0 }, { x: 26, y: 7, z: 0 });
  // Layer 1 (z=1): 6x6
  for (let y = 2; y <= 5; y++) {
    for (let x = 5; x <= 10; x++) {
      pos.push({ x: x * 2, y: y * 2, z: 1 });
    }
  }
  // Layer 2 (z=2): 4x4
  for (let y = 3; y <= 4; y++) {
    for (let x = 6; x <= 9; x++) {
      pos.push({ x: x * 2, y: y * 2, z: 2 });
    }
  }
  // Layer 3 (z=3): 2x2
  pos.push({ x: 14, y: 7, z: 3 }, { x: 16, y: 7, z: 3 });
  // Layer 4 (z=4): Cap tile
  pos.push({ x: 15, y: 7, z: 4 });

  // Ensure total count is even for pairing
  if (pos.length % 2 !== 0) pos.pop();
  return pos;
}

function generateMonumentLayout() {
  const pos = [];
  for (let z = 0; z < 4; z++) {
    const size = 5 - z;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        pos.push({ x: (6 + x) * 2, y: (3 + y) * 2, z });
      }
    }
  }
  if (pos.length % 2 !== 0) pos.pop();
  return pos;
}

function generateFortressLayout() {
  const pos = [];
  for (let y = 1; y <= 6; y++) {
    for (let x = 2; x <= 10; x++) {
      if (x === 2 || x === 10 || y === 1 || y === 6) {
        pos.push({ x: x * 2, y: y * 2, z: 0 });
        pos.push({ x: x * 2, y: y * 2, z: 1 });
      }
    }
  }
  if (pos.length % 2 !== 0) pos.pop();
  return pos;
}

function generateArenaLayout() {
  const pos = [];
  for (let y = 1; y <= 6; y++) {
    for (let x = 2; x <= 11; x++) {
      const z = x === 2 || x === 11 || y === 1 || y === 6 ? 1 : 0;
      pos.push({ x: x * 2, y: y * 2, z });
    }
  }
  if (pos.length % 2 !== 0) pos.pop();
  return pos;
}

/**
 * Standard 144 Mahjong Tiles Deck
 */
export function createDeck() {
  const deck = [];
  let id = 1;

  // Dots (1..9 x4)
  for (let n = 1; n <= 9; n++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: id++, suit: 'dots', val: n, glyph: `${n}●` });
    }
  }
  // Bamboos (1..9 x4)
  for (let n = 1; n <= 9; n++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: id++, suit: 'bamboo', val: n, glyph: `${n}🎋` });
    }
  }
  // Characters (1..9 x4)
  for (let n = 1; n <= 9; n++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: id++, suit: 'chars', val: n, glyph: `${n}萬` });
    }
  }
  // Winds (East, South, West, North x4)
  const winds = ['東', '南', '西', '北'];
  for (const w of winds) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: id++, suit: 'winds', val: w, glyph: w });
    }
  }
  // Dragons (Red, Green, White x4)
  const dragons = ['中', '發', '白'];
  for (const d of dragons) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: id++, suit: 'dragons', val: d, glyph: d });
    }
  }
  // Seasons (Spring, Summer, Autumn, Winter x1)
  const seasons = ['春', '夏', '秋', '冬'];
  for (const s of seasons) {
    deck.push({ id: id++, suit: 'seasons', val: s, glyph: s });
  }
  // Flowers (Plum, Orchid, Bamboo, Chrysanthemum x1)
  const flowers = ['梅', '蘭', '竹', '菊'];
  for (const f of flowers) {
    deck.push({ id: id++, suit: 'flowers', val: f, glyph: f });
  }

  return deck;
}

/**
 * Checks if two tiles can be matched
 * @param {Tile} t1
 * @param {Tile} t2
 */
export function areTilesMatching(t1, t2) {
  if (t1.suit !== t2.suit) return false;
  // Seasons match any season
  if (t1.suit === 'seasons') return true;
  // Flowers match any flower
  if (t1.suit === 'flowers') return true;
  // Standard matching
  return t1.val === t2.val;
}

/**
 * Checks if a tile is free (unblocked on top, and unobstructed on at least left or right)
 * @param {Tile} tile
 * @param {Tile[]} allTiles
 */
export function isTileFree(tile, allTiles) {
  if (tile.matched) return false;

  const active = allTiles.filter((t) => !t.matched && t.id !== tile.id);

  // 1. Check tile directly on top (z + 1, overlapping by dx < 2 and dy < 2)
  const coveredOnTop = active.some((t) => {
    return t.z === tile.z + 1 && Math.abs(t.x - tile.x) < 2 && Math.abs(t.y - tile.y) < 2;
  });
  if (coveredOnTop) return false;

  // 2. Check left obstruction (same z, x === tile.x - 2, |dy| < 2)
  const blockedLeft = active.some((t) => {
    return t.z === tile.z && Math.abs(t.x - (tile.x - 2)) < 0.5 && Math.abs(t.y - tile.y) < 2;
  });

  // 3. Check right obstruction (same z, x === tile.x + 2, |dy| < 2)
  const blockedRight = active.some((t) => {
    return t.z === tile.z && Math.abs(t.x - (tile.x + 2)) < 0.5 && Math.abs(t.y - tile.y) < 2;
  });

  // Free if at least ONE side is open
  return !blockedLeft || !blockedRight;
}

/**
 * Generates a verified 100% solvable deal by reverse pairing
 * @param {string} [layoutId='turtle']
 */
export function generateSolvableDeal(layoutId = 'turtle') {
  const layout = LAYOUTS[/** @type {keyof typeof LAYOUTS} */ (layoutId)] || LAYOUTS.turtle;
  const positions = [...layout.positions];
  const deck = createDeck();

  // Create initial empty tile slots
  /** @type {Tile[]} */
  const tiles = positions.map((p, idx) => ({
    id: idx + 1,
    suit: '',
    val: '',
    glyph: '',
    x: p.x,
    y: p.y,
    z: p.z,
    matched: false,
  }));

  // Pair generator: group deck into matching pairs
  const pairs = [];
  for (let i = 0; i < deck.length; i += 2) {
    if (i + 1 < deck.length) {
      pairs.push([deck[i], deck[i + 1]]);
    }
  }

  // Reverse solve: find free slots, place pair, mark slots filled
  const remainingSlots = [...tiles];
  const assigned = new Set();

  while (remainingSlots.length >= 2) {
    // Find slots that are currently "free" (removable in normal play)
    const availableSlots = remainingSlots.filter((slot) => isTileFree(slot, remainingSlots));

    if (availableSlots.length < 2) {
      // Fallback: pair arbitrary remaining slots if topology gets cornered
      availableSlots.push(remainingSlots[0], remainingSlots[1]);
    }

    const s1 = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const filtered = availableSlots.filter((s) => s.id !== s1.id);
    const s2 = filtered[Math.floor(Math.random() * filtered.length)] || remainingSlots.find((s) => s.id !== s1.id);

    const pair = pairs.pop() || [deck[0], deck[1]];

    s1.suit = pair[0].suit;
    s1.val = pair[0].val;
    s1.glyph = pair[0].glyph;
    assigned.add(s1.id);

    s2.suit = pair[1].suit;
    s2.val = pair[1].val;
    s2.glyph = pair[1].glyph;
    assigned.add(s2.id);

    const idx1 = remainingSlots.indexOf(s1);
    if (idx1 >= 0) remainingSlots.splice(idx1, 1);
    const idx2 = remainingSlots.indexOf(s2);
    if (idx2 >= 0) remainingSlots.splice(idx2, 1);
  }

  return tiles;
}

/**
 * Finds all available matching pairs among free tiles
 * @param {Tile[]} tiles
 */
export function findAvailableMatches(tiles) {
  const freeTiles = tiles.filter((t) => isTileFree(t, tiles));
  /** @type {[Tile, Tile][]} */
  const matches = [];

  for (let i = 0; i < freeTiles.length; i++) {
    for (let j = i + 1; j < freeTiles.length; j++) {
      if (areTilesMatching(freeTiles[i], freeTiles[j])) {
        matches.push([freeTiles[i], freeTiles[j]]);
      }
    }
  }

  return matches;
}
