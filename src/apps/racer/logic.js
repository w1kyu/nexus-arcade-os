// @ts-check

/**
 * Neon Racer Physics, Track Geometry & AI Simulation
 */

export const CANVAS_W = 800;
export const CANVAS_H = 600;

/**
 * @typedef {object} TrackPoint
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} TrackDef
 * @property {string} id
 * @property {string} name
 * @property {TrackPoint[]} waypoints
 * @property {number} roadWidth
 * @property {{ x: number, y: number, angle: number }} startGrid
 */

export const TRACKS = [
  {
    id: 'oval',
    name: 'Neon Oval',
    roadWidth: 70,
    startGrid: { x: 400, y: 520, angle: 0 },
    waypoints: [
      { x: 400, y: 520 },
      { x: 650, y: 500 },
      { x: 720, y: 380 },
      { x: 720, y: 220 },
      { x: 650, y: 100 },
      { x: 400, y: 80 },
      { x: 150, y: 100 },
      { x: 80, y: 220 },
      { x: 80, y: 380 },
      { x: 150, y: 500 },
    ],
  },
  {
    id: 'circuit',
    name: 'Cyber Circuit',
    roadWidth: 65,
    startGrid: { x: 400, y: 520, angle: 0 },
    waypoints: [
      { x: 400, y: 520 },
      { x: 680, y: 520 },
      { x: 730, y: 400 },
      { x: 550, y: 340 },
      { x: 680, y: 220 },
      { x: 680, y: 100 },
      { x: 420, y: 100 },
      { x: 340, y: 220 },
      { x: 200, y: 120 },
      { x: 80, y: 250 },
      { x: 120, y: 450 },
      { x: 250, y: 520 },
    ],
  },
  {
    id: 'hairpin',
    name: 'Hairpin Horizon',
    roadWidth: 60,
    startGrid: { x: 150, y: 520, angle: 0 },
    waypoints: [
      { x: 150, y: 520 },
      { x: 680, y: 520 },
      { x: 730, y: 420 },
      { x: 200, y: 400 },
      { x: 100, y: 300 },
      { x: 680, y: 280 },
      { x: 730, y: 180 },
      { x: 150, y: 140 },
      { x: 80, y: 350 },
    ],
  },
  {
    id: 'matrix',
    name: 'Matrix Speedway',
    roadWidth: 65,
    startGrid: { x: 400, y: 530, angle: 0 },
    waypoints: [
      { x: 400, y: 530 },
      { x: 680, y: 510 },
      { x: 710, y: 320 },
      { x: 460, y: 280 },
      { x: 680, y: 120 },
      { x: 380, y: 90 },
      { x: 120, y: 130 },
      { x: 300, y: 280 },
      { x: 90, y: 350 },
      { x: 130, y: 510 },
    ],
  },
  {
    id: 'vortex',
    name: 'Quantum Vortex',
    roadWidth: 60,
    startGrid: { x: 400, y: 530, angle: 0 },
    waypoints: [
      { x: 400, y: 530 },
      { x: 650, y: 480 },
      { x: 680, y: 320 },
      { x: 500, y: 320 },
      { x: 500, y: 180 },
      { x: 680, y: 120 },
      { x: 380, y: 80 },
      { x: 120, y: 120 },
      { x: 280, y: 240 },
      { x: 100, y: 360 },
      { x: 200, y: 500 },
    ],
  },
];

/**
 * @typedef {object} Car
 * @property {number} id
 * @property {string} name
 * @property {string} color
 * @property {boolean} isAI
 * @property {number} x
 * @property {number} y
 * @property {number} angle Heading in radians
 * @property {number} speed Forward speed (pixels/sec)
 * @property {number} maxSpeed
 * @property {number} accel
 * @property {number} brake
 * @property {number} turnRate
 * @property {number} currentWaypoint
 * @property {number} lap Current lap (1-based)
 * @property {number} lapStartTime
 * @property {number} bestLap
 * @property {number[]} lapTimes
 * @property {boolean} finished
 * @property {number} driftScore
 */

/**
 * Creates initial car state
 * @param {number} id
 * @param {string} name
 * @param {string} color
 * @param {boolean} isAI
 * @param {number} x
 * @param {number} y
 * @param {number} angle
 * @returns {Car}
 */
export function createCar(id, name, color, isAI, x, y, angle) {
  return {
    id,
    name,
    color,
    isAI,
    x,
    y,
    angle,
    speed: 0,
    maxSpeed: isAI ? 250 : 280,
    accel: isAI ? 200 : 230,
    brake: 350,
    turnRate: 3.2,
    currentWaypoint: 0,
    lap: 1,
    lapStartTime: 0,
    bestLap: Infinity,
    lapTimes: [],
    finished: false,
    driftScore: 0,
  };
}

/**
 * @typedef {object} GhostSample
 * @property {number} time
 * @property {number} x
 * @property {number} y
 * @property {number} angle
 */

/**
 * Creates game state for Neon Racer
 * @param {number} [trackIndex=0]
 * @param {number} [totalLaps=3]
 */
export function createRacerState(trackIndex = 0, totalLaps = 3) {
  const track = TRACKS[trackIndex] || TRACKS[0];
  const grid = track.startGrid;

  // Player car
  const player = createCar(1, 'Neon Viper', '#00f0ff', false, grid.x, grid.y, grid.angle);

  // 3 AI Opponent Cars
  const aiCars = [
    createCar(2, 'Shadow Drift', '#ff0055', true, grid.x - 25, grid.y - 25, grid.angle),
    createCar(3, 'Cyber Phantom', '#a855f7', true, grid.x + 25, grid.y - 45, grid.angle),
    createCar(4, 'Volt Striker', '#eab308', true, grid.x, grid.y - 70, grid.angle),
  ];

  return {
    trackIndex,
    track,
    totalLaps,
    player,
    aiCars,
    allCars: [player, ...aiCars],
    raceTime: 0,
    started: false,
    countdown: 3.0,
    gameOver: false,
    /** @type {GhostSample[]} Record of player's best lap */
    bestLapGhost: [],
    /** @type {GhostSample[]} Samples for the current lap being recorded */
    currentLapSamples: [],
    sampleTimer: 0,
  };
}

/**
 * Steps the racer simulation
 * @param {ReturnType<typeof createRacerState>} state
 * @param {number} dt
 * @param {{ throttle: boolean, brake: boolean, left: boolean, right: boolean }} playerInput
 */
export function stepRacer(state, dt, playerInput) {
  if (state.gameOver) return;

  // Countdown handling
  if (!state.started) {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.started = true;
      state.player.lapStartTime = 0;
      for (const ai of state.aiCars) ai.lapStartTime = 0;
    }
    return;
  }

  state.raceTime += dt;

  // 1. Update Player Car
  updatePlayerCar(state.player, dt, playerInput);
  checkCarTrackBounds(state.player, state.track);
  checkWaypointsAndLaps(state, state.player);

  // Record ghost samples for player
  state.sampleTimer += dt;
  if (state.sampleTimer >= 0.05) {
    state.sampleTimer = 0;
    state.currentLapSamples.push({
      time: state.raceTime - state.player.lapStartTime,
      x: state.player.x,
      y: state.player.y,
      angle: state.player.angle,
    });
  }

  // 2. Update AI Cars
  for (const ai of state.aiCars) {
    if (!ai.finished) {
      updateAICar(ai, dt, state.track);
      checkCarTrackBounds(ai, state.track);
      checkWaypointsAndLaps(state, ai);
    }
  }

  // Check race finish
  if (state.player.lap > state.totalLaps) {
    state.player.finished = true;
    state.gameOver = true;
  }
}

/**
 * Updates player physics
 * @param {Car} car
 * @param {number} dt
 * @param {{ throttle: boolean, brake: boolean, left: boolean, right: boolean }} input
 */
function updatePlayerCar(car, dt, input) {
  if (car.finished) {
    car.speed = Math.max(0, car.speed - 150 * dt);
    return;
  }

  // Acceleration / Throttle
  if (input.throttle) {
    car.speed = Math.min(car.maxSpeed, car.speed + car.accel * dt);
  } else if (input.brake) {
    car.speed = Math.max(-100, car.speed - car.brake * dt);
  } else {
    // Natural friction
    if (car.speed > 0) car.speed = Math.max(0, car.speed - 110 * dt);
    else if (car.speed < 0) car.speed = Math.min(0, car.speed + 110 * dt);
  }

  // Steering
  if (Math.abs(car.speed) > 5) {
    const steerDir = input.left ? -1 : input.right ? 1 : 0;
    const speedRatio = Math.min(1, Math.abs(car.speed) / (car.maxSpeed * 0.4));
    car.angle += steerDir * car.turnRate * speedRatio * dt * (car.speed >= 0 ? 1 : -1);

    // Drifting check
    if (steerDir !== 0 && Math.abs(car.speed) > car.maxSpeed * 0.7) {
      car.driftScore += dt;
    }
  }

  // Movement
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/**
 * Updates AI navigation along track waypoints
 * @param {Car} car
 * @param {number} dt
 * @param {TrackDef} track
 */
function updateAICar(car, dt, track) {
  const targetWp = track.waypoints[car.currentWaypoint];
  if (!targetWp) return;

  const dx = targetWp.x - car.x;
  const dy = targetWp.y - car.y;
  const targetAngle = Math.atan2(dy, dx);

  // Steer towards target waypoint
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const maxTurn = car.turnRate * dt;
  car.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));

  // Accelerate
  car.speed = Math.min(car.maxSpeed, car.speed + car.accel * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Advance waypoint if close
  if (Math.hypot(dx, dy) < track.roadWidth * 0.8) {
    car.currentWaypoint = (car.currentWaypoint + 1) % track.waypoints.length;
  }
}

/**
 * Checks distance from centerline of track and slows car if off-road
 * @param {Car} car
 * @param {TrackDef} track
 */
function checkCarTrackBounds(car, track) {
  let minDist = Infinity;
  const wps = track.waypoints;
  const len = wps.length;

  for (let i = 0; i < len; i++) {
    const p1 = wps[i];
    const p2 = wps[(i + 1) % len];
    const d = distToSegment(car.x, car.y, p1.x, p1.y, p2.x, p2.y);
    if (d < minDist) minDist = d;
  }

  // Off-road penalty
  if (minDist > track.roadWidth) {
    car.speed = Math.max(0, car.speed - 300 * 0.05);
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * Check waypoint gates and completed laps
 * @param {ReturnType<typeof createRacerState>} state
 * @param {Car} car
 */
function checkWaypointsAndLaps(state, car) {
  const track = state.track;
  const targetWp = track.waypoints[car.currentWaypoint];
  if (!targetWp) return;

  const dist = Math.hypot(car.x - targetWp.x, car.y - targetWp.y);
  if (dist < track.roadWidth * 1.2) {
    const nextWp = (car.currentWaypoint + 1) % track.waypoints.length;

    // Completed full lap!
    if (nextWp === 1 && car.currentWaypoint === 0) {
      const lapDuration = state.raceTime - car.lapStartTime;
      car.lapTimes.push(lapDuration);
      if (lapDuration < car.bestLap) {
        car.bestLap = lapDuration;
        if (!car.isAI) {
          state.bestLapGhost = [...state.currentLapSamples];
        }
      }
      if (!car.isAI) state.currentLapSamples = [];
      car.lapStartTime = state.raceTime;
      car.lap++;
    }

    car.currentWaypoint = nextWp;
  }
}
