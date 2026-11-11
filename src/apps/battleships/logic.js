// @ts-check
// Battleships rules, ship placement, and Hunt & Target probability density AI

export const GRID_SIZE = 10;

/** @type {{ id: string, name: { en: string, de: string }, size: number }[]} */
export const SHIPS = [
  { id: 'carrier', name: { en: 'Carrier', de: 'Flugzeugträger' }, size: 5 },
  { id: 'battleship', name: { en: 'Battleship', de: 'Schlachtschiff' }, size: 4 },
  { id: 'cruiser', name: { en: 'Cruiser', de: 'Kreuzer' }, size: 3 },
  { id: 'submarine', name: { en: 'Submarine', de: 'U-Boot' }, size: 3 },
  { id: 'destroyer', name: { en: 'Destroyer', de: 'Zerstörer' }, size: 2 },
];

export const CELL_EMPTY = 0;
export const CELL_MISS = 1;
export const CELL_HIT = 2;
export const CELL_SUNK = 3;

/**
 * @typedef {object} PlacedShip
 * @property {string} id
 * @property {number} size
 * @property {number} r
 * @property {number} c
 * @property {boolean} horizontal
 * @property {number[]} cells All square indices (r * 10 + c)
 * @property {number} hits Number of hits taken
 * @property {boolean} sunk
 */

export function createEmptyGrid() {
  return new Uint8Array(GRID_SIZE * GRID_SIZE);
}

/**
 * Checks if a ship can be placed without extending out of bounds or overlapping other ships.
 * @param {Uint8Array} grid
 * @param {number} size
 * @param {number} r
 * @param {number} c
 * @param {boolean} horizontal
 */
export function canPlaceShip(grid, size, r, c, horizontal) {
  if (horizontal) {
    if (c + size > GRID_SIZE || r >= GRID_SIZE || r < 0 || c < 0) return false;
    for (let i = 0; i < size; i++) {
      if (grid[r * GRID_SIZE + (c + i)] !== 0) return false;
    }
  } else {
    if (r + size > GRID_SIZE || c >= GRID_SIZE || r < 0 || c < 0) return false;
    for (let i = 0; i < size; i++) {
      if (grid[(r + i) * GRID_SIZE + c] !== 0) return false;
    }
  }
  return true;
}

/**
 * Places a ship onto a grid and returns the PlacedShip record.
 * @param {Uint8Array} grid
 * @param {typeof SHIPS[0]} shipDef
 * @param {number} r
 * @param {number} c
 * @param {boolean} horizontal
 * @param {number} shipNum 1-based ship index for grid marking
 * @returns {PlacedShip}
 */
export function placeShip(grid, shipDef, r, c, horizontal, shipNum) {
  /** @type {number[]} */
  const cells = [];
  for (let i = 0; i < shipDef.size; i++) {
    const idx = horizontal ? r * GRID_SIZE + (c + i) : (r + i) * GRID_SIZE + c;
    grid[idx] = shipNum;
    cells.push(idx);
  }
  return {
    id: shipDef.id,
    size: shipDef.size,
    r,
    c,
    horizontal,
    cells,
    hits: 0,
    sunk: false,
  };
}

/**
 * Randomizes placement for all 5 ships on an empty grid.
 * @param {Uint8Array} grid
 * @param {() => number} [rng]
 * @returns {PlacedShip[]}
 */
export function randomizeFleet(grid, rng = Math.random) {
  grid.fill(0);
  /** @type {PlacedShip[]} */
  const placed = [];
  for (let i = 0; i < SHIPS.length; i++) {
    const ship = SHIPS[i];
    let placedShip = false;
    let attempts = 0;
    while (!placedShip && attempts < 500) {
      attempts++;
      const horizontal = rng() > 0.5;
      const r = Math.floor(rng() * GRID_SIZE);
      const c = Math.floor(rng() * GRID_SIZE);
      if (canPlaceShip(grid, ship.size, r, c, horizontal)) {
        placed.push(placeShip(grid, ship, r, c, horizontal, i + 1));
        placedShip = true;
      }
    }
  }
  return placed;
}

/**
 * Fires a shot at an index (0..99).
 * Returns { hit: boolean, sunkShip: PlacedShip | null }
 * @param {Uint8Array} shipGrid
 * @param {Uint8Array} shotsGrid
 * @param {PlacedShip[]} fleet
 * @param {number} idx
 */
export function fireShot(shipGrid, shotsGrid, fleet, idx) {
  if (shotsGrid[idx] !== CELL_EMPTY) return { hit: false, sunkShip: null, alreadyShot: true };

  const shipNum = shipGrid[idx];
  if (shipNum === 0) {
    shotsGrid[idx] = CELL_MISS;
    return { hit: false, sunkShip: null, alreadyShot: false };
  }

  // Hit
  shotsGrid[idx] = CELL_HIT;
  const ship = fleet[shipNum - 1] ?? fleet.find((s) => s.cells.includes(idx));
  if (!ship) return { hit: true, sunkShip: null, alreadyShot: false };
  ship.hits++;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    for (const cell of ship.cells) {
      shotsGrid[cell] = CELL_SUNK;
    }
    return { hit: true, sunkShip: ship, alreadyShot: false };
  }
  return { hit: true, sunkShip: null, alreadyShot: false };
}

/**
 * Checks if all ships in a fleet are sunk.
 * @param {PlacedShip[]} fleet
 */
export function isFleetSunk(fleet) {
  return fleet.every((s) => s.sunk);
}

/**
 * Intelligent Battleship AI using Parity Hunt & Target Probability Density.
 * @param {Uint8Array} shotsGrid
 * @param {PlacedShip[]} enemyFleet
 * @param {() => number} [rng]
 * @returns {number} cell index to fire at
 */
export function chooseAiShot(shotsGrid, enemyFleet, rng = Math.random) {
  // Find unsunk hits on the board
  const unsunkHits = [];
  for (let idx = 0; idx < GRID_SIZE * GRID_SIZE; idx++) {
    if (shotsGrid[idx] === CELL_HIT) unsunkHits.push(idx);
  }

  // 1. TARGET MODE: If there are unsunk hits, attack adjacent cells along potential line
  if (unsunkHits.length > 0) {
    // If multiple hits, determine alignment (horizontal or vertical)
    if (unsunkHits.length >= 2) {
      const r0 = Math.floor(unsunkHits[0] / GRID_SIZE);
      const c0 = unsunkHits[0] % GRID_SIZE;
      const r1 = Math.floor(unsunkHits[1] / GRID_SIZE);
      const isHorizontal = r0 === r1;

      /** @type {number[]} */
      const inlineTargets = [];
      if (isHorizontal) {
        // Try left and right ends of the line
        const r = r0;
        const cols = unsunkHits.map((idx) => idx % GRID_SIZE).sort((a, b) => a - b);
        const minC = cols[0] - 1;
        const maxC = cols[cols.length - 1] + 1;
        if (minC >= 0 && shotsGrid[r * GRID_SIZE + minC] === CELL_EMPTY) inlineTargets.push(r * GRID_SIZE + minC);
        if (maxC < GRID_SIZE && shotsGrid[r * GRID_SIZE + maxC] === CELL_EMPTY)
          inlineTargets.push(r * GRID_SIZE + maxC);
      } else {
        // Try top and bottom ends of the line
        const c = c0;
        const rows = unsunkHits.map((idx) => Math.floor(idx / GRID_SIZE)).sort((a, b) => a - b);
        const minR = rows[0] - 1;
        const maxR = rows[rows.length - 1] + 1;
        if (minR >= 0 && shotsGrid[minR * GRID_SIZE + c] === CELL_EMPTY) inlineTargets.push(minR * GRID_SIZE + c);
        if (maxR < GRID_SIZE && shotsGrid[maxR * GRID_SIZE + c] === CELL_EMPTY)
          inlineTargets.push(maxR * GRID_SIZE + c);
      }

      if (inlineTargets.length > 0) {
        return inlineTargets[Math.floor(rng() * inlineTargets.length)];
      }
    }

    // Single hit or ends blocked: try 4-way adjacent
    /** @type {number[]} */
    const adjCandidates = [];
    for (const hit of unsunkHits) {
      const r = Math.floor(hit / GRID_SIZE);
      const c = hit % GRID_SIZE;
      const neighbors = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          const nIdx = nr * GRID_SIZE + nc;
          if (shotsGrid[nIdx] === CELL_EMPTY && !adjCandidates.includes(nIdx)) {
            adjCandidates.push(nIdx);
          }
        }
      }
    }
    if (adjCandidates.length > 0) {
      return adjCandidates[Math.floor(rng() * adjCandidates.length)];
    }
  }

  // 2. HUNT MODE: Probability density with parity
  // Find smallest unsunk ship length
  const unsunkShips = enemyFleet.filter((s) => !s.sunk);
  const minLen = unsunkShips.length > 0 ? Math.min(...unsunkShips.map((s) => s.size)) : 2;

  // Calculate density score for every empty cell
  const density = new Float32Array(GRID_SIZE * GRID_SIZE);

  for (const ship of unsunkShips) {
    const len = ship.size;
    // Horizontal fits
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c <= GRID_SIZE - len; c++) {
        let fits = true;
        for (let i = 0; i < len; i++) {
          const st = shotsGrid[r * GRID_SIZE + (c + i)];
          if (st === CELL_MISS || st === CELL_SUNK) {
            fits = false;
            break;
          }
        }
        if (fits) {
          for (let i = 0; i < len; i++) {
            const idx = r * GRID_SIZE + (c + i);
            if (shotsGrid[idx] === CELL_EMPTY) density[idx] += 1;
          }
        }
      }
    }
    // Vertical fits
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r <= GRID_SIZE - len; r++) {
        let fits = true;
        for (let i = 0; i < len; i++) {
          const st = shotsGrid[(r + i) * GRID_SIZE + c];
          if (st === CELL_MISS || st === CELL_SUNK) {
            fits = false;
            break;
          }
        }
        if (fits) {
          for (let i = 0; i < len; i++) {
            const idx = (r + i) * GRID_SIZE + c;
            if (shotsGrid[idx] === CELL_EMPTY) density[idx] += 1;
          }
        }
      }
    }
  }

  // Apply parity filter if minLen >= 2
  let maxScore = -1;
  /** @type {number[]} */
  let bestCells = [];

  for (let idx = 0; idx < GRID_SIZE * GRID_SIZE; idx++) {
    if (shotsGrid[idx] !== CELL_EMPTY) continue;
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    // Checkerboard parity bonus
    const parityMatch = (r + c) % minLen === 0;
    const score = density[idx] * (parityMatch ? 1.5 : 1.0);

    if (score > maxScore) {
      maxScore = score;
      bestCells = [idx];
    } else if (score === maxScore) {
      bestCells.push(idx);
    }
  }

  if (bestCells.length > 0) {
    return bestCells[Math.floor(rng() * bestCells.length)];
  }

  // Fallback: any empty cell
  const empty = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    if (shotsGrid[i] === CELL_EMPTY) empty.push(i);
  }
  return empty[Math.floor(rng() * empty.length)];
}
