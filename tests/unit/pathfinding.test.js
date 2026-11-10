// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  PATHFINDING_ALGORITHMS,
  astar,
  bfs,
  bidirectionalBfs,
  calculateHeuristic,
  dfs,
  dijkstra,
  getNeighbors,
  greedyBestFirst,
} from '../../src/apps/pathfinding/algorithms.js';
import {
  createEmptyGrid,
  generateKruskalMaze,
  generatePrimMaze,
  generateRandomTerrain,
  generateRecursiveBacktracker,
  generateRecursiveDivision,
} from '../../src/apps/pathfinding/mazes.js';

describe('Pathfinding & Maze Algorithms', () => {
  it('calculates heuristics correctly', () => {
    const a = [0, 0];
    const b = [3, 4];
    expect(calculateHeuristic(a, b, 'manhattan')).toBe(7);
    expect(calculateHeuristic(a, b, 'euclidean')).toBe(5);
    expect(calculateHeuristic(a, b, 'chebyshev')).toBe(4);
  });

  it('gets valid neighbors with 4-way and diagonal movement', () => {
    const grid = createEmptyGrid(5, 5);
    grid[0][1] = Infinity; // wall
    const n4 = getNeighbors(0, 0, 5, 5, false, grid);
    expect(n4.length).toBe(1); // [1, 0] only since [0, 1] is wall

    const n8 = getNeighbors(0, 0, 5, 5, true, grid);
    expect(n8.length).toBe(2); // [1, 0] and diagonal [1, 1]
  });

  function runPathfinding(generatorFn, grid, start, goal, opts) {
    const gen = generatorFn(grid, start, goal, opts);
    let step = gen.next();
    let pathStep = null;
    let count = 0;
    while (!step.done && count < 2000) {
      if (step.value?.type === 'path') {
        pathStep = step.value;
      }
      step = gen.next();
      count++;
    }
    return pathStep;
  }

  it('finds paths using BFS, DFS, Dijkstra, A*, Greedy, and Bidirectional BFS', () => {
    const grid = createEmptyGrid(10, 10);
    // Add an obstacle wall
    for (let r = 2; r <= 8; r++) {
      grid[r][5] = Infinity;
    }
    const start = [5, 2];
    const goal = [5, 8];

    const algos = [bfs, dfs, dijkstra, astar, greedyBestFirst, bidirectionalBfs];

    for (const algo of algos) {
      const res = runPathfinding(algo, grid, start, goal);
      expect(res).not.toBeNull();
      expect(res.path.length).toBeGreaterThan(0);
      expect(res.path[0]).toEqual(start);
      expect(res.path[res.path.length - 1]).toEqual(goal);
    }
  });

  it('dijkstra favors normal path over mud path', () => {
    // 3 rows, 5 cols
    const grid = createEmptyGrid(3, 5);
    // Row 1 (direct path) is all mud (cost 5)
    for (let c = 0; c < 5; c++) grid[1][c] = 5;
    // Row 0 is cost 1 (normal)
    // Row 2 is cost 1 (normal)
    const start = [1, 0];
    const goal = [1, 4];

    const res = runPathfinding(dijkstra, grid, start, goal);
    expect(res).not.toBeNull();
    // Path should divert through row 0 or 2 to avoid mud
    const usesRow0Or2 = res.path.some((p) => p[0] === 0 || p[0] === 2);
    expect(usesRow0Or2).toBe(true);
  });

  it('generates mazes using all 5 procedural methods', () => {
    const rows = 15;
    const cols = 15;

    const backtracker = generateRecursiveBacktracker(rows, cols);
    expect(backtracker.length).toBe(rows);
    expect(backtracker[1][1]).toBe(1);

    const prim = generatePrimMaze(rows, cols);
    expect(prim.length).toBe(rows);

    const kruskal = generateKruskalMaze(rows, cols);
    expect(kruskal.length).toBe(rows);

    const division = generateRecursiveDivision(rows, cols);
    expect(division[0][0]).toBe(Infinity); // outer boundary is wall

    const terrain = generateRandomTerrain(rows, cols);
    expect(terrain.some((r) => r.some((c) => c === 5))).toBe(true);
  });

  it('has complete metadata and pseudocode for all algorithms', () => {
    for (const [, meta] of Object.entries(PATHFINDING_ALGORITHMS)) {
      expect(meta.name.en).toBeTruthy();
      expect(meta.name.de).toBeTruthy();
      expect(meta.pseudocode.en.length).toBeGreaterThan(0);
      expect(meta.pseudocode.de.length).toBeGreaterThan(0);
    }
  });
});
