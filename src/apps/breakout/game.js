// @ts-check
// Breakout continuous collision physics, block damage, and power-up system

import {
  GameAudio,
  GameLoop,
  GameRenderer,
  GameScoreService,
  InputManager,
  ParticleSystem,
  SeededRng,
  aabbIntersects,
  circleAabbIntersects,
  createGameOverModal,
  createPauseModal,
} from '../../games/engine/index.js';
import { COLS, ROWS, createBreakoutLevels } from './levels.js';

export const ARENA_W = 600;
export const ARENA_H = 650;

/**
 * @typedef {'wide' | 'narrow' | 'multiball' | 'laser' | 'sticky' | 'slow' | 'life' | 'fireball'} BreakoutPowerUp
 * @typedef {{ x: number, y: number, vx: number, vy: number, radius: number, stuck: boolean, stuckOffset: number, fireball: boolean }} Ball
 * @typedef {{ r: number, c: number, type: number, health: number, maxHealth: number, x: number, y: number, w: number, h: number }} Block
 * @typedef {{ x: number, y: number, vy: number, type: BreakoutPowerUp }} FallingPowerUp
 * @typedef {{ x: number, y: number, vy: number }} LaserBeam
 */

export const POWER_UP_CONFIGS = {
  wide: { color: '#00f0ff', label: 'Wide Paddle' },
  narrow: { color: '#e74c3c', label: 'Narrow Paddle' },
  multiball: { color: '#f1c40f', label: 'Multi-Ball' },
  laser: { color: '#e056fd', label: 'Laser Blaster' },
  sticky: { color: '#2ecc71', label: 'Sticky Paddle' },
  slow: { color: '#3498db', label: 'Slow Ball' },
  life: { color: '#ff3366', label: 'Extra Life' },
  fireball: { color: '#ff793f', label: 'Fireball' },
};

export class BreakoutGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} [options]
   * @param {number} [options.startLevel]
   * @param {number[][]} [options.customLayout]
   * @param {() => void} [options.onQuit]
   */
  constructor(canvas, container, ctx, { startLevel = 1, customLayout, onQuit } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = ctx;
    this.currentLevelIndex = startLevel - 1;
    this.customLayout = customLayout;
    this.onQuit = onQuit;

    this.renderer = new GameRenderer(canvas, { virtualWidth: ARENA_W, virtualHeight: ARENA_H, letterbox: true });
    this.audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
    this.input = new InputManager(container, { renderer: this.renderer });
    this.particles = new ParticleSystem(400);
    this.scores = new GameScoreService('nexus.breakout', ctx);
    this.rng = new SeededRng();

    this.levels = createBreakoutLevels();

    // Game stats
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.levelWon = false;
    this.elapsedTime = 0;

    // Paddle
    this.paddleWidth = 90;
    this.paddleHeight = 14;
    this.paddleX = (ARENA_W - this.paddleWidth) / 2;
    this.paddleY = ARENA_H - 45;
    this.paddleSpeed = 500;

    // Balls
    this.baseBallSpeed = 360;
    this.maxBallSpeed = 620;
    /** @type {Ball[]} */
    this.balls = [];

    // Blocks
    /** @type {Block[]} */
    this.blocks = [];
    this.blockW = 54;
    this.blockH = 20;
    this.blockPadding = 4;
    this.blockOffsetX = (ARENA_W - (COLS * (this.blockW + this.blockPadding) - this.blockPadding)) / 2;
    this.blockOffsetY = 60;

    // Power-ups and lasers
    /** @type {FallingPowerUp[]} */
    this.fallingPowerUps = [];
    /** @type {LaserBeam[]} */
    this.lasers = [];
    this.laserTimer = 0;
    /** @type {Record<string, number>} */
    this.activePowerUps = {};

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
      focusTarget: container,
    });

    this._loadLevel(this.currentLevelIndex);
    this.loop.start();
  }

  /**
   * Loads level layout
   * @param {number} levelIdx
   */
  _loadLevel(levelIdx) {
    this.currentLevelIndex = levelIdx;
    this.blocks = [];
    this.fallingPowerUps = [];
    this.lasers = [];
    this.activePowerUps = {};
    this.paddleWidth = 90;

    const layout =
      this.customLayout ||
      (this.levels[levelIdx % this.levels.length]
        ? this.levels[levelIdx % this.levels.length].layout
        : this.levels[0].layout);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = layout[r][c];
        if (type > 0) {
          const maxHealth = type === 2 ? 2 : type === 3 ? 3 : 1;
          this.blocks.push({
            r,
            c,
            type,
            health: maxHealth,
            maxHealth,
            x: this.blockOffsetX + c * (this.blockW + this.blockPadding),
            y: this.blockOffsetY + r * (this.blockH + this.blockPadding),
            w: this.blockW,
            h: this.blockH,
          });
        }
      }
    }

    this._resetPaddleAndBall();
  }

  _resetPaddleAndBall() {
    this.paddleX = (ARENA_W - this.paddleWidth) / 2;
    this.balls = [
      {
        x: this.paddleX + this.paddleWidth / 2,
        y: this.paddleY - 8,
        vx: 0,
        vy: -this.baseBallSpeed,
        radius: 6,
        stuck: true,
        stuckOffset: this.paddleWidth / 2,
        fireball: false,
      },
    ];
  }

  /**
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    if (this.gameOver) {
      this.input.update();
      return;
    }

    this.elapsedTime += dt;
    this.particles.update(dt);
    this.renderer.camera.update(dt);

    // Pause handling
    if (this.input.justPressed('pause')) {
      this.loop.pause();
      const modal = createPauseModal({
        onResume: () => this.loop.resume(),
        onRestart: () => this.restart(),
        onQuit: () => {
          this.dispose();
          this.onQuit?.();
        },
        audio: this.audio,
      });
      this.container.append(modal);
      return;
    }

    // Paddle movement
    let moveDir = 0;
    if (this.input.isDown('left')) moveDir -= 1;
    if (this.input.isDown('right')) moveDir += 1;
    const axisX = this.input.getAxis('horizontal');
    if (Math.abs(axisX) > 0.2) moveDir = axisX;

    this.paddleX += moveDir * this.paddleSpeed * dt;
    // Mouse / touch follow if pointer moved
    if (this.input.pointerDown) {
      this.paddleX = this.input.pointerPos.x - this.paddleWidth / 2;
    }

    // Clamp paddle to arena boundaries
    this.paddleX = Math.max(10, Math.min(ARENA_W - this.paddleWidth - 10, this.paddleX));

    // Power-up durations
    for (const key of Object.keys(this.activePowerUps)) {
      this.activePowerUps[key] -= dt;
      if (this.activePowerUps[key] <= 0) {
        delete this.activePowerUps[key];
        if (key === 'wide' || key === 'narrow') {
          this.paddleWidth = 90;
        }
      }
    }

    // Laser blaster
    if (this.activePowerUps.laser) {
      this.laserTimer += dt;
      if ((this.input.isDown('action') || this.laserTimer >= 0.4) && this.laserTimer >= 0.2) {
        this.laserTimer = 0;
        this.audio.play('laser');
        this.lasers.push({ x: this.paddleX + 10, y: this.paddleY - 4, vy: -550 });
        this.lasers.push({ x: this.paddleX + this.paddleWidth - 10, y: this.paddleY - 4, vy: -550 });
      }
    }

    // Update lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y += l.vy * dt;
      if (l.y < 0) {
        this.lasers.splice(i, 1);
        continue;
      }
      // Laser-block collision
      for (const block of this.blocks) {
        if (block.type !== 4 && aabbIntersects({ x: l.x - 2, y: l.y - 6, width: 4, height: 12 }, block)) {
          this.lasers.splice(i, 1);
          this._damageBlock(block);
          break;
        }
      }
    }

    // Launch stuck balls on Action
    if (this.input.justPressed('action')) {
      for (const b of this.balls) {
        if (b.stuck) {
          b.stuck = false;
          b.vx = this.rng.range(-100, 100);
          b.vy = -this.baseBallSpeed;
          this.audio.play('jump');
        }
      }
    }

    // Continuous ball movement and collisions (sub-stepping to avoid tunneling)
    this._updateBalls(dt);

    // Update falling power-ups
    for (let i = this.fallingPowerUps.length - 1; i >= 0; i--) {
      const p = this.fallingPowerUps[i];
      p.y += p.vy * dt;

      // Paddle pickup check
      const paddleBox = { x: this.paddleX, y: this.paddleY, width: this.paddleWidth, height: this.paddleHeight };
      if (aabbIntersects({ x: p.x - 12, y: p.y - 12, width: 24, height: 24 }, paddleBox)) {
        this._collectPowerUp(p.type);
        this.fallingPowerUps.splice(i, 1);
        continue;
      }

      if (p.y > ARENA_H + 20) {
        this.fallingPowerUps.splice(i, 1);
      }
    }

    // Check level clear (all destructible blocks destroyed)
    const destructibleLeft = this.blocks.filter((b) => b.type !== 4).length;
    if (destructibleLeft === 0 && !this.levelWon) {
      this._winLevel();
    }

    this.input.update();
  }

  /**
   * Sub-stepped continuous collision ball simulation
   * @param {number} dt
   */
  _updateBalls(dt) {
    const subSteps = 4;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const b = this.balls[i];

        if (b.stuck) {
          b.x = this.paddleX + b.stuckOffset;
          b.y = this.paddleY - b.radius - 1;
          continue;
        }

        // Apply fireball status
        b.fireball = !!this.activePowerUps.fireball;

        b.x += b.vx * subDt;
        b.y += b.vy * subDt;

        // Arena wall bounces
        if (b.x - b.radius <= 0) {
          b.x = b.radius;
          b.vx = Math.abs(b.vx);
          this.audio.play('hit');
        } else if (b.x + b.radius >= ARENA_W) {
          b.x = ARENA_W - b.radius;
          b.vx = -Math.abs(b.vx);
          this.audio.play('hit');
        }

        if (b.y - b.radius <= 0) {
          b.y = b.radius;
          b.vy = Math.abs(b.vy);
          this.audio.play('hit');
        }

        // Paddle collision with angle deflection
        const paddleBox = { x: this.paddleX, y: this.paddleY, width: this.paddleWidth, height: this.paddleHeight };
        if (circleAabbIntersects(b, paddleBox) && b.vy > 0) {
          if (this.activePowerUps.sticky) {
            b.stuck = true;
            b.stuckOffset = b.x - this.paddleX;
            this.audio.play('blip');
            continue;
          }

          // Angle control: hit factor from -1 (left edge) to 0 (center) to +1 (right edge)
          const hitFactor = (b.x - (this.paddleX + this.paddleWidth / 2)) / (this.paddleWidth / 2);
          const maxBounceAngle = (70 * Math.PI) / 180;
          const bounceAngle = hitFactor * maxBounceAngle;

          // Increase ball speed by 2% per paddle bounce up to max speed
          const currentSpeed = Math.hypot(b.vx, b.vy);
          const newSpeed = Math.min(this.maxBallSpeed, currentSpeed * 1.02);

          b.vx = Math.sin(bounceAngle) * newSpeed;
          b.vy = -Math.cos(bounceAngle) * newSpeed;
          b.y = this.paddleY - b.radius - 1;

          this.audio.play('jump');
          this.particles.emit({
            x: b.x,
            y: b.y,
            count: 10,
            color: '#00f0ff',
            spread: Math.PI,
            angle: -Math.PI / 2,
          });
        }

        // Block collisions
        for (let j = this.blocks.length - 1; j >= 0; j--) {
          const block = this.blocks[j];
          if (circleAabbIntersects(b, block)) {
            // Collision response
            if (!b.fireball || block.type === 4) {
              // Determine bounce normal
              const prevX = b.x - b.vx * subDt;

              if (prevX + b.radius <= block.x || prevX - b.radius >= block.x + block.w) {
                b.vx *= -1;
              } else {
                b.vy *= -1;
              }
            }

            this._damageBlock(block);
            break;
          }
        }

        // Pit bottom check
        if (b.y - b.radius > ARENA_H) {
          this.balls.splice(i, 1);
        }
      }
    }

    // Check life loss if all balls are lost
    if (this.balls.length === 0) {
      this.lives--;
      this.audio.play('hit');
      this.renderer.camera.shake(8, 0.3);

      if (this.lives <= 0) {
        this._endGame();
      } else {
        this._resetPaddleAndBall();
      }
    }
  }

  /**
   * Damages or destroys a block
   * @param {Block} block
   */
  _damageBlock(block) {
    if (block.type === 4) {
      // Unbreakable
      this.audio.play('hit');
      return;
    }

    block.health--;
    this.score += 50;

    // Achievements check
    this.scores.unlockAchievement('breakout_first_block');
    if (this.score >= 5000) this.scores.unlockAchievement('breakout_score_5000');

    if (block.health <= 0) {
      this._destroyBlock(block);
    } else {
      this.audio.play('hit');
      this.particles.emit({
        x: block.x + block.w / 2,
        y: block.y + block.h / 2,
        count: 8,
        color: '#f39c12',
      });
    }
  }

  /**
   * Destroys block and triggers explosions/power-ups
   * @param {Block} block
   */
  _destroyBlock(block) {
    const idx = this.blocks.indexOf(block);
    if (idx >= 0) this.blocks.splice(idx, 1);

    this.particles.emit({
      x: block.x + block.w / 2,
      y: block.y + block.h / 2,
      count: 20,
      color: ['#00f0ff', '#ff00aa', '#ffdd00'],
    });

    if (block.type === 5) {
      // Explosive: chain reaction to adjacent blocks!
      this.audio.play('explosion');
      this.renderer.camera.shake(10, 0.35);
      const explosionBox = {
        x: block.x - block.w - 5,
        y: block.y - block.h - 5,
        width: block.w * 3 + 10,
        height: block.h * 3 + 10,
      };
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const adj = this.blocks[i];
        if (adj.type !== 4 && aabbIntersects(adj, explosionBox)) {
          this._destroyBlock(adj);
        }
      }
    } else if (block.type === 6 || Math.random() < 0.2) {
      // Spawn power-up drop
      const types = /** @type {BreakoutPowerUp[]} */ ([
        'wide',
        'multiball',
        'laser',
        'sticky',
        'slow',
        'life',
        'fireball',
      ]);
      const type = this.rng.choice(types);
      this.fallingPowerUps.push({
        x: block.x + block.w / 2,
        y: block.y + block.h / 2,
        vy: 140,
        type,
      });
      this.audio.play('coin');
    } else {
      this.audio.play('coin');
    }
  }

  /**
   * Applies picked up power-up
   * @param {BreakoutPowerUp} type
   */
  _collectPowerUp(type) {
    this.audio.play('powerup');
    this.activePowerUps[type] = 12;

    switch (type) {
      case 'wide':
        this.paddleWidth = 140;
        break;
      case 'narrow':
        this.paddleWidth = 60;
        break;
      case 'multiball': {
        const mainBall = this.balls[0] || {
          x: this.paddleX + this.paddleWidth / 2,
          y: this.paddleY - 8,
          vx: 0,
          vy: -this.baseBallSpeed,
          radius: 6,
          stuck: false,
          stuckOffset: 0,
          fireball: false,
        };
        const speed = Math.hypot(mainBall.vx, mainBall.vy) || this.baseBallSpeed;
        this.balls.push({
          x: mainBall.x,
          y: mainBall.y,
          vx: -speed * 0.7,
          vy: -speed * 0.7,
          radius: 6,
          stuck: false,
          stuckOffset: 0,
          fireball: false,
        });
        this.balls.push({
          x: mainBall.x,
          y: mainBall.y,
          vx: speed * 0.7,
          vy: -speed * 0.7,
          radius: 6,
          stuck: false,
          stuckOffset: 0,
          fireball: false,
        });
        if (this.balls.length >= 5) {
          this.scores.unlockAchievement('breakout_multiball_master');
        }
        break;
      }
      case 'slow':
        for (const b of this.balls) {
          b.vx = (b.vx / Math.hypot(b.vx, b.vy)) * this.baseBallSpeed;
          b.vy = (b.vy / Math.hypot(b.vx, b.vy)) * this.baseBallSpeed;
        }
        break;
      case 'life':
        this.lives++;
        break;
    }
  }

  _winLevel() {
    this.levelWon = true;
    this.audio.play('victory');
    this.score += 1000;

    if (this.currentLevelIndex + 1 >= 5) this.scores.unlockAchievement('breakout_level_5');
    if (this.currentLevelIndex + 1 >= 30) this.scores.unlockAchievement('breakout_level_30');

    setTimeout(() => {
      this.levelWon = false;
      this._loadLevel(this.currentLevelIndex + 1);
    }, 1500);
  }

  async _endGame() {
    this.gameOver = true;
    this.loop.pause();
    this.audio.play('gameover');

    const { rank, isNewHigh } = await this.scores.submitScore(this.score, 'classic');
    await this.scores.recordTime(this.elapsedTime);

    const xpEarned = Math.min(50, Math.max(10, Math.floor(this.score / 60)));

    const modal = createGameOverModal({
      score: this.score,
      isNewHigh,
      rank,
      xpEarned,
      onRestart: () => this.restart(),
      onQuit: () => {
        this.dispose();
        this.onQuit?.();
      },
    });
    this.container.append(modal);
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.levelWon = false;
    this.elapsedTime = 0;
    this._loadLevel(0);
    this.loop.resume();
  }

  /**
   * @param {number} _alpha
   */
  render(_alpha) {
    const ctx = this.renderer.ctx;
    this.renderer.beginFrame('#070913');

    ctx.save();
    ctx.translate(this.renderer.camera.shakeOffset.x, this.renderer.camera.shakeOffset.y);

    // Draw blocks
    for (const b of this.blocks) {
      let color = '#00f0ff';
      if (b.type === 2) color = b.health === 1 ? '#e67e22' : '#f39c12';
      else if (b.type === 3) color = b.health === 1 ? '#8e44ad' : '#9b59b6';
      else if (b.type === 4) color = '#7f8c8d';
      else if (b.type === 5) color = '#e74c3c';
      else if (b.type === 6) color = '#f1c40f';

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = b.type === 6 ? 12 : 6;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();

      // Damage crack line on multi-hit
      if (b.health < b.maxHealth) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x + 6, b.y + 4);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h - 4);
        ctx.lineTo(b.x + b.w - 6, b.y + 6);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    // Draw paddle
    ctx.fillStyle = this.activePowerUps.laser ? '#e056fd' : '#00f0ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(this.paddleX, this.paddleY, this.paddleWidth, this.paddleHeight, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw lasers
    ctx.fillStyle = '#ff00aa';
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 10;
    for (const l of this.lasers) {
      ctx.fillRect(l.x - 2, l.y - 6, 4, 12);
    }
    ctx.shadowBlur = 0;

    // Draw falling power-ups
    for (const p of this.fallingPowerUps) {
      const cfg = POWER_UP_CONFIGS[p.type];
      ctx.fillStyle = cfg.color;
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(p.x - 12, p.y - 8, 24, 16, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw balls
    for (const b of this.balls) {
      ctx.fillStyle = b.fireball ? '#ff793f' : '#ffffff';
      ctx.shadowColor = b.fireball ? '#ff793f' : '#00f0ff';
      ctx.shadowBlur = b.fireball ? 16 : 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Render particles
    this.particles.render(ctx);

    // Draw HUD
    this.renderer.drawText(`Score: ${this.score}`, 16, 24, { size: 16, bold: true, color: '#ffffff' });
    this.renderer.drawText(`Level ${this.currentLevelIndex + 1}/30`, ARENA_W / 2, 24, {
      size: 16,
      bold: true,
      align: 'center',
      color: '#ffd700',
    });
    this.renderer.drawText(`Lives: ${'♥ '.repeat(this.lives)}`, ARENA_W - 16, 24, {
      size: 16,
      bold: true,
      align: 'right',
      color: '#ff3366',
    });

    if (this.balls.some((b) => b.stuck)) {
      this.renderer.drawText('Press SPACE or Action to Launch', ARENA_W / 2, ARENA_H - 80, {
        size: 14,
        align: 'center',
        color: '#8b9bb4',
      });
    }

    if (this.levelWon) {
      this.renderer.drawText('LEVEL CLEAR!', ARENA_W / 2, ARENA_H / 2, {
        size: 32,
        bold: true,
        align: 'center',
        color: '#00ff88',
        shadowColor: '#00ff88',
        shadowBlur: 16,
      });
    }

    ctx.restore();
    this.renderer.endFrame();
  }

  dispose() {
    this.loop.dispose();
    this.input.dispose();
    this.audio.dispose();
  }
}
