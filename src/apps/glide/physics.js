// @ts-check
// Neon Glide flight physics, obstacle generator, and ghost recorder

export const ARENA_W = 800;
export const ARENA_H = 600;

export const GRAVITY = 950;
export const FLAP_IMPULSE = -340;
export const MAX_FALL_SPEED = 600;

/**
 * @typedef {object} NeonGate
 * @property {number} x
 * @property {number} width
 * @property {number} topH Height of top barrier
 * @property {number} botY Top of bottom barrier
 * @property {number} gap Gap height
 * @property {boolean} passed
 */

export class Glider {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x = 180, y = 300) {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.radius = 14;
    this.angle = 0;
    this.alive = true;
  }

  flap() {
    this.vy = FLAP_IMPULSE;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;

    // Angle reflects trajectory (-30 deg climbing to +70 deg diving)
    const targetAngle = Math.max(-0.5, Math.min(1.2, this.vy / 400));
    this.angle += (targetAngle - this.angle) * Math.min(1, dt * 10);
  }
}

/**
 * Creates a neon obstacle gate.
 * @param {number} x
 * @param {number} [gap=150]
 * @param {() => number} [rng]
 * @returns {NeonGate}
 */
export function createGate(x, gap = 150, rng = Math.random) {
  const minH = 60;
  const maxH = ARENA_H - gap - minH;
  const topH = Math.floor(minH + rng() * (maxH - minH));
  return {
    x,
    width: 60,
    topH,
    botY: topH + gap,
    gap,
    passed: false,
  };
}

/**
 * Checks circle-to-box collision between glider and a gate.
 * @param {Glider} glider
 * @param {NeonGate} gate
 */
export function checkGateCollision(glider, gate) {
  // Check bounds of arena
  if (glider.y - glider.radius < 0 || glider.y + glider.radius > ARENA_H) {
    return true;
  }

  // Check horizontal overlap with gate
  const gx1 = gate.x;
  const gx2 = gate.x + gate.width;
  if (glider.x + glider.radius > gx1 && glider.x - glider.radius < gx2) {
    // Within top barrier or bottom barrier
    if (glider.y - glider.radius < gate.topH || glider.y + glider.radius > gate.botY) {
      return true;
    }
  }
  return false;
}

/**
 * Ghost recorder for personal best replay.
 */
export class GhostRecorder {
  constructor() {
    /** @type {{ time: number, y: number, angle: number }[]} */
    this.currentTrack = [];
    /** @type {{ time: number, y: number, angle: number }[]} */
    this.bestTrack = [];
  }

  record(time, y, angle) {
    this.currentTrack.push({
      time: Math.round(time * 100) / 100,
      y: Math.round(y),
      angle: Math.round(angle * 100) / 100,
    });
  }

  saveBest() {
    this.bestTrack = [...this.currentTrack];
  }

  /**
   * Samples ghost position at time `t`.
   * @param {number} t
   */
  sample(t) {
    if (!this.bestTrack.length) return null;
    const roundedT = Math.round(t * 100) / 100;
    // Find closest frame
    let closest = this.bestTrack[0];
    for (let i = 0; i < this.bestTrack.length; i++) {
      if (this.bestTrack[i].time <= roundedT) closest = this.bestTrack[i];
      else break;
    }
    return closest;
  }
}
