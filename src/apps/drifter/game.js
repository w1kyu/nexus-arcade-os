// @ts-check
// Void Drifter arcade game engine integration

import {
  GameAudio,
  GameLoop,
  GameRenderer,
  GameScoreService,
  InputManager,
  ParticleSystem,
  SeededRng,
  circleIntersects,
  createGameOverModal,
  createPauseModal,
} from '../../games/engine/index.js';
import { Asteroid, PowerUp, Projectile, Ship, UFO } from './entities.js';

export const ARENA_W = 800;
export const ARENA_H = 600;

export class DrifterGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} [options]
   * @param {() => void} [options.onQuit]
   */
  constructor(canvas, container, ctx, { onQuit } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = ctx;
    this.onQuit = onQuit;

    this.renderer = new GameRenderer(canvas, {
      virtualWidth: ARENA_W,
      virtualHeight: ARENA_H,
      letterbox: true,
    });
    this.audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
    this.input = new InputManager(container, { renderer: this.renderer });
    this.particles = new ParticleSystem(400);
    this.scores = new GameScoreService('nexus.drifter', ctx);
    this.rng = new SeededRng();

    // Game stats
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.isPaused = false;
    this.elapsedTime = 0;

    // Wave banner
    this.waveBannerTimer = 2.5;

    // Entities
    this.ship = new Ship(ARENA_W / 2, ARENA_H / 2);
    /** @type {Asteroid[]} */
    this.asteroids = [];
    /** @type {Projectile[]} */
    this.projectiles = [];
    /** @type {UFO[]} */
    this.ufos = [];
    /** @type {PowerUp[]} */
    this.powerUps = [];

    // Timers
    this.ufoSpawnTimer = 18.0;

    this._setupInput();
    this._startWave(1);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (_alpha) => this.render(),
    });
    this.loop.start();
  }

  _setupInput() {
    this.input.bindAction('thrust', ['ArrowUp', 'KeyW']);
    this.input.bindAction('rotateLeft', ['ArrowLeft', 'KeyA']);
    this.input.bindAction('rotateRight', ['ArrowRight', 'KeyD']);
    this.input.bindAction('fire', ['Space', 'KeyJ']);
    this.input.bindAction('hyperspace', ['ShiftLeft', 'ShiftRight', 'KeyH', 'ArrowDown', 'KeyS']);
    this.input.bindAction('pause', ['Escape', 'KeyP']);
  }

  _startWave(waveNum) {
    this.wave = waveNum;
    this.waveBannerTimer = 2.5;
    this.projectiles = [];
    this.ufos = [];
    this.ufoSpawnTimer = Math.max(8, 20 - waveNum * 2);

    // Spawn asteroids away from center
    this.asteroids = [];
    const count = 3 + waveNum;
    for (let i = 0; i < count; i++) {
      let x = this.rng.next() * ARENA_W;
      let y = this.rng.next() * ARENA_H;
      // Ensure distance from ship
      while (Math.hypot(x - ARENA_W / 2, y - ARENA_H / 2) < 160) {
        x = this.rng.next() * ARENA_W;
        y = this.rng.next() * ARENA_H;
      }
      this.asteroids.push(new Asteroid(x, y, 'large', () => this.rng.next()));
    }
  }

  update(dt) {
    if (this.isPaused || this.gameOver) return;

    this.elapsedTime += dt;
    this.particles.update(dt);
    this.renderer.camera.update(dt);

    if (this.waveBannerTimer > 0) {
      this.waveBannerTimer -= dt;
    }

    if (this.input.isActionJustPressed('pause')) {
      this.togglePause();
      return;
    }

    // Ship controls
    if (this.ship) {
      if (this.input.isActionDown('rotateLeft')) {
        this.ship.rotate(-1, dt);
      }
      if (this.input.isActionDown('rotateRight')) {
        this.ship.rotate(1, dt);
      }
      if (this.input.isActionDown('thrust')) {
        this.ship.thrust(dt);
        // Exhaust particles
        const backAngle = this.ship.angle + Math.PI;
        const ex = this.ship.x + Math.cos(backAngle) * 12;
        const ey = this.ship.y + Math.sin(backAngle) * 12;
        this.particles.burst(ex, ey, {
          count: 2,
          color: '#00f0ff',
          speedMin: 30,
          speedMax: 90,
          lifeMin: 0.1,
          lifeMax: 0.25,
        });
      }

      if (this.input.isActionJustPressed('fire')) {
        this._firePlayerLaser();
      }

      if (this.input.isActionJustPressed('hyperspace')) {
        this._hyperspaceJump();
      }

      this.ship.update(dt, ARENA_W, ARENA_H);
    }

    // Update asteroids
    for (const a of this.asteroids) {
      a.update(dt, ARENA_W, ARENA_H);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, ARENA_W, ARENA_H);
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update UFOs
    this.ufoSpawnTimer -= dt;
    if (this.ufoSpawnTimer <= 0 && this.ufos.length < 2) {
      this.ufoSpawnTimer = Math.max(10, 22 - this.wave * 2);
      const type = this.wave >= 2 && this.rng.next() < 0.4 ? 'small' : 'large';
      const startX = this.rng.next() < 0.5 ? 0 : ARENA_W;
      const startY = this.rng.next() * (ARENA_H - 120) + 60;
      this.ufos.push(new UFO(startX, startY, type));
      this.audio.play('powerup');
    }

    for (let i = this.ufos.length - 1; i >= 0; i--) {
      const ufo = this.ufos[i];
      const laser = ufo.update(dt, ARENA_W, ARENA_H, this.ship ? { x: this.ship.x, y: this.ship.y } : undefined);
      if (laser) {
        this.projectiles.push(laser);
        this.audio.play('laser');
      }
      // Check UFO lifetime / offscreen
      if (ufo.x < -40 || ufo.x > ARENA_W + 40) {
        this.ufos.splice(i, 1);
      }
    }

    // Update power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.update(dt, ARENA_W, ARENA_H);
      if (pu.life <= 0) {
        this.powerUps.splice(i, 1);
      }
    }

    this._checkCollisions();

    // Check wave complete
    if (this.asteroids.length === 0 && this.ufos.length === 0 && this.waveBannerTimer <= 0) {
      this.audio.play('victory');
      this.score += this.wave * 1000;
      this._startWave(this.wave + 1);
      if (this.ctx?.achievements?.unlock) {
        if (this.wave >= 5) this.ctx.achievements.unlock('drifter_wave_5');
      }
    }
  }

  _firePlayerLaser() {
    if (!this.ship || this.ship.fireCooldown > 0) return;
    this.ship.fireCooldown = this.ship.hasRapidFire ? 0.12 : 0.22;
    this.audio.play('laser');

    const pSpeed = 480;
    if (this.ship.hasTripleShot) {
      // 3 projectiles in 20 degree spread
      for (const offset of [-0.22, 0, 0.22]) {
        const a = this.ship.angle + offset;
        const vx = this.ship.vx + Math.cos(a) * pSpeed;
        const vy = this.ship.vy + Math.sin(a) * pSpeed;
        this.projectiles.push(new Projectile(this.ship.x, this.ship.y, vx, vy, true));
      }
    } else {
      const vx = this.ship.vx + Math.cos(this.ship.angle) * pSpeed;
      const vy = this.ship.vy + Math.sin(this.ship.angle) * pSpeed;
      this.projectiles.push(new Projectile(this.ship.x, this.ship.y, vx, vy, true));
    }
  }

  _hyperspaceJump() {
    if (!this.ship) return;
    this.audio.play('jump');
    const res = this.ship.hyperspace(ARENA_W, ARENA_H, () => this.rng.next());

    this.particles.burst(res.x, res.y, {
      count: 25,
      color: '#bc8cff',
      speedMin: 50,
      speedMax: 180,
      lifeMin: 0.3,
      lifeMax: 0.6,
    });

    if (res.malfunction) {
      // Small screen shake and temporary shield loss or near danger
      this.renderer.camera.shake(12, 0.4);
      this.audio.play('hit');
      if (this.ship.hasShield) {
        this.ship.hasShield = false;
        this.ship.shieldTimer = 0;
      }
    }
  }

  _checkCollisions() {
    // 1. Projectiles vs Asteroids
    for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
      const p = this.projectiles[pi];
      if (!p.fromPlayer) continue;

      for (let ai = this.asteroids.length - 1; ai >= 0; ai--) {
        const a = this.asteroids[ai];
        if (circleIntersects(p.x, p.y, p.radius, a.x, a.y, a.radius)) {
          // Hit asteroid!
          this.projectiles.splice(pi, 1);
          this.asteroids.splice(ai, 1);

          this.audio.play('explosion');
          this.renderer.camera.shake(5, 0.2);

          // Points
          const pts = a.size === 'large' ? 20 : a.size === 'medium' ? 50 : 100;
          this.score += pts;

          // Split asteroid
          const smaller = a.split(() => this.rng.next());
          this.asteroids.push(...smaller);

          // Particles
          this.particles.burst(a.x, a.y, {
            count: a.size === 'large' ? 25 : 15,
            color: '#a0a0c0',
            speedMin: 40,
            speedMax: 160,
            lifeMin: 0.3,
            lifeMax: 0.7,
          });

          // Chance to drop power-up
          if (this.rng.next() < 0.12) {
            const types = /** @type {const} */ (['shield', 'triple', 'rapid']);
            const chosen = types[Math.floor(this.rng.next() * types.length)];
            this.powerUps.push(new PowerUp(a.x, a.y, chosen));
          }
          break;
        }
      }
    }

    // 2. Projectiles vs UFOs
    for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
      const p = this.projectiles[pi];
      if (!p.fromPlayer) continue;

      for (let ui = this.ufos.length - 1; ui >= 0; ui--) {
        const u = this.ufos[ui];
        if (circleIntersects(p.x, p.y, p.radius, u.x, u.y, u.radius)) {
          this.projectiles.splice(pi, 1);
          this.ufos.splice(ui, 1);

          this.audio.play('explosion');
          this.renderer.camera.shake(8, 0.3);
          const pts = u.type === 'small' ? 500 : 200;
          this.score += pts;

          this.particles.burst(u.x, u.y, {
            count: 35,
            color: '#ff3366',
            speedMin: 60,
            speedMax: 220,
            lifeMin: 0.4,
            lifeMax: 0.8,
          });

          // High chance of power-up
          if (this.rng.next() < 0.35) {
            const types = /** @type {const} */ (['shield', 'triple', 'rapid']);
            const chosen = types[Math.floor(this.rng.next() * types.length)];
            this.powerUps.push(new PowerUp(u.x, u.y, chosen));
          }
          break;
        }
      }
    }

    if (!this.ship) return;

    // 3. Ship vs PowerUps
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      if (circleIntersects(this.ship.x, this.ship.y, this.ship.radius, pu.x, pu.y, pu.radius)) {
        this.powerUps.splice(i, 1);
        this.audio.play('powerup');
        this.score += 150;

        if (pu.type === 'shield') {
          this.ship.hasShield = true;
          this.ship.shieldTimer = 12.0;
        } else if (pu.type === 'triple') {
          this.ship.hasTripleShot = true;
          this.ship.tripleShotTimer = 12.0;
        } else if (pu.type === 'rapid') {
          this.ship.hasRapidFire = true;
          this.ship.rapidFireTimer = 12.0;
        }

        this.particles.burst(this.ship.x, this.ship.y, {
          count: 20,
          color: '#39c5bb',
          speedMin: 40,
          speedMax: 120,
          lifeMin: 0.3,
          lifeMax: 0.5,
        });

        if (this.ctx?.achievements?.unlock) {
          this.ctx.achievements.unlock('drifter_powerup');
        }
      }
    }

    // 4. Ship vs Hazards (Asteroids, UFOs, Enemy Lasers)
    if (this.ship.invulnerableTimer > 0) return;

    let hit = false;
    for (const a of this.asteroids) {
      if (circleIntersects(this.ship.x, this.ship.y, this.ship.radius, a.x, a.y, a.radius)) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const u of this.ufos) {
        if (circleIntersects(this.ship.x, this.ship.y, this.ship.radius, u.x, u.y, u.radius)) {
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
        const p = this.projectiles[pi];
        if (!p.fromPlayer && circleIntersects(this.ship.x, this.ship.y, this.ship.radius, p.x, p.y, p.radius)) {
          hit = true;
          this.projectiles.splice(pi, 1);
          break;
        }
      }
    }

    if (hit) {
      if (this.ship.hasShield) {
        // Shield absorbs hit
        this.ship.hasShield = false;
        this.ship.shieldTimer = 0;
        this.ship.invulnerableTimer = 1.2;
        this.audio.play('hit');
        this.renderer.camera.shake(10, 0.3);
      } else {
        // Lost life
        this._destroyShip();
      }
    }
  }

  _destroyShip() {
    this.audio.play('explosion');
    this.renderer.camera.shake(18, 0.5);

    this.particles.burst(this.ship.x, this.ship.y, {
      count: 50,
      color: '#ff3838',
      speedMin: 60,
      speedMax: 260,
      lifeMin: 0.5,
      lifeMax: 1.0,
    });

    this.lives--;
    if (this.lives <= 0) {
      this._triggerGameOver();
    } else {
      // Respawn in center
      this.ship = new Ship(ARENA_W / 2, ARENA_H / 2);
    }
  }

  _triggerGameOver() {
    this.gameOver = true;
    this.loop.stop();
    this.audio.play('gameover');

    this.scores.submitScore(this.score, 'classic', { details: { wave: this.wave } }).then((res) => {
      const modal = createGameOverModal({
        score: this.score,
        isNewHigh: res.isNewHigh,
        rank: res.rank,
        xpEarned: Math.min(50, Math.max(10, Math.floor(this.score / 150))),
        onRestart: () => this.restart(),
        onQuit: () => this.onQuit?.(),
      });
      this.container.append(modal);
    });

    if (this.ctx?.achievements?.unlock) {
      if (this.score >= 10000) this.ctx.achievements.unlock('drifter_score_10k');
    }
  }

  togglePause() {
    if (this.gameOver) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.loop.pause();
      const modal = createPauseModal({
        onResume: () => this.togglePause(),
        onRestart: () => {
          this.isPaused = false;
          this.restart();
        },
        onQuit: () => {
          this.isPaused = false;
          this.onQuit?.();
        },
        audio: this.audio,
        title: 'VOID DRIFTER PAUSED',
      });
      this.container.append(modal);
    } else {
      this.loop.resume();
    }
  }

  restart() {
    this.loop.stop();
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.ship = new Ship(ARENA_W / 2, ARENA_H / 2);
    this.powerUps = [];
    this._startWave(1);
    this.loop.start();
  }

  render() {
    const ctx = this.renderer.ctx;
    ctx.clearRect(0, 0, ARENA_W, ARENA_H);

    // Deep space backdrop with vector stars
    ctx.fillStyle = '#05050b';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    // Camera transform with screen shake
    ctx.save();
    const cam = this.renderer.camera;
    ctx.translate(cam.shakeOffset.x, cam.shakeOffset.y);

    // Render powerups
    for (const pu of this.powerUps) {
      this._drawPowerUp(ctx, pu);
    }

    // Render asteroids (neon glow)
    ctx.save();
    ctx.strokeStyle = '#708090';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    for (const a of this.asteroids) {
      this._drawAsteroid(ctx, a);
    }
    ctx.restore();

    // Render UFOs
    for (const u of this.ufos) {
      this._drawUFO(ctx, u);
    }

    // Render projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.fromPlayer ? '#00f0ff' : '#ff3366';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Render Ship
    if (this.ship) {
      this._drawShip(ctx, this.ship);
    }

    // Particles
    this.particles.render(ctx);

    ctx.restore();

    // HUD (fixed screen space)
    this._drawHUD(ctx);
  }

  _drawShip(ctx, ship) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    // Flashing when invulnerable
    if (ship.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Neon Glow
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;

    // Sleek vector ship
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.stroke();

    // Cockpit
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.stroke();

    // Shield bubble
    if (ship.hasShield) {
      ctx.strokeStyle = '#39c5bb';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#39c5bb';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawAsteroid(ctx, a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotAngle);

    ctx.beginPath();
    const v = a.vertices;
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) {
      ctx.lineTo(v[i].x, v[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  _drawUFO(ctx, u) {
    ctx.save();
    ctx.translate(u.x, u.y);
    const color = u.type === 'small' ? '#ff3838' : '#ff9f1a';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Saucer shape
    ctx.beginPath();
    ctx.ellipse(0, 0, u.radius, u.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Dome
    ctx.beginPath();
    ctx.arc(0, -u.radius * 0.2, u.radius * 0.45, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  _drawPowerUp(ctx, pu) {
    ctx.save();
    ctx.translate(pu.x, pu.y);
    const color = pu.type === 'shield' ? '#39c5bb' : pu.type === 'triple' ? '#bc8cff' : '#f1c40f';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Pulsing diamond
    const s = 9 + Math.sin(Date.now() / 150) * 2;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pu.type[0].toUpperCase(), 0, 3);
    ctx.restore();
  }

  _drawHUD(ctx) {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(String(this.score), 24, 34);

    // Wave
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`WAVE ${this.wave}`, 24, 60);

    // Lives icons
    for (let i = 0; i < this.lives; i++) {
      const lx = ARENA_W - 30 - i * 22;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, 20);
      ctx.lineTo(lx - 6, 36);
      ctx.lineTo(lx, 32);
      ctx.lineTo(lx + 6, 36);
      ctx.closePath();
      ctx.stroke();
    }

    // Wave announcement banner
    if (this.waveBannerTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fillRect(0, ARENA_H / 2 - 40, ARENA_W, 80);
      ctx.strokeStyle = '#00f0ff';
      ctx.strokeRect(0, ARENA_H / 2 - 40, ARENA_W, 80);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.fillText(`— WAVE ${this.wave} —`, ARENA_W / 2, ARENA_H / 2 + 10);
      ctx.restore();
    }
  }

  dispose() {
    this.loop.stop();
    this.input.dispose();
  }
}
