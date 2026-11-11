import { describe, it, expect } from 'vitest';
import {
  getNeighbors,
  getBubbleCenter,
  findConnectedCluster,
  findFloatingBubbles,
  calculateTrajectory,
  createLevelGrid,
  BUBBLE_RADIUS,
} from '../../src/apps/bubbles/logic.js';

describe('Bubble Shooter Physics & Hex Grid', () => {
  it('correctly computes 6 hexagonal neighbors for even and odd rows', () => {
    // Even row (r=2, c=2)
    const evenNeighbors = getNeighbors(2, 2);
    expect(evenNeighbors.length).toBe(6);
    expect(evenNeighbors).toContainEqual([1, 1]);
    expect(evenNeighbors).toContainEqual([1, 2]);
    expect(evenNeighbors).toContainEqual([2, 1]);
    expect(evenNeighbors).toContainEqual([2, 3]);

    // Odd row (r=1, c=2)
    const oddNeighbors = getNeighbors(1, 2);
    expect(oddNeighbors.length).toBe(6);
    expect(oddNeighbors).toContainEqual([0, 2]);
    expect(oddNeighbors).toContainEqual([0, 3]);
  });

  it('calculates world coordinates with staggered horizontal offset', () => {
    const c0 = getBubbleCenter(0, 0);
    const c1 = getBubbleCenter(1, 0); // odd row has BUBBLE_RADIUS offset
    expect(c0.x).toBe(BUBBLE_RADIUS);
    expect(c1.x).toBe(BUBBLE_RADIUS * 2);
    expect(c1.y).toBeGreaterThan(c0.y);
  });

  it('detects connected color clusters', () => {
    const grid = new Map();
    grid.set('0,0', { r: 0, c: 0, color: 'red' });
    grid.set('0,1', { r: 0, c: 1, color: 'red' });
    grid.set('1,0', { r: 1, c: 0, color: 'red' });
    grid.set('0,2', { r: 0, c: 2, color: 'blue' });

    const cluster = findConnectedCluster(grid, 0, 0);
    expect(cluster.length).toBe(3);
    expect(cluster.every((b) => b.color === 'red')).toBe(true);
  });

  it('identifies floating bubbles disconnected from ceiling', () => {
    const grid = new Map();
    // Ceiling anchor
    grid.set('0,0', { r: 0, c: 0, color: 'red' });
    // Attached to ceiling
    grid.set('1,0', { r: 1, c: 0, color: 'blue' });

    // Floating island at row 5
    grid.set('5,5', { r: 5, c: 5, color: 'green' });

    const floating = findFloatingBubbles(grid);
    expect(floating.length).toBe(1);
    expect(floating[0].r).toBe(5);
    expect(floating[0].c).toBe(5);
  });

  it('calculates trajectory bouncing off side walls', () => {
    // Shoot up-left towards left wall: angle = -2.5 radians
    const points = calculateTrajectory(160, 440, -2.5, 2);
    expect(points.length).toBeGreaterThan(1);
    // Bounces off left wall
    expect(points[1].x).toBeCloseTo(BUBBLE_RADIUS, 1);
  });

  it('generates playable initial level grids', () => {
    const grid = createLevelGrid(0);
    expect(grid.size).toBeGreaterThan(30);
    expect(grid.has('0,0')).toBe(true);
  });
});
