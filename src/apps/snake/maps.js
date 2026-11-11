// @ts-check
// 6 Handcrafted maps for Snake Evolution (20x20 grid)

/**
 * @typedef {{ x: number, y: number }} GridPoint
 * @typedef {{ in: GridPoint, out: GridPoint, color: string }} PortalPair
 * @typedef {{ x: number, y: number, vx: number, vy: number, min: number, max: number, horizontal: boolean }} MovingObstacle
 * @typedef {object} SnakeMap
 * @property {string} id
 * @property {string} name
 * @property {boolean} wrap
 * @property {GridPoint[]} walls
 * @property {PortalPair[]} [portals]
 * @property {MovingObstacle[]} [movingObstacles]
 */

/** @type {Record<string, SnakeMap>} */
export const SNAKE_MAPS = {
  classic: {
    id: 'classic',
    name: 'Classic Open',
    wrap: false,
    walls: [],
  },
  walls: {
    id: 'walls',
    name: 'Four Rooms',
    wrap: false,
    walls: [
      // Cross with center gap
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 13, y: 5 },
      { x: 14, y: 5 },
      { x: 15, y: 5 },
      { x: 4, y: 14 },
      { x: 5, y: 14 },
      { x: 6, y: 14 },
      { x: 13, y: 14 },
      { x: 14, y: 14 },
      { x: 15, y: 14 },
      { x: 9, y: 3 },
      { x: 9, y: 4 },
      { x: 9, y: 5 },
      { x: 10, y: 3 },
      { x: 10, y: 4 },
      { x: 10, y: 5 },
      { x: 9, y: 14 },
      { x: 9, y: 15 },
      { x: 9, y: 16 },
      { x: 10, y: 14 },
      { x: 10, y: 15 },
      { x: 10, y: 16 },
    ],
  },
  maze: {
    id: 'maze',
    name: 'Cyber Labyrinth',
    wrap: false,
    walls: [
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 6, y: 3 },
      { x: 7, y: 3 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 3, y: 6 },
      { x: 3, y: 7 },
      { x: 16, y: 3 },
      { x: 15, y: 3 },
      { x: 14, y: 3 },
      { x: 13, y: 3 },
      { x: 12, y: 3 },
      { x: 16, y: 4 },
      { x: 16, y: 5 },
      { x: 16, y: 6 },
      { x: 16, y: 7 },
      { x: 3, y: 12 },
      { x: 3, y: 13 },
      { x: 3, y: 14 },
      { x: 3, y: 15 },
      { x: 3, y: 16 },
      { x: 4, y: 16 },
      { x: 5, y: 16 },
      { x: 6, y: 16 },
      { x: 7, y: 16 },
      { x: 16, y: 12 },
      { x: 16, y: 13 },
      { x: 16, y: 14 },
      { x: 16, y: 15 },
      { x: 16, y: 16 },
      { x: 15, y: 16 },
      { x: 14, y: 16 },
      { x: 13, y: 16 },
      { x: 12, y: 16 },
      { x: 8, y: 9 },
      { x: 9, y: 9 },
      { x: 10, y: 9 },
      { x: 11, y: 9 },
      { x: 8, y: 10 },
      { x: 9, y: 10 },
      { x: 10, y: 10 },
      { x: 11, y: 10 },
    ],
  },
  portals: {
    id: 'portals',
    name: 'Quantum Portals',
    wrap: false,
    walls: [
      { x: 9, y: 2 },
      { x: 10, y: 2 },
      { x: 9, y: 17 },
      { x: 10, y: 17 },
      { x: 2, y: 9 },
      { x: 2, y: 10 },
      { x: 17, y: 9 },
      { x: 17, y: 10 },
    ],
    portals: [
      { in: { x: 3, y: 3 }, out: { x: 16, y: 16 }, color: '#00f0ff' },
      { in: { x: 16, y: 3 }, out: { x: 3, y: 16 }, color: '#ff00aa' },
    ],
  },
  moving: {
    id: 'moving',
    name: 'Hazard Patrol',
    wrap: false,
    walls: [
      { x: 4, y: 9 },
      { x: 5, y: 9 },
      { x: 14, y: 9 },
      { x: 15, y: 9 },
    ],
    movingObstacles: [
      { x: 2, y: 4, vx: 1, vy: 0, min: 2, max: 17, horizontal: true },
      { x: 17, y: 15, vx: -1, vy: 0, min: 2, max: 17, horizontal: true },
      { x: 9, y: 3, vx: 0, vy: 1, min: 3, max: 16, horizontal: false },
    ],
  },
  wrap: {
    id: 'wrap',
    name: 'Torus Drift',
    wrap: true,
    walls: [
      // Central floating diamond
      { x: 9, y: 8 },
      { x: 10, y: 8 },
      { x: 8, y: 9 },
      { x: 11, y: 9 },
      { x: 8, y: 10 },
      { x: 11, y: 10 },
      { x: 9, y: 11 },
      { x: 10, y: 11 },
    ],
  },
};
