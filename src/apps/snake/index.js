// @ts-check
import { h } from '../../ui/dom.js';
import { SnakeGame } from './game.js';
import { SNAKE_MAPS } from './maps.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-snake-app' });
  const canvasWrap = h('div', { class: 'nx-snake-canvas-wrap' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-snake-canvas' }));
  canvasWrap.append(canvas);

  /** @type {SnakeGame | null} */
  let game = null;

  function renderMenu() {
    if (game) {
      game.dispose();
      game = null;
    }

    const menu = h('div', { class: 'nx-snake-menu' });
    const title = h('h1', { class: 'nx-snake-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-snake-subtitle' }, t('app.description'));

    const settingsGrid = h('div', { class: 'nx-snake-settings-grid' });

    // Map selection
    const mapSelect = h('select');
    for (const id of Object.keys(SNAKE_MAPS)) {
      const opt = h('option', { value: id }, t(`maps.${id}`));
      mapSelect.append(opt);
    }
    const mapGroup = h('div', { class: 'nx-snake-form-group' }, h('label', {}, t('menu.map')), mapSelect);

    // Mode selection
    const modeSelect = h('select');
    for (const m of ['classic', 'timeAttack', 'survival', 'zen']) {
      const opt = h('option', { value: m }, t(`modes.${m}`));
      modeSelect.append(opt);
    }
    const modeGroup = h('div', { class: 'nx-snake-form-group' }, h('label', {}, t('menu.mode')), modeSelect);

    // Difficulty / Speed
    const diffSelect = h('select');
    diffSelect.append(
      h('option', { value: 'normal' }, t('menu.normal')),
      h('option', { value: 'hard' }, t('menu.hard')),
    );
    const diffGroup = h('div', { class: 'nx-snake-form-group' }, h('label', {}, t('menu.difficulty')), diffSelect);

    settingsGrid.append(mapGroup, modeGroup, diffGroup);

    const playBtn = h('button', { class: 'nx-snake-play-btn' }, t('menu.play'));
    const hint = h('div', { class: 'nx-snake-controls-hint' }, t('menu.controls'));
    const pauseHint = h('div', { class: 'nx-snake-controls-hint' }, t('menu.pause'));

    playBtn.addEventListener('click', () => {
      menu.remove();
      startGame(mapSelect.value, modeSelect.value, diffSelect.value);
    });

    menu.append(title, subtitle, settingsGrid, playBtn, hint, pauseHint);
    root.append(menu);
  }

  /**
   * @param {string} mapId
   * @param {any} mode
   * @param {any} difficulty
   */
  function startGame(mapId, mode, difficulty) {
    game = new SnakeGame(canvas, root, ctx, {
      mapId,
      mode,
      difficulty,
      onQuit: () => renderMenu(),
    });
  }

  root.append(canvasWrap);
  renderMenu();
  container.append(root);

  return () => {
    if (game) {
      game.dispose();
      game = null;
    }
  };
}

export const terminal = {
  snake: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Snake Evolution...');
    if (ctx.commands) {
      await ctx.commands.execute('snake.open');
    }
    return 0;
  },
};
