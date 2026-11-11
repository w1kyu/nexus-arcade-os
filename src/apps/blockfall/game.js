// @ts-check
// Blockfall core game implementation with SRS, hold queue, ghost projection, and T-spin scoring

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
import { SHAPES, TETROMINO_COLORS, createSevenBag, getWallKicks } from './srs.js';

export const BOARD_COLS = 10;
export const BOARD_ROWS = 24; // 4 hidden buffer rows at top (0..3), 20 visible rows (4..23)
export const VISIBLE_ROWS = 20;
export const CELL_SIZE = 28; // 280px playfield width

export const ARENA_WIDTH = 580;
export const ARENA_HEIGHT = 640;

/**
 * @typedef {'marathon' | 'sprint' | 'ultra' | 'zen'} BlockfallMode
 * @typedef {{ type: import('./srs.js').TetrominoType, rot: number, x: number, y: number }} ActivePiece
 */

export class BlockfallGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} [options]
   * @param {BlockfallMode} [options.mode]
   * @param {() => void} [options.onQuit]
   */
  constructor(canvas, container, ctx, { mode = 'marathon', onQuit } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = ctx;
    this.mode = mode;
    this.onQuit = onQuit;

    this.renderer = new GameRenderer(canvas, {
      virtualWidth: ARENA_WIDTH,
      virtualHeight: ARENA_HEIGHT,
      letterbox: true,
    });
    this.audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
    this.input = new InputManager(container, { renderer: this.renderer });
    this.particles = new ParticleSystem(300);
    this.scores = new GameScoreService('nexus.blockfall', ctx);
    this.rng = new SeededRng();

    // Board grid: null or color hex
    /** @type {(string | null)[][]} */
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

    // Piece queues
    /** @type {import('./srs.js').TetrominoType[]} */
    this.bag = [];
    /** @type {import('./srs.js').TetrominoType[]} */
    this.nextQueue = [];
    /** @type {import('./srs.js').TetrominoType | null} */
    this.holdPiece = null;
    this.canHold = true;

    // Active piece state
    /** @type {ActivePiece | null} */
    this.currentPiece = null;
    this.lastActionWasRotate = false;
    this.lastRotateKick = [0, 0];

    // Timing & Gravity
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockDelay = 0.5; // 500ms
    this.lockResets = 0;
    this.maxLockResets = 15;
    this.isSoftDropping = false;

    // DAS & ARR for smooth keyboard control
    this.dasTimer = 0;
    this.arrTimer = 0;
    this.dasDelay = 0.16; // 160ms DAS
    this.arrInterval = 0.035; // 35ms ARR
    this.heldDir = 0;

    // Line clearing animation
    /** @type {{ rows: number[], timer: number, duration: number } | null} */
    this.clearingLines = null;

    // Game stats & scoring
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.combo = -1;
    this.backToBack = false;
    this.gameOver = false;
    this.gameWon = false;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.ultraTimeRemaining = 120; // 2 minutes for Ultra mode

    // Specific stats
    this.singles = 0;
    this.doubles = 0;
    this.triples = 0;
    this.quads = 0;
    this.tspins = 0;

    this._refillQueue();
    this._spawnPiece();

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
    this.loop.start();

    // Check high score
    this.highScore = 0;
    this.scores.getLeaderboard(this.mode).then((list) => {
      if (list.length > 0) this.highScore = list[0].score;
    });

    this._setupInputBindings();
  }

  _setupInputBindings() {
    this.input.bindAction('hardDrop', ['Space']);
    this.input.bindAction('softDrop', ['ArrowDown', 'KeyS']);
    this.input.bindAction('moveLeft', ['ArrowLeft', 'KeyA']);
    this.input.bindAction('moveRight', ['ArrowRight', 'KeyD']);
    this.input.bindAction('rotateCW', ['ArrowUp', 'KeyW', 'KeyX']);
    this.input.bindAction('rotateCCW', ['KeyZ', 'ControlLeft']);
    this.input.bindAction('hold', ['KeyC', 'ShiftLeft', 'ShiftRight']);
    this.input.bindAction('pause', ['Escape', 'KeyP']);
  }

  _refillQueue() {
    while (this.nextQueue.length < 7) {
      if (this.bag.length === 0) {
        this.bag = createSevenBag(() => this.rng.next());
      }
      const next = this.bag.pop();
      if (next) this.nextQueue.push(next);
    }
  }

  _spawnPiece() {
    this._refillQueue();
    const type = this.nextQueue.shift();
    if (!type) return;

    // Center spawn in top hidden buffer
    const spawnX = type === 'O' ? 4 : 3;
    const spawnY = 2; // In 4-row hidden buffer
    this.currentPiece = { type, rot: 0, x: spawnX, y: spawnY };
    this.canHold = true;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastActionWasRotate = false;

    // Check immediate collision -> Game Over
    if (this._collides(this.currentPiece.x, this.currentPiece.y, this.currentPiece.rot)) {
      this._triggerGameOver(false);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} rot
   * @param {import('./srs.js').TetrominoType} [pieceType]
   */
  _collides(x, y, rot, pieceType) {
    if (!this.currentPiece && !pieceType) return false;
    const type = pieceType || this.currentPiece?.type;
    if (!type) return false;
    const matrix = SHAPES[type][rot];

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const gx = x + c;
          const gy = y + r;

          // Wall and floor boundaries
          if (gx < 0 || gx >= BOARD_COLS || gy >= BOARD_ROWS) {
            return true;
          }
          // Grid blocks (ignoring negative gy for buffer)
          if (gy >= 0 && this.grid[gy][gx] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  _getGhostY() {
    if (!this.currentPiece) return 0;
    let gy = this.currentPiece.y;
    while (!this._collides(this.currentPiece.x, gy + 1, this.currentPiece.rot)) {
      gy++;
    }
    return gy;
  }

  _getGravityInterval() {
    if (this.mode === 'zen') return 0.6;
    // Standard marathon gravity curve based on level
    const speed = Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1);
    return Math.max(0.04, speed);
  }

  update(dt) {
    if (this.isPaused || this.gameOver) return;

    this.elapsedTime += dt;
    this.particles.update(dt);

    if (this.mode === 'ultra') {
      this.ultraTimeRemaining -= dt;
      if (this.ultraTimeRemaining <= 0) {
        this.ultraTimeRemaining = 0;
        this._triggerGameOver(true);
        return;
      }
    }

    // Line clear animation delay
    if (this.clearingLines) {
      this.clearingLines.timer -= dt;
      if (this.clearingLines.timer <= 0) {
        this._finishLineClear(this.clearingLines.rows);
        this.clearingLines = null;
        this._spawnPiece();
      }
      return;
    }

    if (!this.currentPiece) return;

    this._handleInput(dt);

    // Gravity fall
    const gravity = this.isSoftDropping ? 0.04 : this._getGravityInterval();
    this.gravityTimer += dt;
    if (this.gravityTimer >= gravity) {
      this.gravityTimer = 0;
      if (!this._collides(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.rot)) {
        this.currentPiece.y++;
        if (this.isSoftDropping) {
          this.score += 1; // Soft drop points
        }
        this.lastActionWasRotate = false;
      }
    }

    // Lock delay logic
    const isGrounded = this._collides(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.rot);
    if (isGrounded) {
      this.lockTimer += dt;
      if (this.lockTimer >= this.lockDelay) {
        this._lockPiece();
      }
    } else {
      this.lockTimer = 0;
    }
  }

  _handleInput(dt) {
    if (this.input.isActionJustPressed('pause')) {
      this.togglePause();
      return;
    }

    // Hold piece
    if (this.input.isActionJustPressed('hold')) {
      this._holdCurrentPiece();
      return;
    }

    // Hard drop
    if (this.input.isActionJustPressed('hardDrop')) {
      this._hardDrop();
      return;
    }

    // Rotation CW
    if (this.input.isActionJustPressed('rotateCW')) {
      this._tryRotate(1);
    }
    // Rotation CCW
    if (this.input.isActionJustPressed('rotateCCW')) {
      this._tryRotate(3);
    }

    // Soft drop
    this.isSoftDropping = this.input.isActionDown('softDrop');

    // Horizontal movement with DAS / ARR
    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const currentDir = left && !right ? -1 : right && !left ? 1 : 0;

    if (currentDir !== 0) {
      if (this.heldDir !== currentDir) {
        // First press: move immediately
        this.heldDir = currentDir;
        this._moveHorizontal(currentDir);
        this.dasTimer = 0;
        this.arrTimer = 0;
      } else {
        this.dasTimer += dt;
        if (this.dasTimer >= this.dasDelay) {
          this.arrTimer += dt;
          if (this.arrTimer >= this.arrInterval) {
            this.arrTimer = 0;
            this._moveHorizontal(currentDir);
          }
        }
      }
    } else {
      this.heldDir = 0;
      this.dasTimer = 0;
      this.arrTimer = 0;
    }
  }

  _moveHorizontal(dir) {
    if (!this.currentPiece) return;
    if (!this._collides(this.currentPiece.x + dir, this.currentPiece.y, this.currentPiece.rot)) {
      this.currentPiece.x += dir;
      this.lastActionWasRotate = false;
      this.audio.play('blip');
      if (this.lockResets < this.maxLockResets) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    }
  }

  _tryRotate(dirOffset) {
    if (!this.currentPiece) return;
    const oldRot = this.currentPiece.rot;
    const newRot = (oldRot + dirOffset) % 4;
    const kicks = getWallKicks(this.currentPiece.type, oldRot, newRot);

    for (const [dx, dy] of kicks) {
      if (!this._collides(this.currentPiece.x + dx, this.currentPiece.y + dy, newRot)) {
        this.currentPiece.x += dx;
        this.currentPiece.y += dy;
        this.currentPiece.rot = newRot;
        this.lastActionWasRotate = true;
        this.lastRotateKick = [dx, dy];
        this.audio.play('jump');

        if (this.lockResets < this.maxLockResets) {
          this.lockTimer = 0;
          this.lockResets++;
        }
        return;
      }
    }
  }

  _holdCurrentPiece() {
    if (!this.currentPiece || !this.canHold) return;
    const curType = this.currentPiece.type;
    this.audio.play('coin');

    if (!this.holdPiece) {
      this.holdPiece = curType;
      this._spawnPiece();
    } else {
      const swap = this.holdPiece;
      this.holdPiece = curType;
      const spawnX = swap === 'O' ? 4 : 3;
      this.currentPiece = { type: swap, rot: 0, x: spawnX, y: 2 };
    }
    this.canHold = false;
  }

  _hardDrop() {
    if (!this.currentPiece) return;
    const ghostY = this._getGhostY();
    const dropDist = ghostY - this.currentPiece.y;
    this.score += dropDist * 2;
    this.currentPiece.y = ghostY;
    this.audio.play('hit');
    this._lockPiece();
  }

  _lockPiece() {
    if (!this.currentPiece) return;
    const matrix = SHAPES[this.currentPiece.type][this.currentPiece.rot];
    const color = TETROMINO_COLORS[this.currentPiece.type];

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const gx = this.currentPiece.x + c;
          const gy = this.currentPiece.y + r;
          if (gy >= 0 && gy < BOARD_ROWS && gx >= 0 && gx < BOARD_COLS) {
            this.grid[gy][gx] = color;
          }
        }
      }
    }

    // Check T-spin
    const tspin = this._detectTSpin();

    // Check full rows
    const fullRows = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (this.grid[r].every((cell) => cell !== null)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      // Trigger line clear animation
      this.clearingLines = {
        rows: fullRows,
        timer: 0.18,
        duration: 0.18,
      };

      // Particle explosion along cleared lines
      const playfieldLeft = 150;
      const playfieldTop = 40;
      for (const row of fullRows) {
        const visualRow = row - 4;
        if (visualRow >= 0) {
          const py = playfieldTop + visualRow * CELL_SIZE + CELL_SIZE / 2;
          this.particles.burst(playfieldLeft + (BOARD_COLS * CELL_SIZE) / 2, py, {
            count: 35,
            color: '#00f0ff',
            speedMin: 60,
            speedMax: 200,
            lifeMin: 0.3,
            lifeMax: 0.6,
          });
        }
      }

      this._calculateScore(fullRows.length, tspin);
    } else {
      if (tspin) {
        this._calculateScore(0, tspin);
      }
      this.combo = -1;
      this._spawnPiece();
    }
  }

  /**
   * T-Spin detection using 3-corner rule
   * @returns {'mini' | 'full' | null}
   */
  _detectTSpin() {
    if (!this.currentPiece || this.currentPiece.type !== 'T' || !this.lastActionWasRotate) {
      return null;
    }

    // T center is at (x + 1, y + 1)
    const cx = this.currentPiece.x + 1;
    const cy = this.currentPiece.y + 1;

    // 4 diagonal corners
    const corners = [
      { x: cx - 1, y: cy - 1 }, // top-left
      { x: cx + 1, y: cy - 1 }, // top-right
      { x: cx + 1, y: cy + 1 }, // bot-right
      { x: cx - 1, y: cy + 1 }, // bot-left
    ];

    let occupied = 0;
    for (const { x, y } of corners) {
      if (x < 0 || x >= BOARD_COLS || y >= BOARD_ROWS || (y >= 0 && this.grid[y][x] !== null)) {
        occupied++;
      }
    }

    if (occupied >= 3) {
      this.tspins++;
      // Full vs Mini: if wall kick offset magnitude is large, or front corners occupied
      if (Math.abs(this.lastRotateKick[0]) > 1 || Math.abs(this.lastRotateKick[1]) > 1) {
        return 'full';
      }
      return 'mini';
    }
    return null;
  }

  _calculateScore(lines, tspin) {
    let baseScore = 0;
    let isDifficult = false;

    if (tspin === 'full') {
      if (lines === 0) baseScore = 400 * this.level;
      else if (lines === 1) {
        baseScore = 800 * this.level;
        isDifficult = true;
      } else if (lines === 2) {
        baseScore = 1200 * this.level;
        isDifficult = true;
      } else if (lines === 3) {
        baseScore = 1600 * this.level;
        isDifficult = true;
      }
      this.audio.play('powerup');
    } else if (tspin === 'mini') {
      if (lines === 0) baseScore = 100 * this.level;
      else if (lines === 1) {
        baseScore = 200 * this.level;
        isDifficult = true;
      } else if (lines === 2) {
        baseScore = 400 * this.level;
        isDifficult = true;
      }
      this.audio.play('powerup');
    } else {
      if (lines === 1) {
        baseScore = 100 * this.level;
        this.singles++;
        this.audio.play('coin');
      } else if (lines === 2) {
        baseScore = 300 * this.level;
        this.doubles++;
        this.audio.play('coin');
      } else if (lines === 3) {
        baseScore = 500 * this.level;
        this.triples++;
        this.audio.play('victory');
      } else if (lines === 4) {
        baseScore = 800 * this.level;
        this.quads++;
        isDifficult = true;
        this.audio.play('victory');
      }
    }

    if (lines > 0) {
      this.combo++;
      if (this.combo > 0) {
        baseScore += 50 * this.combo * this.level;
      }
    }

    // Back-to-Back bonus: 1.5x score
    if (isDifficult) {
      if (this.backToBack) {
        baseScore = Math.floor(baseScore * 1.5);
      }
      this.backToBack = true;
    } else if (lines > 0) {
      this.backToBack = false;
    }

    this.score += baseScore;
  }

  _finishLineClear(rows) {
    // Remove full rows and add new empty rows at top
    const remaining = this.grid.filter((_, idx) => !rows.includes(idx));
    const newRows = Array.from({ length: rows.length }, () => Array(BOARD_COLS).fill(null));
    this.grid = [...newRows, ...remaining];

    this.linesCleared += rows.length;

    // Check Marathon level up
    if (this.mode === 'marathon') {
      const targetLevel = Math.floor(this.linesCleared / 10) + 1;
      if (targetLevel > this.level) {
        this.level = targetLevel;
        this.audio.play('victory');
      }
    }

    // Check Sprint victory (40 lines)
    if (this.mode === 'sprint' && this.linesCleared >= 40) {
      this.gameWon = true;
      this._triggerGameOver(true);
    }
  }

  _triggerGameOver(won) {
    this.gameOver = true;
    this.loop.stop();

    if (won) {
      this.audio.play('victory');
    } else {
      this.audio.play('gameover');
    }

    // Submit score and create modal
    const finalScore = this.mode === 'sprint' ? Math.max(1, Math.round(100000 / this.elapsedTime)) : this.score;

    this.scores.submitScore(finalScore, this.mode, { details: { lines: this.linesCleared } }).then((res) => {
      const modal = createGameOverModal({
        score: finalScore,
        isNewHigh: res.isNewHigh,
        rank: res.rank,
        xpEarned: Math.min(50, Math.max(10, Math.floor(finalScore / 100))),
        onRestart: () => this.restart(),
        onQuit: () => this.onQuit?.(),
      });
      this.container.append(modal);
    });

    // Check achievements
    if (this.ctx?.achievements?.unlock) {
      if (this.linesCleared >= 40) this.ctx.achievements.unlock('blockfall_sprint_40');
      if (this.quads >= 1) this.ctx.achievements.unlock('blockfall_quad_clear');
      if (this.tspins >= 1) this.ctx.achievements.unlock('blockfall_tspin');
      if (this.score >= 50000) this.ctx.achievements.unlock('blockfall_score_50k');
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
        title: 'BLOCKFALL PAUSED',
      });
      this.container.append(modal);
    } else {
      this.loop.resume();
    }
  }

  restart() {
    this.loop.stop();
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    this.bag = [];
    this.nextQueue = [];
    this.holdPiece = null;
    this.canHold = true;
    this.currentPiece = null;
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.combo = -1;
    this.backToBack = false;
    this.gameOver = false;
    this.gameWon = false;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.ultraTimeRemaining = 120;
    this.singles = 0;
    this.doubles = 0;
    this.triples = 0;
    this.quads = 0;
    this.tspins = 0;
    this.clearingLines = null;

    this._refillQueue();
    this._spawnPiece();
    this.loop.start();
  }

  render(_alpha) {
    const ctx = this.renderer.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    bgGrad.addColorStop(0, '#0a0a14');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Playfield position
    const pfX = 150;
    const pfY = 40;
    const pfW = BOARD_COLS * CELL_SIZE; // 280
    const pfH = VISIBLE_ROWS * CELL_SIZE; // 560

    // Playfield border & backdrop
    ctx.fillStyle = '#080811';
    ctx.fillRect(pfX, pfY, pfW, pfH);

    ctx.strokeStyle = '#20203a';
    ctx.lineWidth = 1;
    // Sub-grid lines
    for (let c = 1; c < BOARD_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(pfX + c * CELL_SIZE, pfY);
      ctx.lineTo(pfX + c * CELL_SIZE, pfY + pfH);
      ctx.stroke();
    }
    for (let r = 1; r < VISIBLE_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(pfX, pfY + r * CELL_SIZE);
      ctx.lineTo(pfX + pfW, pfY + r * CELL_SIZE);
      ctx.stroke();
    }

    // Outer playfield glowing border
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(pfX - 1, pfY - 1, pfW + 2, pfH + 2);
    ctx.shadowBlur = 0;

    // Render locked grid blocks
    for (let r = 4; r < BOARD_ROWS; r++) {
      const vr = r - 4;
      for (let c = 0; c < BOARD_COLS; c++) {
        const color = this.grid[r][c];
        if (color) {
          // If in clearing lines animation, flash white
          const isClearing = this.clearingLines?.rows.includes(r);
          this._drawBlock(ctx, pfX + c * CELL_SIZE, pfY + vr * CELL_SIZE, isClearing ? '#ffffff' : color);
        }
      }
    }

    // Render Ghost Piece
    if (this.currentPiece && !this.clearingLines) {
      const ghostY = this._getGhostY();
      const matrix = SHAPES[this.currentPiece.type][this.currentPiece.rot];
      const ghostColor = TETROMINO_COLORS[this.currentPiece.type];

      ctx.save();
      ctx.globalAlpha = 0.28;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            const gy = ghostY + r - 4;
            const gx = this.currentPiece.x + c;
            if (gy >= 0 && gy < VISIBLE_ROWS) {
              this._drawBlock(ctx, pfX + gx * CELL_SIZE, pfY + gy * CELL_SIZE, ghostColor, true);
            }
          }
        }
      }
      ctx.restore();

      // Render Active Piece
      ctx.save();
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            const py = this.currentPiece.y + r - 4;
            const px = this.currentPiece.x + c;
            if (py >= 0 && py < VISIBLE_ROWS) {
              this._drawBlock(ctx, pfX + px * CELL_SIZE, pfY + py * CELL_SIZE, ghostColor, false);
            }
          }
        }
      }
      ctx.restore();
    }

    // Render particles
    this.particles.render(ctx);

    // Left Panel: Hold slot, Mode, Score, Level, Time
    this._drawLeftPanel(ctx, pfX, pfY);

    // Right Panel: Next 5 pieces preview, stats
    this._drawRightPanel(ctx, pfX + pfW + 20, pfY);
  }

  _drawBlock(ctx, x, y, color, isGhost = false) {
    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

    // Beveled highlight and shadow for high contrast & arcade look
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, 3);
    ctx.fillRect(x + 2, y + 2, 3, CELL_SIZE - 4);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x + 2, y + CELL_SIZE - 5, CELL_SIZE - 4, 3);
    ctx.fillRect(x + CELL_SIZE - 5, y + 2, 3, CELL_SIZE - 4);
  }

  _drawLeftPanel(ctx, pfX, pfY) {
    const leftX = 20;

    // HOLD box
    ctx.fillStyle = '#111122';
    ctx.fillRect(leftX, pfY, 110, 100);
    ctx.strokeStyle = '#303055';
    ctx.strokeRect(leftX, pfY, 110, 100);

    ctx.fillStyle = '#8e9aaf';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOLD', leftX + 55, pfY + 18);

    if (this.holdPiece) {
      this._drawMiniPiece(
        ctx,
        this.holdPiece,
        leftX + 25,
        pfY + 30,
        this.canHold ? TETROMINO_COLORS[this.holdPiece] : '#555566',
      );
    }

    // Mode & Score cards
    const cardY = pfY + 120;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#7a889b';
    ctx.font = '10px sans-serif';
    ctx.fillText('MODE', leftX, cardY);
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(this.mode.toUpperCase(), leftX, cardY + 18);

    ctx.fillStyle = '#7a889b';
    ctx.font = '10px sans-serif';
    ctx.fillText('SCORE', leftX, cardY + 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(String(this.score), leftX, cardY + 70);

    ctx.fillStyle = '#7a889b';
    ctx.font = '10px sans-serif';
    ctx.fillText('LINES', leftX, cardY + 105);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(String(this.linesCleared), leftX, cardY + 125);

    ctx.fillStyle = '#7a889b';
    ctx.font = '10px sans-serif';
    ctx.fillText('LEVEL', leftX, cardY + 160);
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(String(this.level), leftX, cardY + 180);

    ctx.fillStyle = '#7a889b';
    ctx.font = '10px sans-serif';
    ctx.fillText('TIME', leftX, cardY + 215);
    ctx.fillStyle = '#00e676';
    ctx.font = 'bold 15px monospace';
    const displayTime = this.mode === 'ultra' ? Math.max(0, this.ultraTimeRemaining) : this.elapsedTime;
    const mins = Math.floor(displayTime / 60);
    const secs = Math.floor(displayTime % 60);
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, leftX, cardY + 235);
  }

  _drawRightPanel(ctx, rightX, pfY) {
    // NEXT 5 queue box
    ctx.fillStyle = '#111122';
    ctx.fillRect(rightX, pfY, 110, 360);
    ctx.strokeStyle = '#303055';
    ctx.strokeRect(rightX, pfY, 110, 360);

    ctx.fillStyle = '#8e9aaf';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', rightX + 55, pfY + 18);

    for (let i = 0; i < Math.min(5, this.nextQueue.length); i++) {
      const piece = this.nextQueue[i];
      const py = pfY + 30 + i * 65;
      this._drawMiniPiece(ctx, piece, rightX + 25, py, TETROMINO_COLORS[piece]);
    }

    // Stats box
    const statY = pfY + 380;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7a889b';
    ctx.font = '10px sans-serif';
    ctx.fillText('STATISTICS', rightX, statY);

    ctx.fillStyle = '#bbbbcc';
    ctx.font = '12px monospace';
    ctx.fillText(`Quad:   ${this.quads}`, rightX, statY + 20);
    ctx.fillText(`Triple: ${this.triples}`, rightX, statY + 38);
    ctx.fillText(`Double: ${this.doubles}`, rightX, statY + 56);
    ctx.fillText(`Single: ${this.singles}`, rightX, statY + 74);
    ctx.fillText(`T-Spin: ${this.tspins}`, rightX, statY + 92);
  }

  _drawMiniPiece(ctx, type, x, y, color) {
    const matrix = SHAPES[type][0];
    const miniCell = 14;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          ctx.fillStyle = color;
          ctx.fillRect(x + c * miniCell, y + r * miniCell, miniCell - 1, miniCell - 1);
        }
      }
    }
  }

  dispose() {
    this.loop.stop();
    this.input.dispose();
  }
}
