// @ts-check
// Snake Evolution game logic

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
import { SNAKE_MAPS } from './maps.js';

export const GRID_SIZE = 20;

/**
 * @typedef {'speed' | 'slow' | 'ghost' | 'shrink' | 'magnet' | 'double' | 'shield'} PowerUpType
 */

export const POWER_UPS = {
  speed: { color: '#ffff00', duration: 8, label: 'Speed 2x' },
  slow: { color: '#00ffff', duration: 10, label: 'Slow-Mo' },
  ghost: { color: '#bf55ec', duration: 8, label: 'Ghost' },
  shrink: { color: '#2ecc71', duration: 0, label: 'Shrink' },
  magnet: { color: '#e67e22', duration: 10, label: 'Magnet' },
  double: { color: '#f1c40f', duration: 12, label: 'Double Points' },
  shield: { color: '#3498db', duration: 15, label: 'Shield' },
};

export class SnakeGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} [options]
   * @param {string} [options.mapId]
   * @param {'classic' | 'timeAttack' | 'survival' | 'zen'} [options.mode]
   * @param {'normal' | 'hard'} [options.difficulty]
   * @param {() => void} [options.onQuit]
   */
  constructor(canvas, container, ctx, { mapId = 'classic', mode = 'classic', difficulty = 'normal', onQuit } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = ctx;
    this.mapId = mapId;
    this.mode = mode;
    this.difficulty = difficulty;
    this.onQuit = onQuit;

    this.renderer = new GameRenderer(canvas, { virtualWidth: 600, virtualHeight: 600, letterbox: true });
    this.audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
    this.input = new InputManager(container, { renderer: this.renderer });
    this.particles = new ParticleSystem(300);
    this.scores = new GameScoreService('nexus.snake', ctx);
    this.rng = new SeededRng();

    this.cellSize = 600 / GRID_SIZE; // 30px per cell

    // Game state
    this.score = 0;
    this.highScore = 0;
    this.gameOver = false;
    this.timeRemaining = mode === 'timeAttack' ? 60 : 0;
    this.elapsedTime = 0;
    this.usedPowerUp = false;

    // Movement & ticks
    this.baseSpeed = difficulty === 'hard' ? 12 : 9; // Ticks per second
    this.tickTimer = 0;
    this.dir = { x: 1, y: 0 };
    /** @type {{ x: number, y: number }[]} */
    this.inputBuffer = [];

    // Snake representation: grid coordinates
    this.body = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    this.prevBody = JSON.parse(JSON.stringify(this.body));

    // Active power-up timers
    /** @type {Record<string, number>} */
    this.activePowerUps = {};

    // Entities
    this.food = { x: 12, y: 10 };
    /** @type {{ x: number, y: number, type: PowerUpType } | null} */
    this.powerUpItem = null;
    this.powerUpSpawnTimer = 12;

    this.map = SNAKE_MAPS[mapId] || SNAKE_MAPS.classic;
    this.movingObstacles = this.map.movingObstacles ? JSON.parse(JSON.stringify(this.map.movingObstacles)) : [];

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
      focusTarget: container,
    });

    this._init();
  }

  async _init() {
    const list = await this.scores.getLeaderboard(this.mode);
    if (list.length > 0) this.highScore = list[0].score;
    this.loop.start();
  }

  /**
   * Resets game to starting state
   */
  restart() {
    this.score = 0;
    this.gameOver = false;
    this.timeRemaining = this.mode === 'timeAttack' ? 60 : 0;
    this.elapsedTime = 0;
    this.usedPowerUp = false;
    this.activePowerUps = {};
    this.dir = { x: 1, y: 0 };
    this.inputBuffer = [];

    this.body = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    this.prevBody = JSON.parse(JSON.stringify(this.body));

    this.movingObstacles = this.map.movingObstacles ? JSON.parse(JSON.stringify(this.map.movingObstacles)) : [];
    this._spawnFood();
    this.powerUpItem = null;
    this.powerUpSpawnTimer = 12;
    this.particles.clear();
    this.loop.resume();
  }

  /**
   * Spawns food at random free cell
   */
  _spawnFood() {
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 200) {
      attempts++;
      const x = this.rng.int(1, GRID_SIZE - 2);
      const y = this.rng.int(1, GRID_SIZE - 2);
      const hitSnake = this.body.some((b) => b.x === x && b.y === y);
      const hitWall = this.map.walls.some((w) => w.x === x && w.y === y);
      const hitPortal = this.map.portals?.some(
        (p) => (p.in.x === x && p.in.y === y) || (p.out.x === x && p.out.y === y),
      );

      if (!hitSnake && !hitWall && !hitPortal) {
        this.food = { x, y };
        valid = true;
      }
    }
  }

  /**
   * Spawns a random power-up item
   */
  _spawnPowerUp() {
    const types = /** @type {PowerUpType[]} */ (['speed', 'slow', 'ghost', 'shrink', 'magnet', 'double', 'shield']);
    const type = this.rng.choice(types);
    const x = this.rng.int(1, GRID_SIZE - 2);
    const y = this.rng.int(1, GRID_SIZE - 2);

    const hitSnake = this.body.some((b) => b.x === x && b.y === y);
    const hitWall = this.map.walls.some((w) => w.x === x && w.y === y);

    if (!hitSnake && !hitWall) {
      this.powerUpItem = { x, y, type };
    }
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

    if (this.mode === 'timeAttack') {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this._endGame();
        return;
      }
    }

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

    // Input direction buffering (queue up to 2 turns)
    const lastTargetDir = this.inputBuffer.length > 0 ? this.inputBuffer[this.inputBuffer.length - 1] : this.dir;

    if (this.input.justPressed('up') && lastTargetDir.y === 0) {
      if (this.inputBuffer.length < 2) this.inputBuffer.push({ x: 0, y: -1 });
    } else if (this.input.justPressed('down') && lastTargetDir.y === 0) {
      if (this.inputBuffer.length < 2) this.inputBuffer.push({ x: 0, y: 1 });
    } else if (this.input.justPressed('left') && lastTargetDir.x === 0) {
      if (this.inputBuffer.length < 2) this.inputBuffer.push({ x: -1, y: 0 });
    } else if (this.input.justPressed('right') && lastTargetDir.x === 0) {
      if (this.inputBuffer.length < 2) this.inputBuffer.push({ x: 1, y: 0 });
    }

    // Power-up countdowns
    for (const key of Object.keys(this.activePowerUps)) {
      this.activePowerUps[key] -= dt;
      if (this.activePowerUps[key] <= 0) {
        delete this.activePowerUps[key];
      }
    }

    // Power-up spawning timer
    this.powerUpSpawnTimer -= dt;
    if (this.powerUpSpawnTimer <= 0) {
      this.powerUpSpawnTimer = this.rng.range(12, 20);
      if (!this.powerUpItem) this._spawnPowerUp();
    }

    // Magnet power-up effect (pulls food closer)
    if (this.activePowerUps.magnet && Math.random() < 0.05) {
      const head = this.body[0];
      const dx = head.x - this.food.x;
      const dy = head.y - this.food.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.food.x += Math.sign(dx);
      } else {
        this.food.y += Math.sign(dy);
      }
    }

    // Calculate effective tick rate
    let effectiveSpeed = this.baseSpeed;
    if (this.mode === 'survival') {
      effectiveSpeed += Math.min(10, Math.floor(this.score / 200));
    }
    if (this.activePowerUps.speed) effectiveSpeed *= 1.5;
    if (this.activePowerUps.slow) effectiveSpeed *= 0.65;

    const tickInterval = 1 / effectiveSpeed;
    this.tickTimer += dt;

    if (this.tickTimer >= tickInterval) {
      this.tickTimer -= tickInterval;
      this._step();
    }

    this.input.update();
  }

  /**
   * Game step (grid tick)
   */
  _step() {
    // Consume next buffered direction
    if (this.inputBuffer.length > 0) {
      this.dir = this.inputBuffer.shift();
    }

    // Save previous body for interpolation
    this.prevBody = JSON.parse(JSON.stringify(this.body));

    // Update moving obstacles
    for (const obs of this.movingObstacles) {
      if (obs.horizontal) {
        obs.x += obs.vx;
        if (obs.x <= obs.min || obs.x >= obs.max) obs.vx *= -1;
      } else {
        obs.y += obs.vy;
        if (obs.y <= obs.min || obs.y >= obs.max) obs.vy *= -1;
      }
    }

    const head = this.body[0];
    let nextX = head.x + this.dir.x;
    let nextY = head.y + this.dir.y;

    // Map wrap-around or boundaries
    const isWrap = this.map.wrap || this.mode === 'zen';
    if (isWrap) {
      if (nextX < 0) nextX = GRID_SIZE - 1;
      if (nextX >= GRID_SIZE) nextX = 0;
      if (nextY < 0) nextY = GRID_SIZE - 1;
      if (nextY >= GRID_SIZE) nextY = 0;
    } else {
      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        this._handleCollision('wall');
        return;
      }
    }

    // Portal teleportation check
    if (this.map.portals) {
      for (const p of this.map.portals) {
        if (nextX === p.in.x && nextY === p.in.y) {
          nextX = p.out.x + this.dir.x;
          nextY = p.out.y + this.dir.y;
          this.audio.play('blip');
          this.particles.emit({
            x: (p.in.x + 0.5) * this.cellSize,
            y: (p.in.y + 0.5) * this.cellSize,
            count: 15,
            color: p.color,
          });
          break;
        } else if (nextX === p.out.x && nextY === p.out.y) {
          nextX = p.in.x + this.dir.x;
          nextY = p.in.y + this.dir.y;
          this.audio.play('blip');
          this.particles.emit({
            x: (p.out.x + 0.5) * this.cellSize,
            y: (p.out.y + 0.5) * this.cellSize,
            count: 15,
            color: p.color,
          });
          break;
        }
      }
    }

    // Static Wall collision check
    if (this.map.walls.some((w) => w.x === nextX && w.y === nextY)) {
      if (this.mode === 'zen') {
        // In zen mode, bounce off wall
        this.dir = { x: -this.dir.x, y: -this.dir.y };
        return;
      }
      this._handleCollision('wall');
      return;
    }

    // Moving obstacles collision check
    if (this.movingObstacles.some((o) => o.x === nextX && o.y === nextY)) {
      this._handleCollision('obstacle');
      return;
    }

    // Self collision check (unless ghost mode active or zen mode)
    if (!this.activePowerUps.ghost && this.mode !== 'zen') {
      const hitSelf = this.body.slice(0, -1).some((b) => b.x === nextX && b.y === nextY);
      if (hitSelf) {
        this._handleCollision('self');
        return;
      }
    }

    // Move snake head
    this.body.unshift({ x: nextX, y: nextY });

    // Check food consumption
    if (nextX === this.food.x && nextY === this.food.y) {
      const multiplier = this.activePowerUps.double ? 2 : 1;
      const pts = (100 + this.body.length * 10) * multiplier;
      this.score += pts;
      this.audio.play('coin');

      this.particles.emit({
        x: (this.food.x + 0.5) * this.cellSize,
        y: (this.food.y + 0.5) * this.cellSize,
        count: 20,
        color: ['#00ff88', '#00f0ff', '#ffdd00'],
      });

      this._spawnFood();

      // Achievements check
      this.scores.unlockAchievement('snake_first_food');
      if (this.body.length >= 25) this.scores.unlockAchievement('snake_length_25');
      if (this.body.length >= 50) this.scores.unlockAchievement('snake_length_50');
      if (this.score >= 1000) this.scores.unlockAchievement('snake_score_1000');
    } else {
      this.body.pop();
    }

    // Check power-up item collection
    if (this.powerUpItem && nextX === this.powerUpItem.x && nextY === this.powerUpItem.y) {
      this._applyPowerUp(this.powerUpItem.type);
      this.powerUpItem = null;
    }
  }

  /**
   * @param {PowerUpType} type
   */
  _applyPowerUp(type) {
    this.usedPowerUp = true;
    this.audio.play('powerup');
    const info = POWER_UPS[type];

    this.particles.emit({
      x: (this.body[0].x + 0.5) * this.cellSize,
      y: (this.body[0].y + 0.5) * this.cellSize,
      count: 25,
      color: info.color,
    });

    if (type === 'shrink') {
      const keep = Math.max(3, Math.floor(this.body.length * 0.6));
      this.body = this.body.slice(0, keep);
      this.prevBody = this.prevBody.slice(0, keep);
    } else {
      this.activePowerUps[type] = info.duration;
    }
  }

  /**
   * @param {string} _reason
   */
  _handleCollision(_reason) {
    if (this.activePowerUps.shield) {
      // Shield absorbs collision
      delete this.activePowerUps.shield;
      this.audio.play('hit');
      this.renderer.camera.shake(6, 0.25);
      this.particles.emit({
        x: (this.body[0].x + 0.5) * this.cellSize,
        y: (this.body[0].y + 0.5) * this.cellSize,
        count: 25,
        color: '#3498db',
      });
      return;
    }

    this.audio.play('gameover');
    this.renderer.camera.shake(12, 0.4);
    this._endGame();
  }

  async _endGame() {
    this.gameOver = true;
    this.loop.pause();

    // Check achievements
    if (!this.usedPowerUp && this.score >= 500) {
      this.scores.unlockAchievement('snake_no_powerups');
    }

    const { rank, isNewHigh } = await this.scores.submitScore(this.score, this.mode);
    await this.scores.recordTime(this.elapsedTime);

    const xpEarned = Math.min(50, Math.max(10, Math.floor(this.score / 50)));

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

  /**
   * Renders the game frame
   * @param {number} alpha Interpolation factor in [0, 1]
   */
  render(alpha) {
    const ctx = this.renderer.ctx;
    this.renderer.beginFrame('#0a0c16');

    // Apply screen shake
    ctx.save();
    ctx.translate(this.renderer.camera.shakeOffset.x, this.renderer.camera.shakeOffset.y);

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 600);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(600, pos);
      ctx.stroke();
    }

    // Draw static walls
    ctx.fillStyle = '#3a4768';
    ctx.shadowColor = '#1d2436';
    ctx.shadowBlur = 8;
    for (const w of this.map.walls) {
      ctx.beginPath();
      ctx.roundRect(w.x * this.cellSize + 2, w.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4, 4);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw portals
    if (this.map.portals) {
      for (const p of this.map.portals) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        // In portal
        ctx.beginPath();
        ctx.arc((p.in.x + 0.5) * this.cellSize, (p.in.y + 0.5) * this.cellSize, this.cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Out portal
        ctx.beginPath();
        ctx.arc((p.out.x + 0.5) * this.cellSize, (p.out.y + 0.5) * this.cellSize, this.cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Draw moving obstacles
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 10;
    for (const obs of this.movingObstacles) {
      ctx.beginPath();
      ctx.roundRect(obs.x * this.cellSize + 2, obs.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4, 4);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw food with pulse
    const pulse = Math.sin(this.elapsedTime * 6) * 2;
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(
      (this.food.x + 0.5) * this.cellSize,
      (this.food.y + 0.5) * this.cellSize,
      this.cellSize * 0.35 + pulse,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw power-up item
    if (this.powerUpItem) {
      const pColor = POWER_UPS[this.powerUpItem.type].color;
      ctx.fillStyle = pColor;
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(
        (this.powerUpItem.x + 0.5) * this.cellSize,
        (this.powerUpItem.y + 0.5) * this.cellSize,
        this.cellSize * 0.38,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw smooth interpolated snake body
    const ghost = this.activePowerUps.ghost;
    ctx.fillStyle = ghost ? 'rgba(191, 85, 236, 0.7)' : '#00f0ff';
    ctx.shadowColor = ghost ? '#bf55ec' : '#00f0ff';
    ctx.shadowBlur = this.activePowerUps.shield ? 16 : 8;

    for (let i = 0; i < this.body.length; i++) {
      const curr = this.body[i];
      const prev = this.prevBody[i] || curr;

      // Check for wrap-around teleport to prevent rendering stretch across canvas
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      let ix = curr.x;
      let iy = curr.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        ix = prev.x + (curr.x - prev.x) * alpha;
        iy = prev.y + (curr.y - prev.y) * alpha;
      }

      const padding = i === 0 ? 1 : 2;
      const radius = i === 0 ? 8 : 5;

      ctx.beginPath();
      ctx.roundRect(
        ix * this.cellSize + padding,
        iy * this.cellSize + padding,
        this.cellSize - padding * 2,
        this.cellSize - padding * 2,
        radius,
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Render particles
    this.particles.render(ctx);

    // Draw HUD
    this.renderer.drawText(`Score: ${this.score}`, 16, 24, { size: 18, bold: true, color: '#ffffff' });
    if (this.mode === 'timeAttack') {
      this.renderer.drawText(`Time: ${Math.ceil(this.timeRemaining)}s`, 300, 24, {
        size: 18,
        bold: true,
        align: 'center',
        color: this.timeRemaining < 10 ? '#ff3366' : '#ffd700',
      });
    }

    // Active power-up indicators
    let badgeX = 580;
    for (const [key, time] of Object.entries(this.activePowerUps)) {
      const label = `${POWER_UPS[key].label} (${Math.ceil(time)}s)`;
      this.renderer.drawText(label, badgeX, 24, {
        size: 13,
        bold: true,
        align: 'right',
        color: POWER_UPS[key].color,
      });
      badgeX -= 110;
    }

    ctx.restore();

    // Render virtual touch joystick if active
    this.input.renderTouchControls(ctx);

    this.renderer.endFrame();
  }

  dispose() {
    this.loop.dispose();
    this.input.dispose();
    this.audio.dispose();
  }
}
