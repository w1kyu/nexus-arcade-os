// @ts-check

/**
 * Pixel Runner Engine & Physics Simulator
 */

export const TILE_SIZE = 32;
export const LEVEL_COLS = 20;
export const LEVEL_ROWS = 14;

export const TILE = {
  AIR: 0,
  SOLID: 1,
  SPIKE: 2,
  COIN: 3,
  BOUNCER: 4,
  ONEWAY: 5,
  CRUMBLE: 6,
  CHECKPOINT: 7,
  PORTAL: 8,
  KEY: 9,
  DOOR: 10,
};

export const GRAVITY = 1100;
export const MOVE_SPEED = 200;
export const JUMP_VELOCITY = -410;
export const VARIABLE_JUMP_CUT = 0.5;
export const COYOTE_TIME = 0.12;
export const JUMP_BUFFER = 0.12;
export const MAX_FALL = 600;

/**
 * @typedef {object} LevelDef
 * @property {number} id
 * @property {string} name
 * @property {number[]} data 20x14 tile ids
 * @property {{ x: number, y: number }} spawn
 */

/**
 * Built-in 20 Levels
 */
export const BUILTIN_LEVELS = [
  createLevel(
    1,
    'First Steps',
    (grid) => {
      // Floor
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      // Steps
      setBlock(grid, 5, 11, TILE.SOLID);
      setBlock(grid, 6, 11, TILE.SOLID);
      setBlock(grid, 9, 10, TILE.SOLID);
      setBlock(grid, 10, 10, TILE.SOLID);
      setBlock(grid, 13, 9, TILE.SOLID);
      setBlock(grid, 14, 9, TILE.SOLID);
      // Coins
      setBlock(grid, 6, 10, TILE.COIN);
      setBlock(grid, 10, 9, TILE.COIN);
      setBlock(grid, 14, 8, TILE.COIN);
      // Portal
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    2,
    'Leap of Faith',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      // Gap with spikes
      clearBlock(grid, 7, 12);
      clearBlock(grid, 8, 12);
      clearBlock(grid, 9, 12);
      setBlock(grid, 7, 13, TILE.SPIKE);
      setBlock(grid, 8, 13, TILE.SPIKE);
      setBlock(grid, 9, 13, TILE.SPIKE);
      // Platform overhead
      setBlock(grid, 8, 9, TILE.SOLID);
      setBlock(grid, 8, 8, TILE.COIN);
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    3,
    'Spring Fling',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      // Tall wall
      for (let y = 5; y <= 11; y++) setBlock(grid, 8, y, TILE.SOLID);
      // Spring bouncer
      setBlock(grid, 6, 11, TILE.BOUNCER);
      setBlock(grid, 8, 4, TILE.COIN);
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    4,
    'Crumbling Bridges',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      for (let x = 6; x <= 13; x++) {
        clearBlock(grid, x, 13);
        setBlock(grid, x, 13, TILE.SPIKE);
        setBlock(grid, x, 10, TILE.CRUMBLE);
        if (x % 2 === 0) setBlock(grid, x, 9, TILE.COIN);
      }
      fillArea(grid, 0, 11, 5, 12, TILE.SOLID);
      fillArea(grid, 14, 11, 19, 12, TILE.SOLID);
      setBlock(grid, 18, 10, TILE.PORTAL);
    },
    { x: 2, y: 10 },
  ),

  createLevel(
    5,
    'Lock and Key',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      // High platform with Key
      for (let x = 3; x <= 6; x++) setBlock(grid, x, 6, TILE.SOLID);
      setBlock(grid, 4, 5, TILE.KEY);
      setBlock(grid, 4, 11, TILE.BOUNCER);
      // Wall with Door
      for (let y = 4; y <= 11; y++) setBlock(grid, 12, y, TILE.SOLID);
      setBlock(grid, 12, 10, TILE.DOOR);
      setBlock(grid, 12, 11, TILE.DOOR);
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 1, y: 11 },
  ),

  createLevel(
    6,
    'High Wire',
    (grid) => {
      fillRow(grid, 13, TILE.SPIKE);
      // Floating one-way platforms
      for (let x = 2; x <= 17; x += 3) {
        setBlock(grid, x, 10, TILE.ONEWAY);
        setBlock(grid, x + 1, 10, TILE.ONEWAY);
        setBlock(grid, x, 9, TILE.COIN);
      }
      fillArea(grid, 0, 10, 2, 12, TILE.SOLID);
      fillArea(grid, 18, 10, 19, 12, TILE.SOLID);
      setBlock(grid, 18, 9, TILE.PORTAL);
    },
    { x: 1, y: 9 },
  ),

  createLevel(
    7,
    'Spike Gauntlet',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      for (let x = 5; x <= 15; x += 2) {
        setBlock(grid, x, 11, TILE.SPIKE);
        setBlock(grid, x, 8, TILE.SOLID);
        setBlock(grid, x, 7, TILE.COIN);
      }
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    8,
    'Ascension',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      for (let i = 0; i < 5; i++) {
        const px = 4 + (i % 2 === 0 ? 0 : 8);
        const py = 10 - i * 2;
        setBlock(grid, px, py, TILE.SOLID);
        setBlock(grid, px + 1, py, TILE.SOLID);
        setBlock(grid, px, py - 1, TILE.COIN);
      }
      setBlock(grid, 10, 2, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    9,
    'Checkpoint Sanctuary',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 12, TILE.SOLID);
      // Mid checkpoint
      setBlock(grid, 10, 11, TILE.CHECKPOINT);
      // Danger after checkpoint
      clearBlock(grid, 13, 12);
      clearBlock(grid, 14, 12);
      setBlock(grid, 13, 13, TILE.SPIKE);
      setBlock(grid, 14, 13, TILE.SPIKE);
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    10,
    'Chamber of Bounce',
    (grid) => {
      fillRow(grid, 13, TILE.SPIKE);
      setBlock(grid, 1, 12, TILE.SOLID);
      setBlock(grid, 2, 12, TILE.SOLID);
      setBlock(grid, 5, 12, TILE.BOUNCER);
      setBlock(grid, 9, 8, TILE.BOUNCER);
      setBlock(grid, 13, 5, TILE.BOUNCER);
      setBlock(grid, 18, 4, TILE.SOLID);
      setBlock(grid, 18, 3, TILE.PORTAL);
    },
    { x: 1, y: 11 },
  ),

  createLevel(
    11,
    'Precision Falls',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      for (let x = 4; x <= 16; x++) {
        if (x % 3 === 0) setBlock(grid, x, 12, TILE.SPIKE);
        else setBlock(grid, x, 12, TILE.SOLID);
      }
      setBlock(grid, 18, 11, TILE.PORTAL);
    },
    { x: 1, y: 11 },
  ),

  createLevel(
    12,
    'The Vault',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillArea(grid, 0, 12, 19, 12, TILE.SOLID);
      // Vault enclosure
      for (let y = 4; y <= 11; y++) setBlock(grid, 14, y, TILE.SOLID);
      setBlock(grid, 14, 10, TILE.DOOR);
      setBlock(grid, 14, 11, TILE.DOOR);
      setBlock(grid, 7, 5, TILE.KEY);
      setBlock(grid, 7, 6, TILE.SOLID);
      setBlock(grid, 17, 11, TILE.PORTAL);
    },
    { x: 2, y: 11 },
  ),

  createLevel(
    13,
    'Double Decker',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 7, TILE.SOLID);
      setBlock(grid, 18, 6, TILE.PORTAL);
      setBlock(grid, 10, 12, TILE.BOUNCER);
      setBlock(grid, 10, 6, TILE.SPIKE);
    },
    { x: 2, y: 12 },
  ),

  createLevel(
    14,
    'Spike Roof',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      fillRow(grid, 5, TILE.SPIKE);
      for (let x = 5; x <= 15; x += 3) {
        setBlock(grid, x, 10, TILE.CRUMBLE);
        setBlock(grid, x, 9, TILE.COIN);
      }
      setBlock(grid, 18, 12, TILE.PORTAL);
    },
    { x: 1, y: 12 },
  ),

  createLevel(
    15,
    'Tower Climber',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      for (let y = 11; y >= 2; y -= 2) {
        const x = y % 4 === 0 ? 5 : 12;
        setBlock(grid, x, y, TILE.ONEWAY);
        setBlock(grid, x + 1, y, TILE.ONEWAY);
        setBlock(grid, x, y - 1, TILE.COIN);
      }
      setBlock(grid, 9, 2, TILE.PORTAL);
    },
    { x: 2, y: 12 },
  ),

  createLevel(
    16,
    'Crumble Highway',
    (grid) => {
      fillRow(grid, 13, TILE.SPIKE);
      for (let x = 2; x <= 17; x++) {
        setBlock(grid, x, 10, TILE.CRUMBLE);
      }
      setBlock(grid, 18, 9, TILE.PORTAL);
    },
    { x: 1, y: 9 },
  ),

  createLevel(
    17,
    'Obstacle Course',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      setBlock(grid, 4, 12, TILE.SPIKE);
      setBlock(grid, 7, 12, TILE.BOUNCER);
      setBlock(grid, 10, 7, TILE.SOLID);
      setBlock(grid, 13, 12, TILE.SPIKE);
      setBlock(grid, 18, 12, TILE.PORTAL);
    },
    { x: 1, y: 12 },
  ),

  createLevel(
    18,
    'Trapdoor Fortress',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      for (let y = 4; y <= 11; y++) setBlock(grid, 9, y, TILE.SOLID);
      setBlock(grid, 9, 10, TILE.DOOR);
      setBlock(grid, 9, 11, TILE.DOOR);
      setBlock(grid, 3, 4, TILE.KEY);
      setBlock(grid, 3, 5, TILE.SOLID);
      setBlock(grid, 17, 12, TILE.PORTAL);
    },
    { x: 1, y: 12 },
  ),

  createLevel(
    19,
    'Skyward Springs',
    (grid) => {
      fillRow(grid, 13, TILE.SPIKE);
      setBlock(grid, 1, 11, TILE.SOLID);
      setBlock(grid, 4, 11, TILE.BOUNCER);
      setBlock(grid, 8, 8, TILE.BOUNCER);
      setBlock(grid, 12, 5, TILE.BOUNCER);
      setBlock(grid, 17, 3, TILE.SOLID);
      setBlock(grid, 17, 2, TILE.PORTAL);
    },
    { x: 1, y: 10 },
  ),

  createLevel(
    20,
    'Final Gauntlet',
    (grid) => {
      fillRow(grid, 13, TILE.SOLID);
      for (let x = 4; x <= 16; x += 3) {
        setBlock(grid, x, 12, TILE.SPIKE);
        setBlock(grid, x + 1, 10, TILE.CRUMBLE);
      }
      setBlock(grid, 8, 6, TILE.KEY);
      setBlock(grid, 8, 7, TILE.SOLID);
      setBlock(grid, 15, 12, TILE.DOOR);
      setBlock(grid, 18, 12, TILE.PORTAL);
    },
    { x: 1, y: 12 },
  ),
];

// Helper functions for level builder
function createLevel(id, name, builder, spawn) {
  const grid = new Array(LEVEL_COLS * LEVEL_ROWS).fill(TILE.AIR);
  builder(grid);
  return { id, name, data: grid, spawn };
}

function setBlock(grid, x, y, tile) {
  if (x >= 0 && x < LEVEL_COLS && y >= 0 && y < LEVEL_ROWS) {
    grid[y * LEVEL_COLS + x] = tile;
  }
}

function clearBlock(grid, x, y) {
  setBlock(grid, x, y, TILE.AIR);
}

function fillRow(grid, y, tile) {
  for (let x = 0; x < LEVEL_COLS; x++) setBlock(grid, x, y, tile);
}

function fillArea(grid, x1, y1, x2, y2, tile) {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      setBlock(grid, x, y, tile);
    }
  }
}

/**
 * @typedef {object} PlayerState
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} width
 * @property {number} height
 * @property {boolean} grounded
 * @property {number} coyoteTimer
 * @property {number} jumpBufferTimer
 * @property {boolean} facingLeft
 * @property {boolean} hasKey
 * @property {number} coins
 * @property {boolean} dead
 * @property {boolean} finished
 * @property {{ x: number, y: number }} checkpoint
 */

/**
 * Creates initial runner state
 * @param {number} [levelIndex=0]
 */
export function createRunnerState(levelIndex = 0) {
  const level = BUILTIN_LEVELS[levelIndex] || BUILTIN_LEVELS[0];
  const grid = [...level.data];
  const spawnX = level.spawn.x * TILE_SIZE + 6;
  const spawnY = level.spawn.y * TILE_SIZE;

  /** @type {PlayerState} */
  const player = {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    width: 20,
    height: 28,
    grounded: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    facingLeft: false,
    hasKey: false,
    coins: 0,
    dead: false,
    finished: false,
    checkpoint: { x: spawnX, y: spawnY },
  };

  /** Crumbling blocks tracking: index -> timer */
  const crumbling = new Map();

  return {
    levelIndex,
    level,
    grid,
    player,
    crumbling,
    totalCoins: countTiles(grid, TILE.COIN),
    time: 0,
    deaths: 0,
  };
}

function countTiles(grid, tileType) {
  return grid.filter((t) => t === tileType).length;
}

/**
 * Steps the physics simulation
 * @param {ReturnType<typeof createRunnerState>} state
 * @param {number} dt
 * @param {{ left: boolean, right: boolean, jump: boolean, jumpPressed: boolean }} input
 */
export function stepRunner(state, dt, input) {
  if (state.player.dead || state.player.finished) return;

  const p = state.player;
  state.time += dt;

  // 1. Horizontal movement
  if (input.left) {
    p.vx = -MOVE_SPEED;
    p.facingLeft = true;
  } else if (input.right) {
    p.vx = MOVE_SPEED;
    p.facingLeft = false;
  } else {
    p.vx = 0;
  }

  // 2. Timers
  if (p.grounded) {
    p.coyoteTimer = COYOTE_TIME;
  } else {
    p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
  }

  if (input.jumpPressed) {
    p.jumpBufferTimer = JUMP_BUFFER;
  } else {
    p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
  }

  // 3. Jump logic
  if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0) {
    p.vy = JUMP_VELOCITY;
    p.grounded = false;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
  }

  // Variable jump height (releasing jump early reduces upward boost)
  if (!input.jump && p.vy < 0) {
    p.vy *= 1 - VARIABLE_JUMP_CUT * (dt * 30);
  }

  // 4. Gravity
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);

  // 5. Physics integration with tile collision
  p.grounded = false;

  // Move X
  p.x += p.vx * dt;
  handleHorizontalCollisions(state, p);

  // Move Y
  p.y += p.vy * dt;
  handleVerticalCollisions(state, p);

  // Update crumbling blocks
  for (const [idx, timer] of state.crumbling.entries()) {
    const newTimer = timer - dt;
    if (newTimer <= 0) {
      state.grid[idx] = TILE.AIR;
      state.crumbling.delete(idx);
    } else {
      state.crumbling.set(idx, newTimer);
    }
  }

  // Out of bounds check
  if (p.y > LEVEL_ROWS * TILE_SIZE + 32) {
    killPlayer(state);
  }
}

function handleHorizontalCollisions(state, p) {
  const leftTile = Math.floor(p.x / TILE_SIZE);
  const rightTile = Math.floor((p.x + p.width - 1) / TILE_SIZE);
  const topTile = Math.floor(p.y / TILE_SIZE);
  const bottomTile = Math.floor((p.y + p.height - 1) / TILE_SIZE);

  for (let ty = topTile; ty <= bottomTile; ty++) {
    for (let tx = leftTile; tx <= rightTile; tx++) {
      const idx = ty * LEVEL_COLS + tx;
      const tile = state.grid[idx];

      if (tile === TILE.SOLID || (tile === TILE.DOOR && !p.hasKey)) {
        if (p.vx > 0) {
          p.x = tx * TILE_SIZE - p.width;
          p.vx = 0;
        } else if (p.vx < 0) {
          p.x = (tx + 1) * TILE_SIZE;
          p.vx = 0;
        }
      } else if (tile === TILE.DOOR && p.hasKey) {
        state.grid[idx] = TILE.AIR; // unlock
      }
      interactWithTile(state, tx, ty, tile);
    }
  }
}

function handleVerticalCollisions(state, p) {
  const leftTile = Math.floor(p.x / TILE_SIZE);
  const rightTile = Math.floor((p.x + p.width - 1) / TILE_SIZE);
  const topTile = Math.floor(p.y / TILE_SIZE);
  const bottomTile = Math.floor((p.y + p.height - 1) / TILE_SIZE);

  for (let ty = topTile; ty <= bottomTile; ty++) {
    for (let tx = leftTile; tx <= rightTile; tx++) {
      const idx = ty * LEVEL_COLS + tx;
      const tile = state.grid[idx];

      if (tile === TILE.SOLID || tile === TILE.CRUMBLE || (tile === TILE.DOOR && !p.hasKey)) {
        if (p.vy > 0) {
          p.y = ty * TILE_SIZE - p.height;
          p.grounded = true;
          if (p.jumpBufferTimer > 0) {
            p.vy = JUMP_VELOCITY;
            p.grounded = false;
            p.jumpBufferTimer = 0;
            p.coyoteTimer = 0;
          } else {
            p.vy = 0;
          }
          if (tile === TILE.CRUMBLE && !state.crumbling.has(idx)) {
            state.crumbling.set(idx, 0.45); // breaks in 0.45s
          }
        } else if (p.vy < 0) {
          p.y = (ty + 1) * TILE_SIZE;
          p.vy = 0;
        }
      } else if (tile === TILE.ONEWAY && p.vy > 0) {
        const prevBottom = p.y + p.height - p.vy * 0.05;
        if (prevBottom <= ty * TILE_SIZE + 4) {
          p.y = ty * TILE_SIZE - p.height;
          p.vy = 0;
          p.grounded = true;
        }
      } else if (tile === TILE.BOUNCER) {
        p.vy = JUMP_VELOCITY * 1.45; // Super spring bounce
        p.grounded = false;
      }
      interactWithTile(state, tx, ty, tile);
    }
  }
}

function interactWithTile(state, tx, ty, tile) {
  const p = state.player;
  const idx = ty * LEVEL_COLS + tx;

  if (tile === TILE.SPIKE) {
    killPlayer(state);
  } else if (tile === TILE.COIN) {
    state.grid[idx] = TILE.AIR;
    p.coins++;
  } else if (tile === TILE.KEY) {
    state.grid[idx] = TILE.AIR;
    p.hasKey = true;
  } else if (tile === TILE.CHECKPOINT) {
    p.checkpoint = { x: tx * TILE_SIZE, y: (ty - 1) * TILE_SIZE };
  } else if (tile === TILE.PORTAL) {
    p.finished = true;
  }
}

function killPlayer(state) {
  if (!state.player.dead) {
    state.player.dead = true;
    state.deaths++;
  }
}

export function respawnPlayer(state) {
  state.player.x = state.player.checkpoint.x;
  state.player.y = state.player.checkpoint.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.dead = false;
}
