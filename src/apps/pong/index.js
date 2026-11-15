// @ts-check
import { h } from '../../ui/dom.js';
import { PongGame } from './game.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-pong-app' });
  const canvasWrap = h('div', { class: 'nx-pong-canvas-wrap' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-pong-canvas' }));
  canvasWrap.append(canvas);

  /** @type {PongGame | null} */
  let game = null;
  /** @type {'ai' | 'pvp'} */
  let selectedMode = args?.mode === 'local' || args?.mode === 'pvp' ? 'pvp' : 'ai';
  /** @type {import('./game.js').PongAiDifficulty} */
  let selectedDiff = 'skilled';
  let powerUpsEnabled = true;

  function renderMenu() {
    if (game) {
      game.dispose();
      game = null;
    }

    const menu = h('div', { class: 'nx-pong-menu' });
    const title = h('h1', { class: 'nx-pong-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-pong-subtitle' }, t('app.description'));

    const optionsWrap = h('div', { class: 'nx-pong-options' });

    // Mode Selector (vs AI or 2-Player)
    const modeGroup = h('div', { class: 'nx-pong-btn-group' });
    const btnAi = /** @type {HTMLButtonElement} */ (
      h('button', { class: 'nx-btn is-sm', 'aria-pressed': String(selectedMode === 'ai') }, t('modes.ai'))
    );
    const btnPvp = /** @type {HTMLButtonElement} */ (
      h('button', { class: 'nx-btn is-sm', 'aria-pressed': String(selectedMode === 'pvp') }, t('modes.pvp'))
    );

    btnAi.addEventListener('click', () => {
      selectedMode = 'ai';
      btnAi.setAttribute('aria-pressed', 'true');
      btnPvp.setAttribute('aria-pressed', 'false');
      diffGroup.style.display = 'flex';
    });
    btnPvp.addEventListener('click', () => {
      selectedMode = 'pvp';
      btnPvp.setAttribute('aria-pressed', 'true');
      btnAi.setAttribute('aria-pressed', 'false');
      diffGroup.style.display = 'none';
    });
    modeGroup.append(btnAi, btnPvp);

    // AI Difficulty
    const diffGroup = h('div', { class: 'nx-pong-btn-group' });
    /** @type {Record<string, HTMLButtonElement>} */
    const diffBtns = {};
    for (const d of ['casual', 'skilled', 'master']) {
      const btn = /** @type {HTMLButtonElement} */ (
        h('button', { class: 'nx-btn is-sm', 'aria-pressed': String(d === selectedDiff) }, t(`difficulty.${d}`))
      );
      btn.addEventListener('click', () => {
        selectedDiff = /** @type {any} */ (d);
        for (const [k, b] of Object.entries(diffBtns)) {
          b.setAttribute('aria-pressed', String(k === selectedDiff));
        }
      });
      diffBtns[d] = btn;
      diffGroup.append(btn);
    }

    // Power-ups toggle
    const btnPowerups = h(
      'button',
      { class: 'nx-btn is-sm', 'aria-pressed': String(!!powerUpsEnabled) },
      t('menu.powerups') + ': ' + (powerUpsEnabled ? 'ON' : 'OFF'),
    );
    btnPowerups.addEventListener('click', () => {
      powerUpsEnabled = !powerUpsEnabled;
      btnPowerups.setAttribute('aria-pressed', String(!!powerUpsEnabled));
      btnPowerups.textContent = t('menu.powerups') + ': ' + (powerUpsEnabled ? 'ON' : 'OFF');
    });

    optionsWrap.append(modeGroup, diffGroup, btnPowerups);

    const playBtn = h('button', { class: 'nx-btn is-lg is-primary', 'data-testid': 'play' }, t('menu.play'));
    playBtn.addEventListener('click', () => {
      menu.remove();
      startGame();
    });

    const hint = h('div', { class: 'nx-pong-hint' }, t('menu.controls'));

    menu.append(title, subtitle, optionsWrap, playBtn, hint);
    root.append(menu);
  }

  function startGame() {
    game = new PongGame(canvas, root, ctx, {
      mode: selectedMode,
      aiDifficulty: selectedDiff,
      powerUpsEnabled,
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
  pong: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Neon Pong...');
    if (ctx.commands) {
      await ctx.commands.execute('pong.open');
    }
    return 0;
  },
};
