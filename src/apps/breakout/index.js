// @ts-check
import { h } from '../../ui/dom.js';
import { BreakoutEditor } from './editor.js';
import { BreakoutGame } from './game.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-breakout-app' });
  const canvasWrap = h('div', { class: 'nx-breakout-canvas-wrap' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-breakout-canvas' }));
  canvasWrap.append(canvas);

  /** @type {BreakoutGame | null} */
  let game = null;
  /** @type {BreakoutEditor | null} */
  let editor = null;

  function renderMenu() {
    if (game) {
      game.dispose();
      game = null;
    }
    if (editor) {
      editor.destroy();
      editor = null;
    }

    const menu = h('div', { class: 'nx-breakout-menu' });
    const title = h('h1', { class: 'nx-breakout-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-breakout-subtitle' }, t('app.description'));

    const actions = h('div', { class: 'nx-breakout-menu-actions' });

    const btnCampaign = h('button', { class: 'nx-game-btn nx-btn-primary' }, t('menu.campaign'));
    btnCampaign.addEventListener('click', () => {
      menu.remove();
      startGame(1);
    });

    const btnEditor = h('button', { class: 'nx-game-btn' }, t('menu.editor'));
    btnEditor.addEventListener('click', () => {
      menu.remove();
      openEditor();
    });

    actions.append(btnCampaign, btnEditor);

    const hint = h('div', { class: 'nx-snake-controls-hint' }, t('menu.controls'));

    menu.append(title, subtitle, actions, hint);
    root.append(menu);
  }

  /**
   * @param {number} startLevel
   * @param {number[][]} [customLayout]
   */
  function startGame(startLevel, customLayout) {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    game = new BreakoutGame(canvas, root, ctx, {
      startLevel,
      customLayout,
      onQuit: () => renderMenu(),
    });
  }

  function openEditor() {
    if (game) {
      game.dispose();
      game = null;
    }
    editor = new BreakoutEditor(root, ctx, {
      onTestPlay: (layout) => {
        editor?.destroy();
        editor = null;
        startGame(1, layout);
      },
      onBack: () => renderMenu(),
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
    if (editor) {
      editor.destroy();
      editor = null;
    }
  };
}

export const terminal = {
  breakout: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Breakout Nexus...');
    if (ctx.commands) {
      await ctx.commands.execute('breakout.open');
    }
    return 0;
  },
};
