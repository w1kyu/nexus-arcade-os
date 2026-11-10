// @ts-check
// Habits desktop widget: quick daily check-ins and streaks overview.
import { button, h, icon, replace } from '../../ui/dom.js';
import { computeHabitStreaks } from './model.js';

/** @typedef {import('./model.js').HabitItem} HabitItem */
/** @typedef {import('./model.js').HabitLog} HabitLog */

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export async function mount(root, ctx) {
  const habitsCol = /** @type {import('../../kernel/types').Collection<HabitItem>} */ (
    ctx.storage.collection('habits')
  );
  const logsCol = /** @type {import('../../kernel/types').Collection<HabitLog>} */ (ctx.storage.collection('logs'));

  async function render() {
    const habits = await habitsCol.all();
    const logs = await logsCol.all();
    const today = new Date().toISOString().split('T')[0];

    if (habits.length === 0) {
      replace(
        root,
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '6px',
              fontSize: '12px',
              opacity: '0.75',
            },
          },
          h('span', { text: ctx.i18n.t('noHabitsYet') }),
          button({
            label: ctx.i18n.t('newHabit'),
            size: 'small',
            onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.habits' }),
          }),
        ),
      );
      return;
    }

    const items = habits.map((habit) => {
      const todayLog = logs.find((l) => l.habitId === habit.id && l.date === today);
      const isDone = Boolean(todayLog?.completed || todayLog?.isRestDay);
      const { currentStreak } = computeHabitStreaks(habit, logs);

      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: 'var(--nx-bg-surface, #1a1d26)',
            borderRadius: '6px',
            border: '1px solid var(--nx-border, #2d3342)',
            opacity: isDone ? '0.75' : '1',
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' } },
          icon(habit.icon || 'flame', { size: 14 }),
          h('span', {
            style: { fontSize: '13px', fontWeight: '500', textDecoration: isDone ? 'line-through' : 'none' },
            text: habit.name,
          }),
          h('span', { style: { fontSize: '11px', color: '#ff8a3d', fontWeight: '700' }, text: `🔥 ${currentStreak}` }),
        ),
        button({
          label: isDone ? '✓' : '○',
          size: 'small',
          variant: isDone ? 'primary' : 'secondary',
          onClick: async () => {
            if (isDone) {
              if (todayLog) await logsCol.delete(todayLog.id);
            } else {
              await logsCol.put({
                id: `${habit.id}:${today}`,
                habitId: habit.id,
                date: today,
                value: habit.targetValue || 1,
                completed: true,
                isRestDay: false,
              });
            }
          },
        }),
      );
    });

    replace(
      root,
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            height: '100%',
            padding: '6px',
            overflowY: 'auto',
          },
        },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('strong', { style: { fontSize: '13px' }, text: ctx.i18n.t('appTitle') }),
          button({
            icon: 'flame',
            size: 'small',
            onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.habits' }),
          }),
        ),
        ...items,
      ),
    );
  }

  habitsCol.onChange(() => void render());
  logsCol.onChange(() => void render());
  await render();
}
