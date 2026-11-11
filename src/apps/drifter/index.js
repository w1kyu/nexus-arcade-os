// @ts-check
import { h } from '../../ui/dom.js';
import { DrifterGame } from './game.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-drifter-app' });
  const canvasWrap = h('div', { class: 'nx-drifter-canvas-wrap' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-drifter-canvas' }));
  canvasWrap.append(canvas);

  /** @type {DrifterGame | null} */
  let game = null;

  function renderMenu() {
    if (game) {
      game.dispose();
      game = null;
    }

    const menu = h('div', { class: 'nx-drifter-menu' });
    const title = h('h1', { class: 'nx-drifter-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-drifter-subtitle' }, t('app.description'));

    const playBtn = h('button', { class: 'nx-drifter-play-btn' }, t('menu.play'));
    playBtn.addEventListener('click', () => {
      menu.remove();
      startGame();
    });

    const hint = h('div', { class: 'nx-drifter-hint' }, t('menu.controls'));

    menu.append(title, subtitle, playBtn, hint);
    root.append(menu);
  }

  function startGame() {
    game = new DrifterGame(canvas, root, ctx, {
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
  drifter: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Void Drifter...');
    if (ctx.commands) {
      await ctx.commands.execute('drifter.open');
    }
    return 0;
  },
};
