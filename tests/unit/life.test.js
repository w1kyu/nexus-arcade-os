import { describe, it, expect } from 'vitest';
import {
  createGrid,
  stepGeneration,
  stampPattern,
  getPopulation,
  RULES,
  PATTERNS,
  COLS,
} from '../../src/apps/life/logic.js';

describe('Game of Life & Cellular Automata Sandbox', () => {
  it('supports multiple cellular automata rule sets', () => {
    expect(RULES.conway).toBeDefined();
    expect(RULES.highlife).toBeDefined();
    expect(RULES.seeds).toBeDefined();
    expect(RULES.brians_brain).toBeDefined();
    expect(RULES.day_night).toBeDefined();

    expect(RULES.conway.birth).toContain(3);
    expect(RULES.highlife.birth).toContain(6);
    expect(RULES.brians_brain.states).toBe(3);
  });

  it('correctly oscillates Blinker in Conway B3/S23 (period 2)', () => {
    let grid = createGrid();
    // Horizontal Blinker at (10, 10), (11, 10), (12, 10)
    grid[10 * COLS + 10] = 1;
    grid[10 * COLS + 11] = 1;
    grid[10 * COLS + 12] = 1;

    expect(getPopulation(grid)).toBe(3);

    // Generation 1: becomes vertical at (11, 9), (11, 10), (11, 11)
    grid = stepGeneration(grid, 'conway');
    expect(grid[9 * COLS + 11]).toBe(1);
    expect(grid[10 * COLS + 11]).toBe(1);
    expect(grid[11 * COLS + 11]).toBe(1);
    expect(grid[10 * COLS + 10]).toBe(0);
    expect(grid[10 * COLS + 12]).toBe(0);

    // Generation 2: returns to horizontal
    grid = stepGeneration(grid, 'conway');
    expect(grid[10 * COLS + 10]).toBe(1);
    expect(grid[10 * COLS + 11]).toBe(1);
    expect(grid[10 * COLS + 12]).toBe(1);
  });

  it('moves Glider diagonally across the toroidal grid', () => {
    let grid = createGrid();
    stampPattern(grid, 'glider', 5, 5);
    expect(getPopulation(grid)).toBe(5);

    // Glider moves 1 unit diagonally every 4 generations
    for (let i = 0; i < 4; i++) {
      grid = stepGeneration(grid, 'conway');
    }
    // Should still have 5 live cells, but shifted
    expect(getPopulation(grid)).toBe(5);
    expect(grid[6 * COLS + 7]).toBe(1);
  });

  it('stamps patterns from the pattern library', () => {
    const grid = createGrid();
    expect(PATTERNS.glider).toBeDefined();
    expect(PATTERNS.pulsar).toBeDefined();
    expect(PATTERNS.gosper_gun).toBeDefined();

    stampPattern(grid, 'pulsar', 15, 15);
    expect(getPopulation(grid)).toBe(48); // Pulsar has 48 cells
  });

  it('simulates 3-state Brian Brain automaton transitions', () => {
    let grid = createGrid();
    grid[10 * COLS + 10] = 1; // Alive

    grid = stepGeneration(grid, 'brians_brain');
    expect(grid[10 * COLS + 10]).toBe(2); // Dying

    grid = stepGeneration(grid, 'brians_brain');
    expect(grid[10 * COLS + 10]).toBe(0); // Off
  });
});
