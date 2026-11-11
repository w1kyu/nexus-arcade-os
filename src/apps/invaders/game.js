// @ts-check
import {
  GameAudio,
  GameLoop,
  GameRenderer,
  GameScoreService,
  InputManager,
  ParticleSystem,
  SeededRng,
  createGameOverModal,
  createPauseModal,
} from '../../games/engine/index.js';
import {
  BunkerShield,
  InvaderAlien,
  InvaderBoss,
  InvaderPlayer,
  InvaderPowerUp,
  InvaderProjectile,
} from './entities.js';

export const ARENA_W = 800;
export const ARENA_H = 600;

export class InvadersGame {
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
    this.particles = new ParticleSystem(300);
    this.scores = new GameScoreService('nexus.invaders', ctx);
    this.rng = new SeededRng();

    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.isPaused = false;
    this.elapsedTime = 0;

    // Entities
    this.player = new InvaderPlayer(ARENA_W / 2, 540);
    /** @type {InvaderAlien[]} */
    this.aliens = [];
    /** @type {BunkerShield[]} */
    this.bunkers = [];
    /** @type {InvaderBoss | null} */
    this.boss = null;
    /** @type {InvaderProjectile[]} */
    this.projectiles = [];
    /** @type {InvaderPowerUp[]} */
    this.powerUps = [];

    // Swarm march movement
    this.swarmDir = 1;
    this.swarmStepTimer = 0;
    this.alienShootTimer = 1.2;

    this._setupInput();
    this._startWave(1);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
    this.loop.start();
  }

  _setupInput() {
    this.input.bindAction('moveLeft', ['ArrowLeft', 'KeyA']);
    this.input.bindAction('moveRight', ['ArrowRight', 'KeyD']);
    this.input.bindAction('fire', ['Space', 'KeyJ']);
    this.input.bindAction('pause', ['Escape', 'KeyP']);
  }

  _startWave(waveNum) {
    this.wave = waveNum;
    this.projectiles = [];
    this.powerUps = [];
    this.aliens = [];
    this.boss = null;

    // Reset/init 4 bunkers
    this.bunkers = [
      new BunkerShield(120, 440),
      new BunkerShield(280, 440),
      new BunkerShield(440, 440),
      new BunkerShield(600, 440),
    ];

    if (waveNum % 5 === 0) {
      // Boss Wave!
      this.boss = new InvaderBoss(ARENA_W / 2, 100, waveNum);
    } else {
      // Alien grid: 5 rows x 10 cols
      for (let r = 0; r < 5; r++) {
        const type = r === 0 ? 0 : r < 3 ? 1 : 2;
        for (let c = 0; c < 10; c++) {
          const x = 140 + c * 52;
          const y = 80 + r * 40;
          this.aliens.push(new InvaderAlien(x, y, type));
        }
      }
    }
  }

  update(dt) {
    if (this.isPaused || this.gameOver) return;
    this.elapsedTime += dt;
    this.particles.update(dt);

    if (this.input.isActionJustPressed('pause')) {
      this.pause();
      return;
    }

    // Player update
    let moveDir = 0;
    if (this.input.isActionDown('moveLeft')) moveDir -= 1;
    if (this.input.isActionDown('moveRight')) moveDir += 1;
    this.player.update(dt, moveDir, ARENA_W);

    // Fire
    if (this.input.isActionDown('fire') && this.player.canFire()) {
      this.player.resetCooldown();
      this.audio.play('laser');

      if (this.player.powerUpType === 'triple') {
        this.projectiles.push(
          new InvaderProjectile(this.player.x, this.player.y - 12, -500, true),
          new InvaderProjectile(this.player.x - 12, this.player.y - 12, -480, true),
          new InvaderProjectile(this.player.x + 12, this.player.y - 12, -480, true),
        );
      } else {
        this.projectiles.push(new InvaderProjectile(this.player.x, this.player.y - 12, -520, true));
      }
    }

    // Boss Wave Update
    if (this.boss) {
      this.boss.update(dt, ARENA_W);
      if (this.boss.fireTimer <= 0) {
        this.boss.fireTimer = 0.8;
        this.projectiles.push(
          new InvaderProjectile(this.boss.x - 20, this.boss.y + 20, 260, false),
          new InvaderProjectile(this.boss.x + 20, this.boss.y + 20, 260, false),
        );
      }
    } else {
      // Swarm March Update
      this._updateSwarm(dt);
    }

    // Projectiles
    this._updateProjectiles(dt);

    // Power-ups
    for (const pup of this.powerUps) {
      pup.update(dt);
      if (Math.hypot(pup.x - this.player.x, pup.y - this.player.y) < 26) {
        pup.active = false;
        this.player.powerUpType = pup.type;
        this.player.powerUpTimer = 10.0;
        this.audio.play('victory');
        if (pup.type === 'shield' && this.lives < 4) this.lives++;
      }
    }
    this.powerUps = this.powerUps.filter((p) => p.active && p.y < ARENA_H);

    // Check Wave Win
    if (this.boss) {
      if (!this.boss.alive) {
        this.ctx.achievements?.unlock('invaders_boss_slayer');
        this._startWave(this.wave + 1);
      }
    } else if (this.aliens.every((a) => !a.alive)) {
      if (this.bunkers.every((b) => b.isIntact)) {
        this.ctx.achievements?.unlock('invaders_shield_keeper');
      }
      if (this.wave >= 5) this.ctx.achievements?.unlock('invaders_wave_5');
      this._startWave(this.wave + 1);
    }
  }

  _updateSwarm(dt) {
    const liveAliens = this.aliens.filter((a) => a.alive);
    if (!liveAliens.length) return;

    // Speed scales with fewer aliens
    const speed = 25 + (50 - liveAliens.length) * 3 + this.wave * 12;
    let hitEdge = false;

    for (const alien of liveAliens) {
      alien.x += this.swarmDir * speed * dt;
      if (alien.x < 30 || alien.x > ARENA_W - 30) hitEdge = true;
      if (alien.y > 510) {
        this._endGame();
        return;
      }
    }

    if (hitEdge) {
      this.swarmDir = -this.swarmDir;
      for (const alien of liveAliens) {
        alien.y += 18;
      }
    }

    // Alien bombing
    this.alienShootTimer -= dt;
    if (this.alienShootTimer <= 0) {
      this.alienShootTimer = Math.max(0.4, 1.4 - this.wave * 0.1);
      const shooters = liveAliens.filter(() => Math.random() < 0.35);
      const shooter = shooters[Math.floor(Math.random() * shooters.length)] || liveAliens[0];
      if (shooter) {
        this.projectiles.push(new InvaderProjectile(shooter.x, shooter.y + 12, 280, false));
      }
    }
  }

  _updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.update(dt);
      if (p.y < 0 || p.y > ARENA_H) {
        p.active = false;
        continue;
      }

      // Bunker collisions
      for (const b of this.bunkers) {
        if (b.hitTest(p.x, p.y)) {
          p.active = false;
          this.particles.burst(p.x, p.y, '#00f0ff', 6);
          break;
        }
      }
      if (!p.active) continue;

      if (p.isPlayer) {
        // Player shot hitting aliens
        for (const alien of this.aliens) {
          if (alien.alive && Math.abs(p.x - alien.x) < alien.width / 2 && Math.abs(p.y - alien.y) < alien.height / 2) {
            alien.alive = false;
            p.active = false;
            this.score += alien.score;
            this.particles.burst(alien.x, alien.y, '#00ff88', 12);
            this.audio.play('explosion');

            // Drop power-up chance
            if (Math.random() < 0.08) {
              const types = /** @type {const} */ (['shield', 'rapid', 'triple']);
              const pick = types[Math.floor(Math.random() * types.length)];
              this.powerUps.push(new InvaderPowerUp(alien.x, alien.y, pick));
            }
            break;
          }
        }

        // Player shot hitting Boss
        if (this.boss && this.boss.alive) {
          if (Math.abs(p.x - this.boss.x) < this.boss.width / 2 && Math.abs(p.y - this.boss.y) < this.boss.height / 2) {
            p.active = false;
            this.boss.health--;
            this.particles.burst(p.x, p.y, '#ff3366', 8);
            this.audio.play('laser');
            if (this.boss.health <= 0) {
              this.boss.alive = false;
              this.score += 2500;
              this.particles.burst(this.boss.x, this.boss.y, '#ffd700', 36);
              this.audio.play('victory');
            }
          }
        }
      } else {
        // Alien shot hitting player
        if (
          this.player.respawnTimer <= 0 &&
          Math.abs(p.x - this.player.x) < this.player.width / 2 &&
          Math.abs(p.y - this.player.y) < this.player.height / 2
        ) {
          p.active = false;
          this.lives--;
          this.player.respawnTimer = 2.0;
          this.particles.burst(this.player.x, this.player.y, '#ff2a55', 24);
          this.audio.play('gameover');

          if (this.lives <= 0) {
            this._endGame();
            return;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.active);
  }

  _endGame() {
    this.gameOver = true;
    if (this.score >= 10000) {
      this.ctx.achievements?.unlock('invaders_score_10k');
    }
    this.scores.submitScore(this.score, 'arcade', { details: { wave: this.wave } }).then((res) => {
      const modal = createGameOverModal({
        score: this.score,
        rank: res.rank,
        isNewHigh: res.isNewHigh,
        xpEarned: Math.min(50, Math.max(5, Math.floor(this.score / 50))),
        onRestart: () => this.restart(),
        onQuit: this.onQuit,
      });
      this.container.append(modal);
    });
  }

  pause() {
    this.isPaused = true;
    const modal = createPauseModal({
      audio: this.audio,
      onResume: () => {
        this.isPaused = false;
      },
      onRestart: () => this.restart(),
      onQuit: this.onQuit,
    });
    this.container.append(modal);
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.isPaused = false;
    this.player = new InvaderPlayer(ARENA_W / 2, 540);
    this._startWave(1);
  }

  render() {
    const ctx = this.renderer.ctx;
    this.renderer.clear('#040711');

    // Draw Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137) % ARENA_W;
      const sy = (i * 223 + this.elapsedTime * 20) % ARENA_H;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Draw Bunkers
    for (const b of this.bunkers) {
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          const hp = b.blocks[r][c];
          if (hp > 0) {
            ctx.fillStyle = hp === 3 ? '#00f0ff' : hp === 2 ? '#0284c7' : '#0369a1';
            ctx.fillRect(b.x + c * b.cellW + 1, b.y + r * b.cellH + 1, b.cellW - 2, b.cellH - 2);
          }
        }
      }
    }

    // Draw Aliens
    for (const a of this.aliens) {
      if (!a.alive) continue;
      ctx.fillStyle = a.type === 0 ? '#ff3366' : a.type === 1 ? '#00f0ff' : '#00ff88';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.width / 2, 0, Math.PI * 2);
      ctx.fill();
      // Antennae
      ctx.fillRect(a.x - 8, a.y - 14, 3, 6);
      ctx.fillRect(a.x + 5, a.y - 14, 3, 6);
    }

    // Draw Boss
    if (this.boss && this.boss.alive) {
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(
        this.boss.x - this.boss.width / 2,
        this.boss.y - this.boss.height / 2,
        this.boss.width,
        this.boss.height,
      );
      // Health Bar
      const hpPct = this.boss.health / this.boss.maxHealth;
      ctx.fillStyle = '#334155';
      ctx.fillRect(this.boss.x - 40, this.boss.y - 30, 80, 6);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(this.boss.x - 40, this.boss.y - 30, 80 * hpPct, 6);
    }

    // Draw Player
    if (this.player.respawnTimer <= 0 || Math.floor(this.elapsedTime * 8) % 2 === 0) {
      ctx.fillStyle = this.player.powerUpType ? '#ffd700' : '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y - 12);
      ctx.lineTo(this.player.x + 18, this.player.y + 10);
      ctx.lineTo(this.player.x - 18, this.player.y + 10);
      ctx.closePath();
      ctx.fill();
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.isPlayer ? '#00f0ff' : '#ff3366';
      ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    }

    // Draw Power-ups
    for (const pup of this.powerUps) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(pup.x, pup.y, pup.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    this.particles.render(ctx);

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.fillText(`SCORE: ${this.score}`, 20, 30);
    ctx.fillText(`WAVE: ${this.wave}`, ARENA_W / 2 - 40, 30);
    ctx.fillText(`LIVES: ${'▲'.repeat(Math.max(0, this.lives))}`, ARENA_W - 130, 30);
  }

  dispose() {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
  }
}
