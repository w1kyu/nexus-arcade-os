// @ts-check
// 2D particle system using object pooling and Canvas 2D rendering

import { ObjectPool } from './pool.js';

/**
 * @typedef {object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life
 * @property {number} maxLife
 * @property {number} sizeStart
 * @property {number} sizeEnd
 * @property {string} color
 * @property {number} alphaStart
 * @property {number} alphaEnd
 * @property {number} gravity
 * @property {number} drag
 * @property {boolean} active
 */

export class ParticleSystem {
  /**
   * @param {number} [maxParticles]
   */
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
    /** @type {ObjectPool<Particle>} */
    this.pool = new ObjectPool(
      () => ({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        sizeStart: 4,
        sizeEnd: 0,
        color: '#ffdd00',
        alphaStart: 1,
        alphaEnd: 0,
        gravity: 0,
        drag: 0.98,
        active: false,
      }),
      (p) => {
        p.active = false;
      },
      maxParticles,
    );
    /** @type {Particle[]} */
    this.particles = [];
  }

  /**
   * Emits a burst of particles at (x, y).
   * @param {object} config
   * @param {number} config.x
   * @param {number} config.y
   * @param {number} [config.count]
   * @param {number} [config.speed]
   * @param {number} [config.spread] In radians (default 2*PI for full circle)
   * @param {number} [config.angle] Base angle in radians (default 0)
   * @param {number} [config.life] In seconds
   * @param {number} [config.sizeStart]
   * @param {number} [config.sizeEnd]
   * @param {string | string[]} [config.color]
   * @param {number} [config.gravity]
   * @param {number} [config.drag]
   */
  emit({
    x,
    y,
    count = 20,
    speed = 120,
    spread = Math.PI * 2,
    angle = 0,
    life = 0.6,
    sizeStart = 4,
    sizeEnd = 0,
    color = '#00f0ff',
    gravity = 0,
    drag = 0.98,
  }) {
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const p = this.pool.acquire();
      const pAngle = angle + (Math.random() - 0.5) * spread;
      const pSpeed = speed * (0.4 + Math.random() * 0.8);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(pAngle) * pSpeed;
      p.vy = Math.sin(pAngle) * pSpeed;
      p.life = life * (0.6 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.sizeStart = sizeStart;
      p.sizeEnd = sizeEnd;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.alphaStart = 1;
      p.alphaEnd = 0;
      p.gravity = gravity;
      p.drag = drag;
      p.active = true;

      this.particles.push(p);
    }
  }

  /**
   * Updates all active particles.
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.release(p);
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /**
   * Renders particles to a 2D canvas context.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (this.particles.length === 0) return;
    ctx.save();
    for (const p of this.particles) {
      const t = 1 - p.life / p.maxLife; // 0 -> 1
      const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;
      const size = Math.max(0.1, p.sizeStart + (p.sizeEnd - p.sizeStart) * t);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.particles) {
      this.pool.release(p);
    }
    this.particles.length = 0;
  }
}
