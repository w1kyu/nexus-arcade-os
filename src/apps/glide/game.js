// @ts-check
import {
  GameAudio,
  GameLoop,
  GameRenderer,
  GameScoreService,
  InputManager,
  ParticleSystem,
  createGameOverModal,
  createPauseModal,
} from '../../games/engine/index.js';
import { ARENA_H, ARENA_W, GhostRecorder, Glider, checkGateCollision, createGate } from './physics.js';

export class GlideGame {
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
    this.particles = new ParticleSystem(350);
    this.scores = new GameScoreService('nexus.glide', ctx);

    this.glider = new Glider(180, ARENA_H / 2);
    /** @type {import('./physics.js').NeonGate[]} */
    this.gates = [];
    this.ghost = new GhostRecorder();

    this.score = 0;
    this.gatesPassed = 0;
    this.scrollSpeed = 220;
    this.nextGateDistance = 300;
    this.elapsedTime = 0;
    this.isPaused = false;
    this.gameOver = false;
    this.beatGhost = false;

    // Load saved best ghost track
    if (ctx.storage?.kv) {
      ctx.storage.kv
        .get('glide_best_ghost')
        .then((saved) => {
          if (Array.isArray(saved)) this.ghost.bestTrack = saved;
        })
        .catch(() => {});
    }

    this._setupInput();
    this.restart();

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
    this.loop.start();
  }

  _setupInput() {
    this.input.bindAction('flap', ['Space', 'ArrowUp', 'KeyW', 'KeyJ']);
    this.input.bindAction('pause', ['Escape', 'KeyP']);

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.isPaused && !this.gameOver) {
        this.glider.flap();
        this.audio.play('laser');
      }
    });
  }

  restart() {
    this.glider = new Glider(180, ARENA_H / 2);
    this.gates = [createGate(ARENA_W + 100), createGate(ARENA_W + 360)];
    this.ghost.currentTrack = [];
    this.score = 0;
    this.gatesPassed = 0;
    this.scrollSpeed = 220;
    this.nextGateDistance = 260;
    this.elapsedTime = 0;
    this.isPaused = false;
    this.gameOver = false;
    this.beatGhost = false;
  }

  update(dt) {
    if (this.isPaused || this.gameOver) return;
    this.elapsedTime += dt;
    this.particles.update(dt);

    if (this.input.isActionJustPressed('pause')) {
      this.pause();
      return;
    }

    if (this.input.isActionJustPressed('flap')) {
      this.glider.flap();
      this.audio.play('laser');
    }

    this.glider.update(dt);
    this.ghost.record(this.elapsedTime, this.glider.y, this.glider.angle);

    // Particle jet trail
    this.particles.emit({
      x: this.glider.x - 14,
      y: this.glider.y,
      vx: -120 - Math.random() * 60,
      vy: (Math.random() - 0.5) * 40,
      color: '#00f0ff',
      life: 0.35,
      size: 4,
    });

    // Update gates
    const speed = this.scrollSpeed + Math.min(150, this.gatesPassed * 4);
    for (const g of this.gates) {
      g.x -= speed * dt;

      // Check passing gate
      if (!g.passed && g.x + g.width < this.glider.x) {
        g.passed = true;
        this.gatesPassed++;
        this.score += 100;
        this.audio.play('victory');

        if (this.gatesPassed >= 10) this.ctx.achievements?.unlock('glide_pass_10');
        if (this.gatesPassed >= 50) this.ctx.achievements?.unlock('glide_pass_50');
        if (this.score >= 2000) this.ctx.achievements?.unlock('glide_score_2k');
      }

      // Collision check
      if (checkGateCollision(this.glider, g)) {
        this._endGame();
        return;
      }
    }

    // Remove offscreen gates & spawn new ones
    this.gates = this.gates.filter((g) => g.x + g.width > -40);
    const lastGate = this.gates[this.gates.length - 1];
    if (!lastGate || lastGate.x < ARENA_W - 220) {
      this.gates.push(createGate(ARENA_W + 60, Math.max(120, 160 - this.gatesPassed)));
    }

    // Floor/ceiling bounds collision
    if (this.glider.y - this.glider.radius < 0 || this.glider.y + this.glider.radius > ARENA_H) {
      this._endGame();
    }
  }

  _endGame() {
    this.gameOver = true;
    this.audio.play('gameover');
    this.particles.burst(this.glider.x, this.glider.y, '#ff3366', 30);

    // Check if beat previous best ghost
    if (this.ghost.bestTrack.length && this.ghost.currentTrack.length > this.ghost.bestTrack.length) {
      this.beatGhost = true;
      this.ctx.achievements?.unlock('glide_beat_ghost');
    }

    this.scores.submitScore(this.score, 'arcade', { details: { gates: this.gatesPassed } }).then((res) => {
      if (res.isNewHigh) {
        this.ghost.saveBest();
        this.ctx.storage?.kv?.set('glide_best_ghost', this.ghost.bestTrack).catch(() => {});
      }
      const modal = createGameOverModal({
        score: this.score,
        rank: res.rank,
        isNewHigh: res.isNewHigh,
        scoreLabel: 'GATES PASSED',
        scoreText: `${this.gatesPassed} Gates (${this.score} pts)`,
        xpEarned: Math.min(50, Math.max(5, Math.floor(this.score / 40))),
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

  render() {
    const ctx = this.renderer.ctx;
    this.renderer.clear('#030712');

    // Synthwave horizon grid
    ctx.strokeStyle = 'rgba(255, 0, 128, 0.12)';
    ctx.lineWidth = 1;
    for (let y = 0; y < ARENA_H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_W, y);
      ctx.stroke();
    }

    // Draw Neon Gates
    for (const g of this.gates) {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = g.passed ? '#00ff88' : '#ff007f';
      ctx.lineWidth = 3;

      // Top barrier
      ctx.fillRect(g.x, 0, g.width, g.topH);
      ctx.strokeRect(g.x, 0, g.width, g.topH);

      // Bottom barrier
      ctx.fillRect(g.x, g.botY, g.width, ARENA_H - g.botY);
      ctx.strokeRect(g.x, g.botY, g.width, ARENA_H - g.botY);

      // Neon edge lights
      ctx.fillStyle = g.passed ? '#00ff88' : '#00f0ff';
      ctx.fillRect(g.x - 2, g.topH - 6, g.width + 4, 6);
      ctx.fillRect(g.x - 2, g.botY, g.width + 4, 6);
    }

    // Draw Ghost Glider
    const ghostFrame = this.ghost.sample(this.elapsedTime);
    if (ghostFrame) {
      ctx.save();
      ctx.translate(this.glider.x, ghostFrame.y);
      ctx.rotate(ghostFrame.angle);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.28)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Player Glider
    ctx.save();
    ctx.translate(this.glider.x, this.glider.y);
    ctx.rotate(this.glider.angle);
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-14, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    this.particles.render(ctx);

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ui-monospace, monospace';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f0ff';
    ctx.fillText(`GATES: ${this.gatesPassed}`, 24, 36);
    ctx.fillText(`SCORE: ${this.score}`, ARENA_W - 180, 36);
  }

  dispose() {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
  }
}
