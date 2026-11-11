// @ts-check
import { h } from '../../ui/dom.js';
import { MemoryGame } from './game.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-memory-app' });
  const boardWrap = h('div', { class: 'nx-memory-board-wrap', style: 'width: 100%; height: 100%;' });

  /** @type {MemoryGame | null} */
  let game = null;

  function renderMenu() {
    if (game) {
      game.dispose();
      game = null;
    }
    boardWrap.innerHTML = '';

    const menu = h('div', { class: 'nx-memory-menu' });
    const title = h('h1', { class: 'nx-memory-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-memory-subtitle' }, t('app.description'));

    const settingsGrid = h('div', { class: 'nx-memory-settings-grid' });

    // Grid size
    const sizeSelect = h('select');
    for (const sz of ['4x4', '4x5', '6x6', '8x8']) {
      sizeSelect.append(h('option', { value: sz }, sz));
    }
    const sizeGroup = h('div', { class: 'nx-memory-form-group' }, h('label', {}, t('menu.gridSize')), sizeSelect);

    // Theme select
    const themeSelect = h('select');
    for (const th of ['icons', 'colors', 'cs_terms', 'numbers']) {
      themeSelect.append(h('option', { value: th }, t(`themes.${th}`)));
    }
    const themeGroup = h('div', { class: 'nx-memory-form-group' }, h('label', {}, t('menu.theme')), themeSelect);

    settingsGrid.append(sizeGroup, themeGroup);

    const playBtn = h('button', { class: 'nx-memory-play-btn' }, t('menu.play'));
    playBtn.addEventListener('click', () => {
      menu.remove();
      startGame(sizeSelect.value, themeSelect.value);
    });

    const hint = h('div', { class: 'nx-snake-controls-hint' }, t('menu.controls'));

    menu.append(title, subtitle, settingsGrid, playBtn, hint);
    root.append(menu);
  }

  /**
   * @param {any} gridSize
   * @param {string} themeId
   */
  function startGame(gridSize, themeId) {
    game = new MemoryGame(boardWrap, ctx, {
      gridSize,
      themeId,
      onComplete: () => renderMenu(),
    });
  }

  root.append(boardWrap);
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
  memory: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Memory Master...');
    if (ctx.commands) {
      await ctx.commands.execute('memory.open');
    }
    return 0;
  },
};
