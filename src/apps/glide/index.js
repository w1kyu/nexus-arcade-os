// @ts-check
import { h } from '../../ui/dom.js';
import { GlideGame } from './game.js';
import './styles.css';

const APP_ID = 'nexus.glide';

export const commands = {
  'glide.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  glide: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const root = h('div', { class: 'nx-glide', 'data-testid': `${APP_ID}.root` });
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', { class: 'nx-glide-canvas', 'data-testid': 'glide-canvas', tabindex: '0' })
  );
  root.append(canvas);
  container.append(root);

  const game = new GlideGame(canvas, root, ctx, {
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
