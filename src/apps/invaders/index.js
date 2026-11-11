// @ts-check
import { h } from '../../ui/dom.js';
import { InvadersGame } from './game.js';
import './styles.css';

const APP_ID = 'nexus.invaders';

export const commands = {
  'invaders.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  invaders: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const root = h('div', { class: 'nx-invaders', 'data-testid': `${APP_ID}.root` });
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', { class: 'nx-invaders-canvas', 'data-testid': 'invaders-canvas', tabindex: '0' })
  );
  root.append(canvas);
  container.append(root);

  const game = new InvadersGame(canvas, root, ctx, {
    onQuit: () => ctx.window?.close(),
  });

  queueMicrotask(() => canvas.focus());

  return {
    unmount: () => {
      game.dispose();
      root.remove();
    },
    onSuspend: () => game.pause(),
    onResume: () => {},
  };
}
