// @ts-check
// Memory Master logic with combo system, animations, and rating calculations

import { GameAudio, GameScoreService, SeededRng } from '../../games/engine/index.js';
import { icon } from '../../ui/dom.js';
import { MEMORY_THEMES } from './themes.js';

/**
 * @typedef {{ id: string, uniqueId: number, type: string, value: string, label: string, flipped: boolean, matched: boolean }} MemoryCard
 */

export const GRID_CONFIGS = {
  '4x4': { cols: 4, rows: 4, pairs: 8, targetMoves: 14, targetTime: 40 },
  '4x5': { cols: 5, rows: 4, pairs: 10, targetMoves: 18, targetTime: 55 },
  '6x6': { cols: 6, rows: 6, pairs: 18, targetMoves: 34, targetTime: 110 },
  '8x8': { cols: 8, rows: 8, pairs: 32, targetMoves: 68, targetTime: 240 },
};

export class MemoryGame {
  /**
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} options
   * @param {'4x4' | '4x5' | '6x6' | '8x8'} [options.gridSize]
   * @param {string} [options.themeId]
   * @param {() => void} [options.onComplete]
   */
  constructor(container, ctx, { gridSize = '4x4', themeId = 'icons', onComplete } = {}) {
    this.container = container;
    this.ctx = ctx;
    this.gridSize = gridSize;
    this.themeId = themeId;
    this.onComplete = onComplete;

    this.audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
    this.scores = new GameScoreService('nexus.memory', ctx);
    this.rng = new SeededRng();

    this.config = GRID_CONFIGS[gridSize] || GRID_CONFIGS['4x4'];
    this.theme = MEMORY_THEMES[themeId] || MEMORY_THEMES.icons;

    /** @type {MemoryCard[]} */
    this.cards = [];
    /** @type {MemoryCard[]} */
    this.flippedCards = [];

    this.moves = 0;
    this.matches = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.elapsedSeconds = 0;
    this.timerId = null;
    this.isLocked = false;
    this.isOver = false;

    this._createBoard();
    this._startTimer();
  }

  _startTimer() {
    this.timerId = /** @type {any} */ (
      setInterval(() => {
        if (!this.isOver) {
          this.elapsedSeconds++;
          const timerEl = this.container.querySelector('.nx-memory-timer-val');
          if (timerEl) {
            const mins = Math.floor(this.elapsedSeconds / 60);
            const secs = this.elapsedSeconds % 60;
            timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        }
      }, 1000)
    );
  }

  _createBoard() {
    // Pick required number of pairs from theme
    const themeItems = this.rng.shuffle([...this.theme.items]).slice(0, this.config.pairs);

    /** @type {MemoryCard[]} */
    const deck = [];
    let uid = 0;
    for (const item of themeItems) {
      deck.push({ ...item, uniqueId: ++uid, flipped: false, matched: false });
      deck.push({ ...item, uniqueId: ++uid, flipped: false, matched: false });
    }

    this.cards = this.rng.shuffle(deck);
    this._renderBoard();
  }

  _renderBoard() {
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'nx-memory-game-wrap';

    // HUD Header
    const hud = document.createElement('div');
    hud.className = 'nx-memory-hud';

    hud.innerHTML = `
      <div class="nx-hud-stat">
        <span class="nx-hud-label">MOVES</span>
        <span class="nx-hud-val nx-memory-moves-val">${this.moves}</span>
      </div>
      <div class="nx-hud-stat">
        <span class="nx-hud-label">MATCHES</span>
        <span class="nx-hud-val nx-memory-matches-val">${this.matches}/${this.config.pairs}</span>
      </div>
      <div class="nx-hud-stat">
        <span class="nx-hud-label">COMBO</span>
        <span class="nx-hud-val nx-memory-combo-val ${this.combo > 1 ? 'active' : ''}">x${Math.max(1, this.combo)}</span>
      </div>
      <div class="nx-hud-stat">
        <span class="nx-hud-label">SCORE</span>
        <span class="nx-hud-val nx-memory-score-val">${this.score}</span>
      </div>
      <div class="nx-hud-stat">
        <span class="nx-hud-label">TIME</span>
        <span class="nx-hud-val nx-memory-timer-val">0:00</span>
      </div>
    `;

    // Grid container
    const gridEl = document.createElement('div');
    gridEl.className = `nx-memory-grid cols-${this.config.cols} rows-${this.config.rows}`;
    gridEl.style.setProperty('--grid-cols', String(this.config.cols));
    gridEl.style.setProperty('--grid-rows', String(this.config.rows));

    for (const card of this.cards) {
      const cardEl = document.createElement('div');
      cardEl.className = 'nx-memory-card';
      cardEl.dataset.uid = String(card.uniqueId);

      const inner = document.createElement('div');
      inner.className = 'nx-memory-card-inner';

      // Card Back
      const back = document.createElement('div');
      back.className = 'nx-memory-card-face nx-card-back';
      back.innerHTML = '<span class="nx-card-logo">N</span>';

      // Card Front
      const front = document.createElement('div');
      front.className = 'nx-memory-card-face nx-card-front';

      if (card.type === 'icon') {
        const ic = icon(card.value);
        front.append(ic);
      } else if (card.type === 'color') {
        front.style.background = card.value;
        front.style.boxShadow = `0 0 16px ${card.value}`;
      } else {
        front.textContent = card.value;
      }

      inner.append(back, front);
      cardEl.append(inner);

      cardEl.addEventListener('click', () => this._handleCardClick(card, cardEl));
      gridEl.append(cardEl);
    }

    root.append(hud, gridEl);
    this.container.append(root);
  }

  /**
   * @param {MemoryCard} card
   * @param {HTMLElement} cardEl
   */
  async _handleCardClick(card, cardEl) {
    if (this.isLocked || card.flipped || card.matched || this.flippedCards.length >= 2) return;

    // Flip card
    card.flipped = true;
    cardEl.classList.add('flipped');
    this.audio.play('jump');
    this.flippedCards.push(card);

    if (this.flippedCards.length === 2) {
      this.moves++;
      this._updateHud();
      const [c1, c2] = this.flippedCards;

      if (c1.id === c2.id) {
        // MATCH!
        this.matches++;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        c1.matched = true;
        c2.matched = true;
        this.flippedCards = [];

        const points = 100 * this.combo;
        this.score += points;
        this.audio.play('coin');

        // Achievements check
        this.scores.unlockAchievement('memory_first_match');
        if (this.combo >= 3) this.scores.unlockAchievement('memory_combo_3');

        // Add match effect classes
        const el1 = this.container.querySelector(`[data-uid="${c1.uniqueId}"]`);
        const el2 = this.container.querySelector(`[data-uid="${c2.uniqueId}"]`);
        el1?.classList.add('matched');
        el2?.classList.add('matched');

        this._updateHud();

        // Check victory
        if (this.matches >= this.config.pairs) {
          this._handleVictory();
        }
      } else {
        // MISMATCH
        this.combo = 0;
        this.isLocked = true;
        this.audio.play('hit');
        this._updateHud();

        setTimeout(() => {
          c1.flipped = false;
          c2.flipped = false;
          const el1 = this.container.querySelector(`[data-uid="${c1.uniqueId}"]`);
          const el2 = this.container.querySelector(`[data-uid="${c2.uniqueId}"]`);
          el1?.classList.remove('flipped');
          el2?.classList.remove('flipped');
          this.flippedCards = [];
          this.isLocked = false;
        }, 850);
      }
    }
  }

  _updateHud() {
    const movesEl = this.container.querySelector('.nx-memory-moves-val');
    const matchesEl = this.container.querySelector('.nx-memory-matches-val');
    const comboEl = this.container.querySelector('.nx-memory-combo-val');
    const scoreEl = this.container.querySelector('.nx-memory-score-val');

    if (movesEl) movesEl.textContent = String(this.moves);
    if (matchesEl) matchesEl.textContent = `${this.matches}/${this.config.pairs}`;
    if (comboEl) {
      comboEl.textContent = `x${Math.max(1, this.combo)}`;
      comboEl.classList.toggle('active', this.combo > 1);
    }
    if (scoreEl) scoreEl.textContent = String(this.score);
  }

  async _handleVictory() {
    this.isOver = true;
    if (this.timerId) clearInterval(this.timerId);
    this.audio.play('victory');

    // Calculate stars (1-3)
    let stars = 1;
    if (this.moves <= this.config.targetMoves * 1.25 && this.elapsedSeconds <= this.config.targetTime) {
      stars = 3;
    } else if (this.moves <= this.config.targetMoves * 1.7) {
      stars = 2;
    }

    if (stars === 3) this.scores.unlockAchievement('memory_3_stars');
    if (this.gridSize === '8x8') this.scores.unlockAchievement('memory_grid_8x8');
    if (this.gridSize === '4x4' && this.elapsedSeconds < 30) this.scores.unlockAchievement('memory_speedrun');

    const { isNewHigh } = await this.scores.submitScore(this.score, this.gridSize);
    await this.scores.recordTime(this.elapsedSeconds);

    const xpEarned = stars * 15;

    // Victory modal
    const overlay = document.createElement('div');
    overlay.className = 'nx-game-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'nx-game-modal';

    const starIcons = '★ '.repeat(stars) + '☆ '.repeat(3 - stars);

    modal.innerHTML = `
      <h2 class="nx-game-modal-title">VICTORY!</h2>
      <div style="font-size: 28px; color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.6);">${starIcons.trim()}</div>
      <div class="nx-game-score-box">
        <div class="nx-game-score-label">FINAL SCORE</div>
        <div class="nx-game-score-num">${this.score}</div>
        <div class="nx-game-badge">${this.moves} Moves in ${this.elapsedSeconds}s</div>
        ${isNewHigh ? '<div class="nx-game-badge nx-badge-high">★ NEW HIGH SCORE! ★</div>' : ''}
        <div class="nx-game-xp-badge">+${xpEarned} XP Earned</div>
      </div>
      <div class="nx-game-modal-actions">
        <button class="nx-game-btn nx-btn-primary nx-memory-btn-again">Play Again</button>
        <button class="nx-game-btn nx-memory-btn-menu">Main Menu</button>
      </div>
    `;

    modal.querySelector('.nx-memory-btn-again')?.addEventListener('click', () => {
      overlay.remove();
      this.cards = [];
      this.flippedCards = [];
      this.moves = 0;
      this.matches = 0;
      this.combo = 0;
      this.score = 0;
      this.elapsedSeconds = 0;
      this.isLocked = false;
      this.isOver = false;
      this._createBoard();
      this._startTimer();
    });

    modal.querySelector('.nx-memory-btn-menu')?.addEventListener('click', () => {
      overlay.remove();
      this.dispose();
      this.onComplete?.();
    });

    overlay.append(modal);
    this.container.append(overlay);
  }

  dispose() {
    this.isOver = true;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.audio.dispose();
  }
}
