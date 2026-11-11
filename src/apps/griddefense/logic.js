// @ts-check

/**
 * Grid Defense Logic & Simulation Engine
 */

export const GRID_COLS = 16;
export const GRID_ROWS = 12;
export const CELL_SIZE = 40; // 640 x 480 virtual resolution

/**
 * @typedef {object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} MapDef
 * @property {string} id
 * @property {string} name
 * @property {Point[][]} paths Array of waypoint paths (in grid coordinates)
 * @property {number[][]} [obstacles] Array of [gx, gy] obstacle tiles
 */

export const MAPS = [
  {
    id: 'circuit',
    name: 'Circuit Cross',
    paths: [
      [
        { x: 0, y: 3 },
        { x: 5, y: 3 },
        { x: 5, y: 9 },
        { x: 10, y: 9 },
        { x: 10, y: 2 },
        { x: 15, y: 2 },
      ],
    ],
    obstacles: [
      [3, 1],
      [3, 2],
      [7, 7],
      [8, 7],
    ],
  },
  {
    id: 'highway',
    name: 'Neon Highway',
    paths: [
      [
        { x: 0, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 2 },
        { x: 11, y: 2 },
        { x: 11, y: 8 },
        { x: 15, y: 8 },
      ],
    ],
    obstacles: [
      [2, 4],
      [8, 5],
      [9, 5],
    ],
  },
  {
    id: 'binary_fork',
    name: 'Binary Fork',
    paths: [
      [
        { x: 0, y: 6 },
        { x: 4, y: 6 },
        { x: 7, y: 2 },
        { x: 12, y: 2 },
        { x: 15, y: 5 },
      ],
      [
        { x: 0, y: 6 },
        { x: 4, y: 6 },
        { x: 7, y: 9 },
        { x: 12, y: 9 },
        { x: 15, y: 5 },
      ],
    ],
    obstacles: [
      [7, 5],
      [7, 6],
      [8, 5],
      [8, 6],
    ],
  },
  {
    id: 'spiral',
    name: 'Quantum Spiral',
    paths: [
      [
        { x: 0, y: 1 },
        { x: 14, y: 1 },
        { x: 14, y: 10 },
        { x: 2, y: 10 },
        { x: 2, y: 4 },
        { x: 11, y: 4 },
        { x: 11, y: 7 },
        { x: 6, y: 7 },
      ],
    ],
    obstacles: [
      [5, 2],
      [8, 9],
    ],
  },
  {
    id: 'zigzag',
    name: 'Cyber Zigzag',
    paths: [
      [
        { x: 0, y: 2 },
        { x: 13, y: 2 },
        { x: 13, y: 5 },
        { x: 2, y: 5 },
        { x: 2, y: 8 },
        { x: 13, y: 8 },
        { x: 13, y: 11 },
        { x: 15, y: 11 },
      ],
    ],
    obstacles: [
      [6, 0],
      [9, 6],
    ],
  },
  {
    id: 'double_trouble',
    name: 'Double Trouble',
    paths: [
      [
        { x: 0, y: 2 },
        { x: 7, y: 2 },
        { x: 7, y: 5 },
        { x: 15, y: 5 },
      ],
      [
        { x: 0, y: 9 },
        { x: 7, y: 9 },
        { x: 7, y: 6 },
        { x: 15, y: 6 },
      ],
    ],
    obstacles: [
      [3, 5],
      [11, 2],
      [11, 9],
    ],
  },
  {
    id: 'labyrinth',
    name: 'The Labyrinth',
    paths: [
      [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 7 },
        { x: 8, y: 7 },
        { x: 8, y: 2 },
        { x: 12, y: 2 },
        { x: 12, y: 10 },
        { x: 15, y: 10 },
      ],
    ],
    obstacles: [
      [2, 3],
      [6, 4],
      [10, 5],
    ],
  },
  {
    id: 'perimeter',
    name: 'Perimeter Patrol',
    paths: [
      [
        { x: 1, y: 0 },
        { x: 1, y: 10 },
        { x: 14, y: 10 },
        { x: 14, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 6 },
        { x: 10, y: 6 },
      ],
    ],
    obstacles: [
      [4, 4],
      [8, 3],
    ],
  },
  {
    id: 'convergence',
    name: 'Core Convergence',
    paths: [
      [
        { x: 0, y: 1 },
        { x: 6, y: 1 },
        { x: 8, y: 5 },
        { x: 15, y: 5 },
      ],
      [
        { x: 0, y: 10 },
        { x: 6, y: 10 },
        { x: 8, y: 6 },
        { x: 15, y: 6 },
      ],
    ],
    obstacles: [
      [3, 5],
      [3, 6],
      [12, 2],
      [12, 9],
    ],
  },
  {
    id: 'death_valley',
    name: 'Death Valley',
    paths: [
      [
        { x: 0, y: 4 },
        { x: 5, y: 4 },
        { x: 5, y: 1 },
        { x: 10, y: 1 },
        { x: 10, y: 9 },
        { x: 15, y: 9 },
      ],
    ],
    obstacles: [
      [2, 8],
      [8, 5],
      [13, 3],
    ],
  },
  {
    id: 'omega',
    name: 'Omega Nexus',
    paths: [
      [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 4 },
        { x: 2, y: 4 },
        { x: 2, y: 8 },
        { x: 13, y: 8 },
        { x: 13, y: 3 },
        { x: 15, y: 3 },
      ],
    ],
    obstacles: [
      [5, 2],
      [10, 6],
    ],
  },
];

/**
 * Tower Types Configuration
 */
export const TOWER_TYPES = {
  pulse: {
    id: 'pulse',
    name: 'Pulse Blaster',
    cost: 100,
    range: 120,
    fireRate: 2.2, // attacks per second
    damage: 22,
    color: '#00f0ff',
    icon: '⚡',
    projectileSpeed: 500,
    upgradeMultiplier: 1.6,
  },
  plasma: {
    id: 'plasma',
    name: 'Plasma Mortar',
    cost: 175,
    range: 150,
    fireRate: 0.8,
    damage: 55,
    splashRadius: 65,
    color: '#ff0055',
    icon: '💥',
    projectileSpeed: 300,
    upgradeMultiplier: 1.7,
  },
  frost: {
    id: 'frost',
    name: 'Frost Emitter',
    cost: 125,
    range: 105,
    fireRate: 1.5,
    damage: 8,
    slowFactor: 0.45, // reduces creep speed to 45%
    slowDuration: 2.5,
    color: '#00ffff',
    icon: '❄️',
    projectileSpeed: 400,
    upgradeMultiplier: 1.5,
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Coil',
    cost: 200,
    range: 110,
    fireRate: 1.2,
    damage: 38,
    chainCount: 3,
    color: '#a855f7',
    icon: '⚡',
    instant: true,
    upgradeMultiplier: 1.65,
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun Sniper',
    cost: 250,
    range: 220,
    fireRate: 0.5,
    damage: 130,
    armorPiercing: true,
    color: '#eab308',
    icon: '🎯',
    instant: true,
    upgradeMultiplier: 1.75,
  },
  disruptor: {
    id: 'disruptor',
    name: 'Void Disruptor',
    cost: 220,
    range: 95,
    fireRate: 2.0,
    damage: 15,
    dotDuration: 3.0,
    color: '#ec4899',
    icon: '🌀',
    instant: true,
    upgradeMultiplier: 1.6,
  },
};

/**
 * Creep Varieties
 */
export const CREEP_TYPES = {
  scout: {
    id: 'scout',
    name: 'Scout',
    baseHp: 65,
    speed: 90,
    bounty: 12,
    score: 50,
    color: '#38bdf8',
    size: 10,
  },
  runner: {
    id: 'runner',
    name: 'Speedster',
    baseHp: 45,
    speed: 135,
    bounty: 14,
    score: 65,
    color: '#facc15',
    size: 8,
  },
  tank: {
    id: 'tank',
    name: 'Armored Tank',
    baseHp: 240,
    speed: 50,
    armor: 0.35, // 35% damage reduction from non-AP
    bounty: 28,
    score: 120,
    color: '#f97316',
    size: 14,
  },
  regen: {
    id: 'regen',
    name: 'Regenerator',
    baseHp: 160,
    speed: 65,
    regenRate: 18, // hp/sec
    bounty: 24,
    score: 100,
    color: '#4ade80',
    size: 11,
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded Carrier',
    baseHp: 190,
    shieldHp: 90,
    speed: 70,
    bounty: 32,
    score: 140,
    color: '#c084fc',
    size: 13,
  },
  boss: {
    id: 'boss',
    name: 'Boss Colossus',
    baseHp: 1200,
    speed: 40,
    armor: 0.25,
    bounty: 150,
    score: 800,
    color: '#ef4444',
    size: 20,
    isBoss: true,
  },
};

/**
 * Creates wave definitions for a map
 * @param {number} totalWaves
 */
export function generateWaves(totalWaves = 20) {
  const waves = [];
  for (let w = 1; w <= totalWaves; w++) {
    const scale = 1 + (w - 1) * 0.22;
    const isBossWave = w % 5 === 0;
    /** @type {{ type: keyof typeof CREEP_TYPES, count: number, interval: number, hpScale: number }[]} */
    const groups = [];

    if (isBossWave) {
      groups.push({ type: 'boss', count: Math.floor(w / 5), interval: 4.0, hpScale: scale });
      groups.push({ type: 'runner', count: 6 + w, interval: 0.6, hpScale: scale });
    } else if (w <= 3) {
      groups.push({ type: 'scout', count: 6 + w * 2, interval: 0.9, hpScale: scale });
    } else if (w <= 7) {
      groups.push({ type: 'scout', count: 6 + w, interval: 0.8, hpScale: scale });
      groups.push({ type: 'runner', count: 4 + w, interval: 0.6, hpScale: scale });
      if (w >= 5) groups.push({ type: 'tank', count: 2 + Math.floor(w / 2), interval: 1.5, hpScale: scale });
    } else if (w <= 12) {
      groups.push({ type: 'scout', count: 8, interval: 0.5, hpScale: scale });
      groups.push({ type: 'regen', count: 4 + Math.floor(w / 2), interval: 1.2, hpScale: scale });
      groups.push({ type: 'tank', count: 4 + Math.floor(w / 2), interval: 1.2, hpScale: scale });
      groups.push({ type: 'shielded', count: 3 + Math.floor(w / 3), interval: 1.4, hpScale: scale });
    } else {
      groups.push({ type: 'runner', count: 10 + w, interval: 0.4, hpScale: scale });
      groups.push({ type: 'shielded', count: 6 + Math.floor(w / 2), interval: 1.0, hpScale: scale });
      groups.push({ type: 'tank', count: 6 + Math.floor(w / 2), interval: 1.1, hpScale: scale });
      groups.push({ type: 'regen', count: 6 + Math.floor(w / 2), interval: 1.0, hpScale: scale });
    }
    waves.push({ waveNumber: w, groups });
  }
  return waves;
}

/**
 * Checks if a grid tile is occupied by road path
 * @param {MapDef} mapDef
 * @param {number} gx
 * @param {number} gy
 */
export function isRoadTile(mapDef, gx, gy) {
  for (const path of mapDef.paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (gx >= minX && gx <= maxX && gy >= minY && gy <= maxY) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a tile is an obstacle
 * @param {MapDef} mapDef
 * @param {number} gx
 * @param {number} gy
 */
export function isObstacleTile(mapDef, gx, gy) {
  if (!mapDef.obstacles) return false;
  return mapDef.obstacles.some(([ox, oy]) => ox === gx && oy === gy);
}

/**
 * @typedef {object} Tower
 * @property {string} type
 * @property {number} gx
 * @property {number} gy
 * @property {number} x
 * @property {number} y
 * @property {number} level 1, 2, or 3
 * @property {number} range
 * @property {number} damage
 * @property {number} fireRate
 * @property {number} cooldown
 * @property {number} totalInvested
 * @property {number} targetMode 'first' | 'last' | 'strong' | 'weak'
 * @property {number} kills
 * @property {number} totalDamageDealt
 */

/**
 * @typedef {object} Creep
 * @property {number} id
 * @property {string} type
 * @property {number} pathIndex
 * @property {number} waypointIndex
 * @property {number} x
 * @property {number} y
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} shieldHp
 * @property {number} maxShieldHp
 * @property {number} speed
 * @property {number} baseSpeed
 * @property {number} slowTimer
 * @property {number} dotTimer
 * @property {number} dotDamage
 * @property {number} regenTimer
 * @property {number} distanceTraveled
 * @property {number} bounty
 * @property {number} score
 * @property {boolean} isBoss
 */

/**
 * @typedef {object} Projectile
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} targetCreepId
 * @property {number} targetX
 * @property {number} targetY
 * @property {number} speed
 * @property {number} damage
 * @property {number} [splashRadius]
 * @property {number} [slowFactor]
 * @property {number} [slowDuration]
 * @property {boolean} [armorPiercing]
 * @property {string} color
 */

/**
 * Creates initial game state
 * @param {number} mapIndex
 * @param {number} [initialCredits=450]
 * @param {number} [initialLives=20]
 */
export function createGameState(mapIndex = 0, initialCredits = 450, initialLives = 20) {
  const mapDef = MAPS[mapIndex] || MAPS[0];
  const waves = generateWaves(20);

  return {
    mapIndex,
    mapDef,
    credits: initialCredits,
    lives: initialLives,
    score: 0,
    waveIndex: 0,
    totalWaves: waves.length,
    waves,
    waveInProgress: false,
    waveClearBonusAwarded: false,
    gameOver: false,
    won: false,
    speedMultiplier: 1, // 1, 2, or 4
    /** @type {Tower[]} */
    towers: [],
    /** @type {Creep[]} */
    creeps: [],
    /** @type {Projectile[]} */
    projectiles: [],
    /** Visual laser/beam events for renderer */
    /** @type {{ x1: number, y1: number, x2: number, y2: number, color: string, time: number }[]} */
    beamEvents: [],
    /** Explosion / burst events */
    /** @type {{ x: number, y: number, radius: number, color: string, time: number }[]} */
    burstEvents: [],
    spawnQueue: /** @type {{ type: keyof typeof CREEP_TYPES, pathIndex: number, hpScale: number }[]} */ ([]),
    spawnTimer: 0,
    spawnInterval: 1.0,
    nextEntityId: 1,
    selectedTowerIndex: -1,
  };
}

/**
 * Tests if tower can be placed
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} gx
 * @param {number} gy
 * @param {string} towerType
 */
export function canPlaceTower(state, gx, gy, towerType) {
  if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return false;
  const tDef = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (towerType)];
  if (!tDef) return false;
  if (state.credits < tDef.cost) return false;
  if (isRoadTile(state.mapDef, gx, gy)) return false;
  if (isObstacleTile(state.mapDef, gx, gy)) return false;
  if (state.towers.some((t) => t.gx === gx && t.gy === gy)) return false;
  return true;
}

/**
 * Places a tower
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} gx
 * @param {number} gy
 * @param {string} towerType
 */
export function placeTower(state, gx, gy, towerType) {
  if (!canPlaceTower(state, gx, gy, towerType)) return null;
  const def = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (towerType)];
  state.credits -= def.cost;

  /** @type {Tower} */
  const tower = {
    type: towerType,
    gx,
    gy,
    x: gx * CELL_SIZE + CELL_SIZE / 2,
    y: gy * CELL_SIZE + CELL_SIZE / 2,
    level: 1,
    range: def.range,
    damage: def.damage,
    fireRate: def.fireRate,
    cooldown: 0,
    totalInvested: def.cost,
    targetMode: 0, // 0 = first, 1 = last, 2 = strong, 3 = weak
    kills: 0,
    totalDamageDealt: 0,
  };

  state.towers.push(tower);
  state.selectedTowerIndex = state.towers.length - 1;
  return tower;
}

/**
 * Cost to upgrade a tower to next level
 * @param {Tower} tower
 */
export function getUpgradeCost(tower) {
  if (tower.level >= 3) return Infinity;
  const def = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (tower.type)];
  return Math.round(def.cost * Math.pow(def.upgradeMultiplier, tower.level));
}

/**
 * Upgrade a tower
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} towerIndex
 */
export function upgradeTower(state, towerIndex) {
  const tower = state.towers[towerIndex];
  if (!tower || tower.level >= 3) return false;
  const cost = getUpgradeCost(tower);
  if (state.credits < cost) return false;

  state.credits -= cost;
  tower.level++;
  tower.totalInvested += cost;
  tower.damage = Math.round(tower.damage * 1.55);
  tower.range = Math.round(tower.range * 1.15);
  tower.fireRate = Number((tower.fireRate * 1.12).toFixed(2));
  return true;
}

/**
 * Sell a tower for 70% of invested cost
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} towerIndex
 */
export function sellTower(state, towerIndex) {
  const tower = state.towers[towerIndex];
  if (!tower) return 0;
  const refund = Math.floor(tower.totalInvested * 0.7);
  state.credits += refund;
  state.towers.splice(towerIndex, 1);
  state.selectedTowerIndex = -1;
  return refund;
}

/**
 * Starts the next wave
 * @param {ReturnType<typeof createGameState>} state
 */
export function startNextWave(state) {
  if (state.waveInProgress || state.gameOver) return false;
  if (state.waveIndex >= state.totalWaves) return false;

  const wave = state.waves[state.waveIndex];
  state.waveIndex++;
  state.waveInProgress = true;
  state.waveClearBonusAwarded = false;

  const queue = [];
  const numPaths = state.mapDef.paths.length;
  let pathOffset = 0;

  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      queue.push({
        type: group.type,
        pathIndex: pathOffset % numPaths,
        hpScale: group.hpScale,
      });
      pathOffset++;
    }
  }

  state.spawnQueue = queue;
  state.spawnTimer = 0;
  state.spawnInterval = 0.75;
  return true;
}

/**
 * Advances the simulation by dt seconds
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} dt
 */
export function stepSimulation(state, dt) {
  if (state.gameOver) return;

  const simDt = dt * state.speedMultiplier;

  // Clear transient visual events
  state.beamEvents = state.beamEvents.filter((b) => (b.time -= simDt) > 0);
  state.burstEvents = state.burstEvents.filter((b) => (b.time -= simDt) > 0);

  // 1. Spawning
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= simDt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = state.spawnInterval;
      const nextSpawn = state.spawnQueue.shift();
      if (nextSpawn) {
        spawnCreep(state, nextSpawn.type, nextSpawn.pathIndex, nextSpawn.hpScale);
      }
    }
  }

  // 2. Creep movement & status effects
  for (let i = state.creeps.length - 1; i >= 0; i--) {
    const creep = state.creeps[i];

    // Status: Slow
    if (creep.slowTimer > 0) {
      creep.slowTimer -= simDt;
      if (creep.slowTimer <= 0) creep.speed = creep.baseSpeed;
    }

    // Status: DoT (Damage over Time)
    if (creep.dotTimer > 0) {
      creep.dotTimer -= simDt;
      creep.hp -= creep.dotDamage * simDt;
    }

    // Status: Regen
    const cDef = CREEP_TYPES[/** @type {keyof typeof CREEP_TYPES} */ (creep.type)];
    if (cDef?.regenRate && creep.hp < creep.maxHp && creep.hp > 0) {
      creep.hp = Math.min(creep.maxHp, creep.hp + cDef.regenRate * simDt);
    }

    // Check death from DoT
    if (creep.hp <= 0) {
      killCreep(state, i);
      continue;
    }

    // Move along waypoints
    const path = state.mapDef.paths[creep.pathIndex];
    if (!path) continue;

    const targetWp = path[creep.waypointIndex];
    if (!targetWp) {
      // Reached the end of the path!
      state.lives = Math.max(0, state.lives - (creep.isBoss ? 5 : 1));
      state.creeps.splice(i, 1);
      if (state.lives <= 0) {
        state.gameOver = true;
        state.won = false;
      }
      continue;
    }

    const tx = targetWp.x * CELL_SIZE + CELL_SIZE / 2;
    const ty = targetWp.y * CELL_SIZE + CELL_SIZE / 2;
    const dx = tx - creep.x;
    const dy = ty - creep.y;
    const dist = Math.hypot(dx, dy);
    const moveDist = creep.speed * simDt;

    if (dist <= moveDist) {
      creep.x = tx;
      creep.y = ty;
      creep.waypointIndex++;
      creep.distanceTraveled += dist;
    } else {
      creep.x += (dx / dist) * moveDist;
      creep.y += (dy / dist) * moveDist;
      creep.distanceTraveled += moveDist;
    }
  }

  // 3. Tower Targeting & Firing
  for (const tower of state.towers) {
    if (tower.cooldown > 0) {
      tower.cooldown -= simDt;
    }

    if (tower.cooldown <= 0) {
      const inRangeCreeps = state.creeps.filter((c) => {
        return Math.hypot(c.x - tower.x, c.y - tower.y) <= tower.range;
      });

      if (inRangeCreeps.length > 0) {
        // Sort according to target mode
        sortCreepsByTargetMode(inRangeCreeps, tower.targetMode);
        const target = inRangeCreeps[0];

        fireTower(state, tower, target, inRangeCreeps);
        tower.cooldown = 1 / tower.fireRate;
      }
    }
  }

  // 4. Projectile movement & impact
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const target = state.creeps.find((c) => c.id === p.targetCreepId);
    const tx = target ? target.x : p.targetX;
    const ty = target ? target.y : p.targetY;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    const stepDist = p.speed * simDt;

    if (dist <= stepDist || dist < 8) {
      // Hit!
      applyProjectileHit(state, p, target);
      state.projectiles.splice(i, 1);
    } else {
      p.x += (dx / dist) * stepDist;
      p.y += (dy / dist) * stepDist;
    }
  }

  // 5. Check Wave Completion
  if (state.waveInProgress && state.spawnQueue.length === 0 && state.creeps.length === 0) {
    state.waveInProgress = false;
    if (!state.waveClearBonusAwarded) {
      const bonus = 40 + state.waveIndex * 15;
      state.credits += bonus;
      state.score += bonus * 10;
      state.waveClearBonusAwarded = true;
    }
    if (state.waveIndex >= state.totalWaves && state.lives > 0) {
      state.gameOver = true;
      state.won = true;
    }
  }
}

/**
 * Spawns a creep
 * @param {ReturnType<typeof createGameState>} state
 * @param {keyof typeof CREEP_TYPES} type
 * @param {number} pathIndex
 * @param {number} hpScale
 */
function spawnCreep(state, type, pathIndex, hpScale) {
  const def = CREEP_TYPES[type];
  const path = state.mapDef.paths[pathIndex] || state.mapDef.paths[0];
  const startWp = path[0];
  const totalHp = Math.round(def.baseHp * hpScale);
  const totalShield = def.shieldHp ? Math.round(def.shieldHp * hpScale) : 0;

  /** @type {Creep} */
  const creep = {
    id: state.nextEntityId++,
    type,
    pathIndex,
    waypointIndex: 1,
    x: startWp.x * CELL_SIZE + CELL_SIZE / 2,
    y: startWp.y * CELL_SIZE + CELL_SIZE / 2,
    hp: totalHp,
    maxHp: totalHp,
    shieldHp: totalShield,
    maxShieldHp: totalShield,
    speed: def.speed,
    baseSpeed: def.speed,
    slowTimer: 0,
    dotTimer: 0,
    dotDamage: 0,
    regenTimer: 0,
    distanceTraveled: 0,
    bounty: def.bounty,
    score: def.score,
    isBoss: !!def.isBoss,
  };

  state.creeps.push(creep);
}

/**
 * Fires tower at target
 * @param {ReturnType<typeof createGameState>} state
 * @param {Tower} tower
 * @param {Creep} target
 * @param {Creep[]} inRangeCreeps
 */
function fireTower(state, tower, target, inRangeCreeps) {
  const def = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (tower.type)];

  if (def.instant) {
    // Instant beam or lightning
    if (tower.type === 'tesla') {
      const chains = inRangeCreeps.slice(0, def.chainCount || 3);
      let px = tower.x;
      let py = tower.y;
      for (const creep of chains) {
        state.beamEvents.push({ x1: px, y1: py, x2: creep.x, y2: creep.y, color: def.color, time: 0.15 });
        dealDamage(state, creep, tower.damage, false, tower);
        px = creep.x;
        py = creep.y;
      }
    } else if (tower.type === 'railgun') {
      state.beamEvents.push({ x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, color: def.color, time: 0.18 });
      dealDamage(state, target, tower.damage, true, tower);
    } else if (tower.type === 'disruptor') {
      state.beamEvents.push({ x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, color: def.color, time: 0.15 });
      target.dotTimer = def.dotDuration || 3;
      target.dotDamage = tower.damage;
      dealDamage(state, target, tower.damage * 0.4, false, tower);
    }
  } else {
    // Launch projectile
    state.projectiles.push({
      id: state.nextEntityId++,
      x: tower.x,
      y: tower.y,
      targetCreepId: target.id,
      targetX: target.x,
      targetY: target.y,
      speed: def.projectileSpeed || 400,
      damage: tower.damage,
      splashRadius: def.splashRadius,
      slowFactor: def.slowFactor,
      slowDuration: def.slowDuration,
      color: def.color,
    });
  }
}

/**
 * Applies projectile impact
 * @param {ReturnType<typeof createGameState>} state
 * @param {Projectile} p
 * @param {Creep | undefined} target
 */
function applyProjectileHit(state, p, target) {
  if (p.splashRadius) {
    state.burstEvents.push({ x: p.x, y: p.y, radius: p.splashRadius, color: p.color, time: 0.25 });
    for (const creep of state.creeps) {
      const d = Math.hypot(creep.x - p.x, creep.y - p.y);
      if (d <= p.splashRadius) {
        const falloff = 1 - d / p.splashRadius;
        dealDamage(state, creep, Math.max(1, Math.round(p.damage * falloff)), !!p.armorPiercing);
      }
    }
  } else if (target && state.creeps.includes(target)) {
    dealDamage(state, target, p.damage, !!p.armorPiercing);
    if (p.slowFactor && p.slowDuration) {
      target.slowTimer = p.slowDuration;
      target.speed = target.baseSpeed * p.slowFactor;
    }
  }
}

/**
 * Deals damage to creep taking shields/armor into account
 * @param {ReturnType<typeof createGameState>} state
 * @param {Creep} creep
 * @param {number} dmg
 * @param {boolean} armorPiercing
 * @param {Tower} [sourceTower]
 */
function dealDamage(state, creep, dmg, armorPiercing, sourceTower) {
  let finalDmg = dmg;
  const def = CREEP_TYPES[/** @type {keyof typeof CREEP_TYPES} */ (creep.type)];

  if (creep.shieldHp > 0) {
    const shieldDmg = Math.min(creep.shieldHp, finalDmg);
    creep.shieldHp -= shieldDmg;
    finalDmg -= shieldDmg;
  }

  if (finalDmg > 0 && def?.armor && !armorPiercing) {
    finalDmg *= 1 - def.armor;
  }

  creep.hp -= finalDmg;
  if (sourceTower) sourceTower.totalDamageDealt += dmg;

  if (creep.hp <= 0) {
    const idx = state.creeps.indexOf(creep);
    if (idx >= 0) {
      if (sourceTower) sourceTower.kills++;
      killCreep(state, idx);
    }
  }
}

/**
 * Removes creep and gives bounty + score
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} index
 */
function killCreep(state, index) {
  const creep = state.creeps[index];
  if (!creep) return;

  state.credits += creep.bounty;
  state.score += creep.score;
  state.burstEvents.push({ x: creep.x, y: creep.y, radius: creep.isBoss ? 35 : 18, color: '#f59e0b', time: 0.2 });
  state.creeps.splice(index, 1);
}

/**
 * Sorts creeps according to targetMode
 * @param {Creep[]} creeps
 * @param {number} mode 0 = first, 1 = last, 2 = strong, 3 = weak
 */
function sortCreepsByTargetMode(creeps, mode) {
  if (mode === 0) {
    // First (furthest along path)
    creeps.sort((a, b) => b.distanceTraveled - a.distanceTraveled);
  } else if (mode === 1) {
    // Last
    creeps.sort((a, b) => a.distanceTraveled - b.distanceTraveled);
  } else if (mode === 2) {
    // Strongest (highest HP)
    creeps.sort((a, b) => b.hp - a.hp);
  } else if (mode === 3) {
    // Weakest (lowest HP)
    creeps.sort((a, b) => a.hp - b.hp);
  }
}
