// @ts-check

/**
 * Bubble Shooter Hexagonal Grid & Bank-Shot Physics Engine
 */

export const BUBBLE_RADIUS = 16;
export const GRID_COLS = 10;
export const GRID_ROWS = 14;
export const ARENA_W = GRID_COLS * BUBBLE_RADIUS * 2; // 320
export const ARENA_H = 480;

export const BUBBLE_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4'];

/**
 * @typedef {object} Bubble
 * @property {number} r Row
 * @property {number} c Col
 * @property {string} color
 */

/**
 * Hex grid neighbor offsets:
 * In staggered grid: even rows have no offset, odd rows are shifted right by BUBBLE_RADIUS.
 */
export function getNeighbors(r, c) {
  const isOdd = r % 2 === 1;
  const deltas = isOdd
    ? [
        [-1, 0], // top-left
        [-1, 1], // top-right
        [0, -1], // left
        [0, 1], // right
        [1, 0], // bottom-left
        [1, 1], // bottom-right
      ]
    : [
        [-1, -1], // top-left
        [-1, 0], // top-right
        [0, -1], // left
        [0, 1], // right
        [1, -1], // bottom-left
        [1, 0], // bottom-right
      ];

  /** @type {[number, number][]} */
  const neighbors = [];
  for (const [dr, dc] of deltas) {
    const nr = r + dr;
    const nc = c + dc;
    const maxCols = nr % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
    if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < maxCols) {
      neighbors.push([nr, nc]);
    }
  }
  return neighbors;
}

/**
 * Calculates world (x, y) coordinates for grid cell (r, c)
 * @param {number} r
 * @param {number} c
 */
export function getBubbleCenter(r, c) {
  const isOdd = r % 2 === 1;
  const x = c * (BUBBLE_RADIUS * 2) + BUBBLE_RADIUS + (isOdd ? BUBBLE_RADIUS : 0);
  const y = r * (BUBBLE_RADIUS * 1.732) + BUBBLE_RADIUS; // sqrt(3) ~= 1.732
  return { x, y };
}

/**
 * Finds all connected bubbles of the same color
 * @param {Map<string, Bubble>} grid
 * @param {number} startR
 * @param {number} startC
 */
export function findConnectedCluster(grid, startR, startC) {
  const key = `${startR},${startC}`;
  const start = grid.get(key);
  if (!start) return [];

  const visited = new Set([key]);
  const cluster = [start];
  const queue = [[startR, startC]];

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [nr, nc] of getNeighbors(r, c)) {
      const nKey = `${nr},${nc}`;
      if (!visited.has(nKey) && grid.has(nKey)) {
        const neighbor = grid.get(nKey);
        if (neighbor && neighbor.color === start.color) {
          visited.add(nKey);
          cluster.push(neighbor);
          queue.push([nr, nc]);
        }
      }
    }
  }

  return cluster;
}

/**
 * Finds all floating/disconnected bubbles not anchored to ceiling (r=0)
 * @param {Map<string, Bubble>} grid
 */
export function findFloatingBubbles(grid) {
  const anchored = new Set();
  const queue = [];

  // Anchor all top row bubbles
  for (const [key, bubble] of grid.entries()) {
    if (bubble.r === 0) {
      anchored.add(key);
      queue.push([bubble.r, bubble.c]);
    }
  }

  // Flood fill from ceiling
  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [nr, nc] of getNeighbors(r, c)) {
      const nKey = `${nr},${nc}`;
      if (!anchored.has(nKey) && grid.has(nKey)) {
        anchored.add(nKey);
        queue.push([nr, nc]);
      }
    }
  }

  // Any bubble not anchored is floating!
  const floating = [];
  for (const [key, bubble] of grid.entries()) {
    if (!anchored.has(key)) {
      floating.push(bubble);
    }
  }

  return floating;
}

/**
 * Calculates bank-shot trajectory points with wall bounces
 * @param {number} startX
 * @param {number} startY
 * @param {number} angle in radians
 * @param {number} maxBounces
 */
export function calculateTrajectory(startX, startY, angle, maxBounces = 2) {
  let cx = startX;
  let cy = startY;
  let vx = Math.cos(angle);
  let vy = Math.sin(angle);
  const points = [{ x: cx, y: cy }];

  for (let b = 0; b <= maxBounces; b++) {
    // If vy is pointing down or horizontal, stop
    if (vy >= 0) break;

    // Distance to side wall
    const targetWallX = vx > 0 ? ARENA_W - BUBBLE_RADIUS : BUBBLE_RADIUS;
    const timeToWall = vx !== 0 ? (targetWallX - cx) / vx : Infinity;
    const timeToCeiling = (BUBBLE_RADIUS - cy) / vy;

    if (timeToWall > 0 && timeToWall < timeToCeiling) {
      // Bounces off side wall
      cx += vx * timeToWall;
      cy += vy * timeToWall;
      points.push({ x: cx, y: cy });
      vx = -vx; // reflect
    } else {
      // Reaches ceiling
      cx += vx * timeToCeiling;
      cy += vy * timeToCeiling;
      points.push({ x: cx, y: cy });
      break;
    }
  }

  return points;
}

/**
 * Creates level bubble arrangement
 * @param {number} levelIndex
 */
export function createLevelGrid(levelIndex = 0) {
  /** @type {Map<string, Bubble>} */
  const grid = new Map();
  const numRows = Math.min(6 + levelIndex, 9);
  const colors = BUBBLE_COLORS.slice(0, Math.min(4 + Math.floor(levelIndex / 2), 6));

  for (let r = 0; r < numRows; r++) {
    const maxCols = r % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
    for (let c = 0; c < maxCols; c++) {
      const color = colors[(r + c) % colors.length];
      grid.set(`${r},${c}`, { r, c, color });
    }
  }

  return grid;
}
