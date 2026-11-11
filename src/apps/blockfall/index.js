// @ts-check
import { h } from '../../ui/dom.js';
import { BlockfallGame } from './game.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-blockfall-app' });
  const canvasWrap = h('div', { class: 'nx-blockfall-canvas-wrap' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-blockfall-canvas' }));
  canvasWrap.append(canvas);

  /** @type {BlockfallGame | null} */
  let game = null;
  /** @type {import('./game.js').BlockfallMode} */
  let selectedMode = 'marathon';

  function renderMenu() {
    if (game) {
      game.dispose();
      game = null;
    }

    const menu = h('div', { class: 'nx-blockfall-menu' });
    const title = h('h1', { class: 'nx-blockfall-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-blockfall-subtitle' }, t('app.description'));

    const modesWrap = h('div', { class: 'nx-blockfall-modes' });
    const modes = /** @type {const} */ (['marathon', 'sprint', 'ultra', 'zen']);

    /** @type {Record<string, HTMLButtonElement>} */
    const modeButtons = {};

    for (const m of modes) {
      const btn = /** @type {HTMLButtonElement} */ (
        h('button', { class: `nx-blockfall-mode-btn ${m === selectedMode ? 'active' : ''}` }, t(`modes.${m}`))
      );
      btn.addEventListener('click', () => {
        selectedMode = m;
        for (const k of modes) {
          modeButtons[k].classList.toggle('active', k === selectedMode);
        }
      });
      modeButtons[m] = btn;
      modesWrap.append(btn);
    }

    const playBtn = h('button', { class: 'nx-blockfall-play-btn' }, t('menu.play'));
    playBtn.addEventListener('click', () => {
      menu.remove();
      startGame(selectedMode);
    });

    const hint = h('div', { class: 'nx-blockfall-hint' }, t('menu.controls'));

    menu.append(title, subtitle, modesWrap, playBtn, hint);
    root.append(menu);
  }

  /**
   * @param {import('./game.js').BlockfallMode} mode
   */
  function startGame(mode) {
    game = new BlockfallGame(canvas, root, ctx, {
      mode,
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
  blockfall: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Blockfall...');
    if (ctx.commands) {
      await ctx.commands.execute('blockfall.open');
    }
    return 0;
  },
};
