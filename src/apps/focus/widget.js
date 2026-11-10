// @ts-check
// Focus Goal desktop widget: shows today's focus minutes vs daily goal.
import { button, h, replace } from '../../ui/dom.js';
import { computeFocusStats } from './model.js';

/** @typedef {import('./model.js').FocusSessionRecord} FocusSessionRecord */

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export async function mount(root, ctx) {
  const sessionsCol = /** @type {import('../../kernel/types').Collection<FocusSessionRecord>} */ (
    ctx.storage.collection('sessions')
  );

  async function render() {
    const all = await sessionsCol.all();
    const goal = Number(ctx.settings.get('dailyGoalMinutes')) || 240;
    const stats = computeFocusStats(all, goal);
    const pct = Math.round(stats.dailyGoalProgress * 100);

    replace(
      root,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', padding: '4px' } },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('strong', { text: ctx.i18n.t('appTitle') }),
          h('span', { style: { fontSize: '11px', opacity: '0.75' }, text: `${pct}%` }),
        ),
        h('div', { style: { fontSize: '20px', fontWeight: '700' } }, `${stats.todayMinutes} / ${goal} min`),
        h(
          'div',
          {
            style: {
              height: '8px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            },
          },
          h('div', {
            style: {
              width: `${pct}%`,
              height: '100%',
              background: 'var(--nx-accent, #38bdf8)',
            },
          }),
        ),
        button({
          label: ctx.i18n.t('openFocus'),
          icon: 'timer',
          onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.focus' }),
        }),
      ),
    );
  }

  sessionsCol.onChange(() => void render());
  await render();
}
