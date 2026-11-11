import { describe, expect, it } from 'vitest';
import {
  CELL_HIT,
  CELL_MISS,
  CELL_SUNK,
  SHIPS,
  canPlaceShip,
  chooseAiShot,
  createEmptyGrid,
  fireShot,
  isFleetSunk,
  placeShip,
  randomizeFleet,
} from '../../src/apps/battleships/logic.js';

describe('Battleships Rules and AI', () => {
  it('defines the standard 5 naval ships with correct sizes', () => {
    expect(SHIPS.length).toBe(5);
    const sizes = SHIPS.map((s) => s.size);
    expect(sizes).toEqual([5, 4, 3, 3, 2]);
    const totalCells = sizes.reduce((a, b) => a + b, 0);
    expect(totalCells).toBe(17);
  });

  it('validates ship placement boundaries and overlaps', () => {
    const grid = createEmptyGrid();
    // Carrier horizontal at (0, 0)
    expect(canPlaceShip(grid, 5, 0, 0, true)).toBe(true);
    // Carrier horizontal at (0, 6) -> out of bounds (c + size = 11 > 10)
    expect(canPlaceShip(grid, 5, 0, 6, true)).toBe(false);

    // Place a ship
    placeShip(grid, SHIPS[0], 0, 0, true, 1);
    // Overlapping placement is rejected
    expect(canPlaceShip(grid, 4, 0, 2, false)).toBe(false);
    // Non-overlapping placement is accepted
    expect(canPlaceShip(grid, 4, 2, 2, false)).toBe(true);
  });

  it('randomizes fleet with all 5 ships placed and exactly 17 occupied cells', () => {
    const grid = createEmptyGrid();
    const fleet = randomizeFleet(grid);
    expect(fleet.length).toBe(5);
    let occupied = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] > 0) occupied++;
    }
    expect(occupied).toBe(17);
  });

  it('correctly reports misses, hits, and sinking', () => {
    const shipGrid = createEmptyGrid();
    const shotsGrid = createEmptyGrid();
    const destroyer = placeShip(shipGrid, SHIPS[4], 5, 5, true, 5); // size 2, cells (55, 56)
    const fleet = [destroyer];

    // Miss at (0, 0)
    const missRes = fireShot(shipGrid, shotsGrid, fleet, 0);
    expect(missRes.hit).toBe(false);
    expect(shotsGrid[0]).toBe(CELL_MISS);

    // Hit 1 at (5, 5) -> index 55
    const hit1 = fireShot(shipGrid, shotsGrid, fleet, 55);
    expect(hit1.hit).toBe(true);
    expect(hit1.sunkShip).toBeNull();
    expect(shotsGrid[55]).toBe(CELL_HIT);
    expect(destroyer.sunk).toBe(false);

    // Hit 2 at (5, 6) -> index 56 -> Sunk!
    const hit2 = fireShot(shipGrid, shotsGrid, fleet, 56);
    expect(hit2.hit).toBe(true);
    expect(hit2.sunkShip).toBe(destroyer);
    expect(destroyer.sunk).toBe(true);
    expect(shotsGrid[55]).toBe(CELL_SUNK);
    expect(shotsGrid[56]).toBe(CELL_SUNK);
    expect(isFleetSunk(fleet)).toBe(true);
  });

  it('AI enters target mode and fires at adjacent cells of an unsunk hit', () => {
    const shotsGrid = createEmptyGrid();
    // Simulate hit at center (4, 4) -> index 44
    shotsGrid[44] = CELL_HIT;
    const enemyFleet = [
      { id: 'cruiser', size: 3, sunk: false, hits: 1, cells: [44, 45, 46], r: 4, c: 4, horizontal: true },
    ];

    const aiShot = chooseAiShot(shotsGrid, enemyFleet, () => 0);
    // Adjacent neighbors of 44 are: 34 (up), 54 (down), 43 (left), 45 (right)
    expect([34, 54, 43, 45]).toContain(aiShot);
  });
});
