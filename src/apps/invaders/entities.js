// @ts-check
// Grid Invaders entities: Player, Alien, Bunker, Boss, Projectile, PowerUp

export class InvaderPlayer {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 36;
    this.height = 20;
    this.speed = 320;
    this.fireCooldown = 0;
    this.powerUpType = '';
    this.powerUpTimer = 0;
    this.alive = true;
    this.respawnTimer = 0;
  }

  /**
   * @param {number} dt
   * @param {number} moveDir -1 (left), 1 (right), or 0
   * @param {number} arenaW
   */
  update(dt, moveDir, arenaW) {
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      return;
    }
    this.x += moveDir * this.speed * dt;
    this.x = Math.max(this.width / 2, Math.min(arenaW - this.width / 2, this.x));

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.powerUpTimer > 0) {
      this.powerUpTimer -= dt;
      if (this.powerUpTimer <= 0) this.powerUpType = '';
    }
  }

  canFire() {
    return this.respawnTimer <= 0 && this.fireCooldown <= 0;
  }

  resetCooldown() {
    this.fireCooldown = this.powerUpType === 'rapid' ? 0.12 : 0.28;
  }
}

export class InvaderAlien {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} type 0 = top (30pts), 1 = mid (20pts), 2 = bot (10pts)
   */
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = 28;
    this.height = 20;
    this.alive = true;
    this.animFrame = 0;
    this.isDiving = false;
    this.diveVx = 0;
    this.diveVy = 0;
    this.origX = x;
    this.origY = y;
  }

  get score() {
    return (3 - this.type) * 10;
  }
}

export class BunkerShield {
  /**
   * Destructible 4x3 block bunker
   * @param {number} x Left edge
   * @param {number} y Top edge
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 64;
    this.height = 48;
    this.cols = 4;
    this.rows = 3;
    this.cellW = 16;
    this.cellH = 16;
    // Health for each sub-block (0 = destroyed, 1..3 health)
    this.blocks = [
      [3, 3, 3, 3],
      [3, 3, 3, 3],
      [3, 0, 0, 3], // archway cutout
    ];
  }

  /**
   * Tests hit against projectiles
   * @param {number} px
   * @param {number} py
   * @returns {boolean} true if absorbed
   */
  hitTest(px, py) {
    if (px < this.x || px > this.x + this.width || py < this.y || py > this.y + this.height) {
      return false;
    }
    const c = Math.floor((px - this.x) / this.cellW);
    const r = Math.floor((py - this.y) / this.cellH);
    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.blocks[r][c] > 0) {
      this.blocks[r][c]--;
      return true;
    }
    return false;
  }

  get isIntact() {
    return this.blocks.some((row) => row.some((hp) => hp > 0));
  }
}

export class InvaderBoss {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} wave
   */
  constructor(x, y, wave) {
    this.x = x;
    this.y = y;
    this.width = 96;
    this.height = 40;
    this.maxHealth = 40 + wave * 10;
    this.health = this.maxHealth;
    this.vx = 80;
    this.alive = true;
    this.fireTimer = 1.0;
  }

  update(dt, arenaW) {
    this.x += this.vx * dt;
    if (this.x < this.width / 2 || this.x > arenaW - this.width / 2) {
      this.vx = -this.vx;
    }
    this.fireTimer -= dt;
  }
}

export class InvaderProjectile {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} vy Negative = up (player), Positive = down (alien)
   * @param {boolean} isPlayer
   * @param {string} [type='laser']
   */
  constructor(x, y, vy, isPlayer, type = 'laser') {
    this.x = x;
    this.y = y;
    this.vy = vy;
    this.isPlayer = isPlayer;
    this.type = type;
    this.width = isPlayer ? 4 : 4;
    this.height = isPlayer ? 12 : 8;
    this.active = true;
  }

  update(dt) {
    this.y += this.vy * dt;
  }
}

export class InvaderPowerUp {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'shield' | 'rapid' | 'triple'} type
   */
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vy = 90;
    this.size = 16;
    this.active = true;
  }

  update(dt) {
    this.y += this.vy * dt;
  }
}
