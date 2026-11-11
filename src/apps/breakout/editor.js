// @ts-check
// Breakout Level Editor with VFS Save/Load and Test Play

import { h } from '../../ui/dom.js';
import { COLS, ROWS } from './levels.js';

const BLOCK_TYPES = [
  { id: 0, name: 'Empty', color: '#1a1e36' },
  { id: 1, name: 'Normal', color: '#00f0ff' },
  { id: 2, name: 'Multi-Hit', color: '#f39c12' },
  { id: 3, name: 'Heavy', color: '#9b59b6' },
  { id: 4, name: 'Metal', color: '#7f8c8d' },
  { id: 5, name: 'Explosive', color: '#e74c3c' },
  { id: 6, name: 'Power-Up', color: '#f1c40f' },
];

export class BreakoutEditor {
  /**
   * @param {HTMLElement} container
   * @param {import('../../kernel/types').AppContext} ctx
   * @param {object} options
   * @param {(layout: number[][]) => void} options.onTestPlay
   * @param {() => void} options.onBack
   */
  constructor(container, ctx, { onTestPlay, onBack }) {
    this.container = container;
    this.ctx = ctx;
    this.onTestPlay = onTestPlay;
    this.onBack = onBack;

    this.selectedType = 1;
    this.isDrawing = false;

    /** @type {number[][]} */
    this.layout = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    /** @type {HTMLButtonElement[][]} */
    this.cellElements = [];

    this.root = h('div', { class: 'nx-breakout-editor' });
    this._render();
  }

  _render() {
    this.root.innerHTML = '';
    const header = h('div', { class: 'nx-editor-header' });
    const title = h('h2', { class: 'nx-editor-title' }, 'Breakout Level Editor');

    const btnBack = h('button', { class: 'nx-game-btn' }, 'Back');
    btnBack.addEventListener('click', () => this.onBack());

    const btnTest = h('button', { class: 'nx-game-btn nx-btn-primary' }, 'Test Play');
    btnTest.addEventListener('click', () => {
      this.onTestPlay(this.layout);
    });

    const btnSave = h('button', { class: 'nx-game-btn' }, 'Save VFS');
    btnSave.addEventListener('click', () => this._saveToVfs());

    const btnLoad = h('button', { class: 'nx-game-btn' }, 'Load VFS');
    btnLoad.addEventListener('click', () => this._loadFromVfs());

    const btnClear = h('button', { class: 'nx-game-btn nx-btn-danger' }, 'Clear');
    btnClear.addEventListener('click', () => {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          this.layout[r][c] = 0;
          this.cellElements[r][c].style.background = BLOCK_TYPES[0].color;
        }
      }
    });

    header.append(title, h('div', { class: 'nx-editor-actions' }, btnTest, btnSave, btnLoad, btnClear, btnBack));

    // Palette
    const palette = h('div', { class: 'nx-editor-palette' });
    for (const bt of BLOCK_TYPES) {
      const btn = h('button', {
        class: `nx-palette-btn ${this.selectedType === bt.id ? 'active' : ''}`,
        style: `border-color: ${bt.color}`,
      });
      const swatch = h('span', { class: 'nx-palette-swatch', style: `background: ${bt.color}` });
      const label = h('span', {}, bt.name);
      btn.append(swatch, label);

      btn.addEventListener('click', () => {
        this.selectedType = bt.id;
        palette.querySelectorAll('.nx-palette-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
      palette.append(btn);
    }

    // Grid
    const grid = h('div', { class: 'nx-editor-grid' });
    this.cellElements = [];

    const handlePaint = (r, c) => {
      this.layout[r][c] = this.selectedType;
      this.cellElements[r][c].style.background = BLOCK_TYPES[this.selectedType].color;
    };

    window.addEventListener('mouseup', () => {
      this.isDrawing = false;
    });

    for (let r = 0; r < ROWS; r++) {
      this.cellElements[r] = [];
      const rowEl = h('div', { class: 'nx-editor-row' });
      for (let c = 0; c < COLS; c++) {
        const type = this.layout[r][c];
        const cell = /** @type {HTMLButtonElement} */ (
          h('button', {
            class: 'nx-editor-cell',
            style: `background: ${BLOCK_TYPES[type].color}`,
          })
        );

        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.isDrawing = true;
          handlePaint(r, c);
        });

        cell.addEventListener('mouseenter', () => {
          if (this.isDrawing) handlePaint(r, c);
        });

        this.cellElements[r][c] = cell;
        rowEl.append(cell);
      }
      grid.append(rowEl);
    }

    this.root.append(header, palette, grid);
    this.container.append(this.root);
  }

  async _saveToVfs() {
    try {
      if (this.ctx?.fs?.write) {
        await this.ctx.fs.write('/user/breakout/custom-level.json', JSON.stringify(this.layout, null, 2));
        alert('Saved to /user/breakout/custom-level.json');
      } else {
        localStorage.setItem('breakout:custom-level', JSON.stringify(this.layout));
        alert('Level saved locally!');
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  }

  async _loadFromVfs() {
    try {
      let data = null;
      if (this.ctx?.fs?.read) {
        data = await this.ctx.fs.read('/user/breakout/custom-level.json');
      } else {
        data = localStorage.getItem('breakout:custom-level');
      }
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length === ROWS) {
          this.layout = parsed;
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const type = this.layout[r][c];
              this.cellElements[r][c].style.background = BLOCK_TYPES[type].color;
            }
          }
          alert('Level loaded successfully!');
        }
      } else {
        alert('No custom level found in /user/breakout/custom-level.json');
      }
    } catch (err) {
      alert(`Load failed: ${err.message}`);
    }
  }

  destroy() {
    this.root.remove();
  }
}
