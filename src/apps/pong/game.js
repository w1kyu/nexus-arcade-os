// @ts-check
// Neon Pong game engine implementation

import {
  GameAudio,
  GameLoop,
  GameRenderer,
  GameScoreService,
  InputManager,
  ParticleSystem,
  SeededRng,
  circleAabbIntersects,
  circleIntersects,
  createGameOverModal,
  createPauseModal,
} from '../../games/engine/index.js';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BALL_RADIUS,
  PADDLE_BASE_HEIGHT,
  PADDLE_WIDTH,
  WINNING_SCORE,
  calculatePaddleBounce,
} from './physics.js';

/**
 * @typedef {'casual' | 'skilled' | 'master'} PongAiDifficulty
 * @typedef {'shield' | 'multiball' | 'extend' | 'speed'} PongPowerUpType
 */

export class PongGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} [options]
   * @param {'ai' | 'pvp'} [options.mode]
   * @param {PongAiDifficulty} [options.aiDifficulty]
   * @param {boolean} [options.powerUpsEnabled]
   * @param {() => void} [options.onQuit]
   */
  constructor(canvas, container, ctx, { mode = 'ai', aiDifficulty = 'skilled', powerUpsEnabled = true, onQuit } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = ctx;
    this.mode = mode;
    this.aiDifficulty = aiDifficulty;
    this.powerUpsEnabled = powerUpsEnabled;
    this.onQuit = onQuit;

    this.renderer = new GameRenderer(canvas, {
      virtualWidth: ARENA_WIDTH,
      virtualHeight: ARENA_HEIGHT,
      letterbox: true,
    });
    this.audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
    this.input = new InputManager(container, { renderer: this.renderer });
    this.particles = new ParticleSystem(350);
    this.scores = new GameScoreService('nexus.pong', ctx);
    this.rng = new SeededRng();

    // Game stats
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.rally = 0;
    this.maxRally = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.elapsedTime = 0;

    // Paddle 1 (Cyan)
    this.p1 = {
      x: 35,
      y: (ARENA_HEIGHT - PADDLE_BASE_HEIGHT) / 2,
      w: PADDLE_WIDTH,
      h: PADDLE_BASE_HEIGHT,
      vy: 0,
      prevY: (ARENA_HEIGHT - PADDLE_BASE_HEIGHT) / 2,
      speed: 480,
      hasShield: false,
    };

    // Paddle 2 (Magenta)
    this.p2 = {
      x: ARENA_WIDTH - 35 - PADDLE_WIDTH,
      y: (ARENA_HEIGHT - PADDLE_BASE_HEIGHT) / 2,
      w: PADDLE_WIDTH,
      h: PADDLE_BASE_HEIGHT,
      vy: 0,
      prevY: (ARENA_HEIGHT - PADDLE_BASE_HEIGHT) / 2,
      speed: aiDifficulty === 'master' ? 480 : aiDifficulty === 'skilled' ? 360 : 250,
      hasShield: false,
    };

    // Active Balls
    /** @type {Array<{ x: number, y: number, vx: number, vy: number, radius: number }>} */
    this.balls = [];

    // Active Power-ups
    /** @type {Array<{ x: number, y: number, type: PongPowerUpType, radius: number, life: number }>} */
    this.powerUps = [];
    this.powerUpSpawnTimer = 8;

    this._setupInput();
    this._serveBall(1);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (_alpha) => this.render(),
    });
    this.loop.start();
  }

  _setupInput() {
    this.input.bindAction('p1Up', ['KeyW']);
    this.input.bindAction('p1Down', ['KeyS']);
    this.input.bindAction('p2Up', ['ArrowUp']);
    this.input.bindAction('p2Down', ['ArrowDown']);
    this.input.bindAction('pause', ['Escape', 'KeyP']);
  }

  _serveBall(serveToPlayer = 1) {
    const dir = serveToPlayer === 1 ? -1 : 1;
    const baseSpeed = 380;
    const angle = (this.rng.next() - 0.5) * 0.6; // Slight random angle
    this.balls = [
      {
        x: ARENA_WIDTH / 2,
        y: ARENA_HEIGHT / 2,
        vx: Math.cos(angle) * baseSpeed * dir,
        vy: Math.sin(angle) * baseSpeed,
        radius: BALL_RADIUS,
      },
    ];
    this.rally = 0;
  }

  update(dt) {
    if (this.isPaused || this.gameOver) return;

    this.elapsedTime += dt;
    this.particles.update(dt);
    this.renderer.camera.update(dt);

    if (this.input.isActionJustPressed('pause')) {
      this.togglePause();
      return;
    }

    // P1 Controls (W / S or touch/arrows in single player if preferred)
    this.p1.prevY = this.p1.y;
    let p1Dir = 0;
    if (this.input.isActionDown('p1Up')) p1Dir = -1;
    else if (this.input.isActionDown('p1Down')) p1Dir = 1;
    // In single player, also accept ArrowUp/ArrowDown for P1
    if (this.mode === 'ai') {
      if (this.input.isActionDown('p2Up')) p1Dir = -1;
      else if (this.input.isActionDown('p2Down')) p1Dir = 1;
    }

    this.p1.y += p1Dir * this.p1.speed * dt;
    this.p1.y = Math.max(10, Math.min(ARENA_HEIGHT - this.p1.h - 10, this.p1.y));
    this.p1.vy = (this.p1.y - this.p1.prevY) / dt;

    // P2 Controls (PVP keys or AI)
    this.p2.prevY = this.p2.y;
    if (this.mode === 'pvp') {
      let p2Dir = 0;
      if (this.input.isActionDown('p2Up')) p2Dir = -1;
      else if (this.input.isActionDown('p2Down')) p2Dir = 1;
      this.p2.y += p2Dir * this.p2.speed * dt;
    } else {
      this._updateAI(dt);
    }
    this.p2.y = Math.max(10, Math.min(ARENA_HEIGHT - this.p2.h - 10, this.p2.y));
    this.p2.vy = (this.p2.y - this.p2.prevY) / dt;

    // Update power-up spawning
    if (this.powerUpsEnabled) {
      this.powerUpSpawnTimer -= dt;
      if (this.powerUpSpawnTimer <= 0 && this.powerUps.length < 2) {
        this.powerUpSpawnTimer = 10 + this.rng.next() * 8;
        const types = /** @type {const} */ (['multiball', 'extend', 'speed', 'shield']);
        const chosen = types[Math.floor(this.rng.next() * types.length)];
        this.powerUps.push({
          x: ARENA_WIDTH / 2 + (this.rng.next() - 0.5) * 200,
          y: 80 + this.rng.next() * (ARENA_HEIGHT - 160),
          type: chosen,
          radius: 14,
          life: 14.0,
        });
      }

      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const pu = this.powerUps[i];
        pu.life -= dt;
        if (pu.life <= 0) this.powerUps.splice(i, 1);
      }
    }

    // Update Balls
    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const b = this.balls[bi];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Ball particle trail
      this.particles.burst(b.x, b.y, {
        count: 1,
        color: b.vx > 0 ? '#00f0ff' : '#ff3399',
        speedMin: 5,
        speedMax: 20,
        lifeMin: 0.1,
        lifeMax: 0.2,
      });

      // Top / Bottom wall reflection
      if (b.y - b.radius <= 0) {
        b.y = b.radius;
        b.vy = Math.abs(b.vy);
        this.audio.play('blip');
        this._spawnWallSparks(b.x, 0);
      } else if (b.y + b.radius >= ARENA_HEIGHT) {
        b.y = ARENA_HEIGHT - b.radius;
        b.vy = -Math.abs(b.vy);
        this.audio.play('blip');
        this._spawnWallSparks(b.x, ARENA_HEIGHT);
      }

      // Check Paddle 1 collision (Left)
      if (b.vx < 0 && circleAabbIntersects(b.x, b.y, b.radius, this.p1.x, this.p1.y, this.p1.w, this.p1.h)) {
        b.x = this.p1.x + this.p1.w + b.radius;
        const bounce = calculatePaddleBounce(b, this.p1);
        if (bounce) {
          b.vx = bounce.vx;
          b.vy = bounce.vy;
          this.rally++;
          if (this.rally > this.maxRally) this.maxRally = this.rally;
          this._handlePaddleHit(b, bounce.smash, '#00f0ff');
        }
      }

      // Check Paddle 2 collision (Right)
      if (b.vx > 0 && circleAabbIntersects(b.x, b.y, b.radius, this.p2.x, this.p2.y, this.p2.w, this.p2.h)) {
        b.x = this.p2.x - b.radius;
        const bounce = calculatePaddleBounce(b, this.p2);
        if (bounce) {
          b.vx = bounce.vx;
          b.vy = bounce.vy;
          this.rally++;
          if (this.rally > this.maxRally) this.maxRally = this.rally;
          this._handlePaddleHit(b, bounce.smash, '#ff3399');
        }
      }

      // Power-up pickup by ball
      if (this.powerUpsEnabled) {
        for (let pi = this.powerUps.length - 1; pi >= 0; pi--) {
          const pu = this.powerUps[pi];
          if (circleIntersects(b.x, b.y, b.radius, pu.x, pu.y, pu.radius)) {
            this.powerUps.splice(pi, 1);
            this._applyPowerUp(pu.type, b.vx > 0 ? 1 : 2); // player who last hit ball
          }
        }
      }

      // Check Goals
      if (b.x + b.radius < 0) {
        // Player 2 scored
        this.balls.splice(bi, 1);
        if (this.balls.length === 0) {
          this._scoreGoal(2);
        }
      } else if (b.x - b.radius > ARENA_WIDTH) {
        // Player 1 scored
        this.balls.splice(bi, 1);
        if (this.balls.length === 0) {
          this._scoreGoal(1);
        }
      }
    }
  }

  _updateAI(dt) {
    // Track closest ball moving toward AI
    const incoming = this.balls.filter((b) => b.vx > 0);
    const targetBall = incoming.length > 0 ? incoming.sort((a, b) => b.x - a.x)[0] : this.balls[0];

    if (!targetBall) return;

    let targetY = targetBall.y;
    if (this.aiDifficulty === 'skilled') {
      // Predict ball trajectory roughly
      const timeToReach = (this.p2.x - targetBall.x) / targetBall.vx;
      if (timeToReach > 0) {
        targetY = targetBall.y + targetBall.vy * timeToReach * 0.7;
      }
    } else if (this.aiDifficulty === 'master') {
      // Aggressive spin targeting
      const timeToReach = (this.p2.x - targetBall.x) / targetBall.vx;
      if (timeToReach > 0) {
        targetY = targetBall.y + targetBall.vy * timeToReach;
      }
    }

    const paddleCenter = this.p2.y + this.p2.h / 2;
    const diff = targetY - paddleCenter;

    if (Math.abs(diff) > 12) {
      const step = Math.sign(diff) * this.p2.speed * dt;
      this.p2.y += step;
    }
  }

  _handlePaddleHit(ball, isSmash, color) {
    this.audio.play('hit');
    this.particles.burst(ball.x, ball.y, {
      count: isSmash ? 24 : 12,
      color,
      speedMin: 40,
      speedMax: isSmash ? 220 : 120,
      lifeMin: 0.2,
      lifeMax: 0.45,
    });
    if (isSmash) {
      this.renderer.camera.shake(6, 0.2);
    }
  }

  _spawnWallSparks(x, y) {
    this.particles.burst(x, y, {
      count: 10,
      color: '#ffffff',
      speedMin: 30,
      speedMax: 100,
      lifeMin: 0.15,
      lifeMax: 0.35,
    });
  }

  _applyPowerUp(type, recipientPlayer) {
    this.audio.play('powerup');
    const paddle = recipientPlayer === 1 ? this.p1 : this.p2;

    if (type === 'extend') {
      paddle.h = PADDLE_BASE_HEIGHT * 1.45;
      setTimeout(() => {
        paddle.h = PADDLE_BASE_HEIGHT;
      }, 10000);
    } else if (type === 'multiball') {
      // Spawn extra ball in arena
      if (this.balls.length > 0) {
        const primary = this.balls[0];
        this.balls.push({
          x: primary.x,
          y: primary.y,
          vx: primary.vx,
          vy: -primary.vy,
          radius: BALL_RADIUS,
        });
      }
    } else if (type === 'speed') {
      for (const b of this.balls) {
        b.vx *= 1.35;
        b.vy *= 1.35;
      }
    } else if (type === 'shield') {
      paddle.hasShield = true;
    }

    if (this.ctx?.achievements?.unlock) {
      this.ctx.achievements.unlock('pong_powerup_master');
    }
  }

  _scoreGoal(scorer) {
    this.audio.play('victory');
    this.renderer.camera.shake(12, 0.4);

    if (scorer === 1) {
      this.scoreP1++;
    } else {
      this.scoreP2++;
    }

    // Check match win
    if (this.scoreP1 >= WINNING_SCORE || this.scoreP2 >= WINNING_SCORE) {
      this._triggerMatchOver(this.scoreP1 >= WINNING_SCORE);
    } else {
      setTimeout(() => {
        if (!this.gameOver) this._serveBall(scorer === 1 ? 2 : 1);
      }, 800);
    }
  }

  _triggerMatchOver(p1Won) {
    this.gameOver = true;
    this.loop.stop();

    if (p1Won) {
      this.audio.play('victory');
    } else {
      this.audio.play('gameover');
    }

    const finalScore = this.scoreP1 * 1000 + this.maxRally * 50;
    this.scores
      .submitScore(finalScore, this.mode, { details: { scoreP1: this.scoreP1, scoreP2: this.scoreP2 } })
      .then((res) => {
        const modal = createGameOverModal({
          score: finalScore,
          isNewHigh: res.isNewHigh,
          rank: res.rank,
          xpEarned: p1Won ? 35 : 10,
          onRestart: () => this.restart(),
          onQuit: () => this.onQuit?.(),
        });
        const title = modal.querySelector('.nx-game-modal-title');
        if (title) title.textContent = p1Won ? 'VICTORY!' : 'MATCH DEFEAT';
        this.container.append(modal);
      });

    if (this.ctx?.achievements?.unlock) {
      if (p1Won) this.ctx.achievements.unlock('pong_win_match');
      if (p1Won && this.aiDifficulty === 'master') this.ctx.achievements.unlock('pong_beat_master');
      if (this.maxRally >= 20) this.ctx.achievements.unlock('pong_rally_20');
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
        title: 'NEON PONG PAUSED',
      });
      this.container.append(modal);
    } else {
      this.loop.resume();
    }
  }

  restart() {
    this.loop.stop();
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.rally = 0;
    this.maxRally = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.powerUps = [];
    this.p1.y = (ARENA_HEIGHT - PADDLE_BASE_HEIGHT) / 2;
    this.p2.y = (ARENA_HEIGHT - PADDLE_BASE_HEIGHT) / 2;
    this._serveBall(1);
    this.loop.start();
  }

  render() {
    const ctx = this.renderer.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Dark cyberpunk court backdrop
    ctx.fillStyle = '#060810';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Apply camera shake
    ctx.save();
    const cam = this.renderer.camera;
    ctx.translate(cam.shakeOffset.x, cam.shakeOffset.y);

    // Center dotted divider
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH / 2, 0);
    ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing boundary rails
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Render Power-ups
    for (const pu of this.powerUps) {
      this._drawPowerUp(ctx, pu);
    }

    // Render Paddle 1 (Cyan)
    this._drawPaddle(ctx, this.p1, '#00f0ff');

    // Render Paddle 2 (Magenta)
    this._drawPaddle(ctx, this.p2, '#ff3399');

    // Render Balls
    for (const b of this.balls) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Particles
    this.particles.render(ctx);

    ctx.restore();

    // Render Scores & Rally HUD
    this._drawHUD(ctx);
  }

  _drawPaddle(ctx, paddle, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    // Inner bevel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddle.x + 2, paddle.y + 4, paddle.w - 4, paddle.h - 8);
    ctx.restore();
  }

  _drawPowerUp(ctx, pu) {
    ctx.save();
    const color = pu.type === 'extend' ? '#2ecc71' : pu.type === 'multiball' ? '#f1c40f' : '#e056fd';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pu.type[0].toUpperCase(), pu.x, pu.y + 3);
    ctx.restore();
  }

  _drawHUD(ctx) {
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';

    // P1 score
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.fillText(String(this.scoreP1), ARENA_WIDTH / 2 - 80, 75);

    // P2 score
    ctx.fillStyle = 'rgba(255, 51, 153, 0.85)';
    ctx.fillText(String(this.scoreP2), ARENA_WIDTH / 2 + 80, 75);

    // Rally counter
    if (this.rally > 1) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#ffdd00';
      ctx.fillText(`RALLY: ${this.rally}`, ARENA_WIDTH / 2, 30);
    }
  }

  dispose() {
    this.loop.stop();
    this.input.dispose();
  }
}
