// @ts-check
// Void Drifter entities: Ship, Asteroid, Projectile, UFO, and PowerUps

export const SHIP_RADIUS = 14;
export const LARGE_ASTEROID_RADIUS = 36;
export const MEDIUM_ASTEROID_RADIUS = 22;
export const SMALL_ASTEROID_RADIUS = 12;

export function wrapCoords(x, y, w, h, margin = 20) {
  let nx = x;
  let ny = y;
  if (nx < -margin) nx = w + margin;
  else if (nx > w + margin) nx = -margin;
  if (ny < -margin) ny = h + margin;
  else if (ny > h + margin) ny = -margin;
  return { x: nx, y: ny };
}

export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2; // Facing up
    this.radius = SHIP_RADIUS;

    this.rotSpeed = 4.2; // rad/s
    this.thrustPower = 340; // px/s^2
    this.drag = 0.985;
    this.maxSpeed = 450;

    // Power-up states
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasTripleShot = false;
    this.tripleShotTimer = 0;
    this.hasRapidFire = false;
    this.rapidFireTimer = 0;

    this.invulnerableTimer = 2.0; // 2s spawn invulnerability
    this.fireCooldown = 0;
  }

  rotate(dir, dt) {
    this.angle += dir * this.rotSpeed * dt;
  }

  thrust(dt) {
    const ax = Math.cos(this.angle) * this.thrustPower;
    const ay = Math.sin(this.angle) * this.thrustPower;
    this.vx += ax * dt;
    this.vy += ay * dt;

    // Cap speed
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this.maxSpeed) {
      const scale = this.maxSpeed / spd;
      this.vx *= scale;
      this.vy *= scale;
    }
  }

  update(dt, w, h) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(this.drag, dt * 60);
    this.vy *= Math.pow(this.drag, dt * 60);

    const wrapped = wrapCoords(this.x, this.y, w, h, this.radius);
    this.x = wrapped.x;
    this.y = wrapped.y;

    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.hasShield = false;
    }
    if (this.tripleShotTimer > 0) {
      this.tripleShotTimer -= dt;
      if (this.tripleShotTimer <= 0) this.hasTripleShot = false;
    }
    if (this.rapidFireTimer > 0) {
      this.rapidFireTimer -= dt;
      if (this.rapidFireTimer <= 0) this.hasRapidFire = false;
    }
  }

  /**
   * Hyperspace jump: teleports ship to random position.
   * Has a 15% risk of malfunction.
   * @param {number} w
   * @param {number} h
   * @param {() => number} [rng]
   * @returns {{ x: number, y: number, malfunction: boolean }}
   */
  hyperspace(w, h, rng = Math.random) {
    this.x = rng() * (w - 100) + 50;
    this.y = rng() * (h - 100) + 50;
    this.vx = 0;
    this.vy = 0;
    const malfunction = rng() < 0.15;
    return { x: this.x, y: this.y, malfunction };
  }
}

export class Asteroid {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'large' | 'medium' | 'small'} size
   * @param {() => number} [rng]
   */
  constructor(x, y, size = 'large', rng = Math.random) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius =
      size === 'large' ? LARGE_ASTEROID_RADIUS : size === 'medium' ? MEDIUM_ASTEROID_RADIUS : SMALL_ASTEROID_RADIUS;

    const baseSpeed = size === 'large' ? 45 : size === 'medium' ? 85 : 135;
    const angle = rng() * Math.PI * 2;
    const speed = baseSpeed * (0.8 + rng() * 0.4);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.rotAngle = rng() * Math.PI * 2;
    this.rotSpeed = (rng() - 0.5) * 1.8;

    // Generate irregular polygon vertices
    const vertexCount = size === 'large' ? 12 : size === 'medium' ? 10 : 8;
    this.vertices = [];
    for (let i = 0; i < vertexCount; i++) {
      const a = (i / vertexCount) * Math.PI * 2;
      const r = this.radius * (0.75 + rng() * 0.45);
      this.vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  update(dt, w, h) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotAngle += this.rotSpeed * dt;

    const wrapped = wrapCoords(this.x, this.y, w, h, this.radius);
    this.x = wrapped.x;
    this.y = wrapped.y;
  }

  /**
   * Splits into two smaller asteroids, or empty array if small
   * @param {() => number} [rng]
   * @returns {Asteroid[]}
   */
  split(rng = Math.random) {
    if (this.size === 'small') return [];
    const nextSize = this.size === 'large' ? 'medium' : 'small';
    return [new Asteroid(this.x, this.y, nextSize, rng), new Asteroid(this.x, this.y, nextSize, rng)];
  }
}

export class Projectile {
  constructor(x, y, vx, vy, fromPlayer = true) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.fromPlayer = fromPlayer;
    this.life = fromPlayer ? 1.4 : 2.0;
    this.radius = fromPlayer ? 3 : 4;
  }

  update(dt, w, h) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    const wrapped = wrapCoords(this.x, this.y, w, h, this.radius);
    this.x = wrapped.x;
    this.y = wrapped.y;
  }
}

export class UFO {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'small' | 'large'} type
   */
  constructor(x, y, type = 'large') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type === 'small' ? 14 : 22;
    this.vx = (type === 'small' ? 120 : 80) * (x < 100 ? 1 : -1);
    this.vy = (Math.random() - 0.5) * 60;

    this.shootTimer = 0;
    this.shootInterval = type === 'small' ? 1.6 : 2.5;
  }

  /**
   * @param {number} dt
   * @param {number} w
   * @param {number} h
   * @param {{ x: number, y: number }} [playerPos]
   * @returns {Projectile | null}
   */
  update(dt, w, h, playerPos) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const wrapped = wrapCoords(this.x, this.y, w, h, this.radius);
    this.x = wrapped.x;
    this.y = wrapped.y;

    this.shootTimer += dt;
    if (this.shootTimer >= this.shootInterval) {
      this.shootTimer = 0;
      const angle =
        this.type === 'small' && playerPos
          ? Math.atan2(playerPos.y - this.y, playerPos.x - this.x) + (Math.random() - 0.5) * 0.35
          : Math.random() * Math.PI * 2;
      const pSpeed = 220;
      return new Projectile(this.x, this.y, Math.cos(angle) * pSpeed, Math.sin(angle) * pSpeed, false);
    }
    return null;
  }
}

export class PowerUp {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'shield' | 'triple' | 'rapid'} type
   */
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 12;
    this.life = 12.0; // 12 seconds before despawning
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * 20;
    this.vy = Math.sin(angle) * 20;
  }

  update(dt, w, h) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    const wrapped = wrapCoords(this.x, this.y, w, h, this.radius);
    this.x = wrapped.x;
    this.y = wrapped.y;
  }
}
