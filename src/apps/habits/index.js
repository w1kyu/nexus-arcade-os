// @ts-check
// Nexus Habits: habit tracking, streak counters, 52-week heatmaps, rest days,
// and quick check-ins from widget, command palette, and terminal.
import { button, h, icon, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { computeHabitStreaks, generateHabitHeatmap } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').HabitItem} HabitItem */
/** @typedef {import('./model.js').HabitLog} HabitLog */

/**
 * Terminal command: `habit [list | done <name>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async habit(ctx, io) {
    const habitsCol = /** @type {import('../../kernel/types').Collection<HabitItem>} */ (
      ctx.storage.collection('habits')
    );
    const logsCol = /** @type {import('../../kernel/types').Collection<HabitLog>} */ (ctx.storage.collection('logs'));

    const habits = await habitsCol.all();
    const logs = await logsCol.all();
    const today = new Date().toISOString().split('T')[0];

    const sub = io.args[0] ?? 'list';

    if (sub === 'list') {
      io.out(`--- Habits (${habits.length}) ---\n`);
      for (const h of habits) {
        const { currentStreak, completionRate } = computeHabitStreaks(h, logs);
        const todayLog = logs.find((l) => l.habitId === h.id && l.date === today);
        const status = todayLog?.completed ? '[DONE]' : todayLog?.isRestDay ? '[REST]' : '[TODO]';
        io.out(`• ${status} ${h.name} — Streak: ${currentStreak}d (${completionRate}%)\n`);
      }
      return 0;
    }

    if (sub === 'done') {
      const query = io.args.slice(1).join(' ').trim();
      if (!query) {
        io.err('Usage: habit done <name>\n');
        return 1;
      }
      const target = habits.find((h) => h.name.toLowerCase().includes(query.toLowerCase()));
      if (!target) {
        io.err(`No habit found matching "${query}"\n`);
        return 1;
      }
      const logId = `${target.id}:${today}`;
      await logsCol.put({
        id: logId,
        habitId: target.id,
        date: today,
        value: target.targetValue || 1,
        completed: true,
        isRestDay: false,
      });
      const { currentStreak } = computeHabitStreaks(target, await logsCol.all());
      io.out(`Checked in "${target.name}"! Current streak: ${currentStreak} day(s) 🔥\n`);
      return 0;
    }

    io.err(`Unknown subcommand "${sub}". Try: habit [list | done <name>]\n`);
    return 1;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'habits.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.habits', args: { action: 'new' } }),
  'habits.check': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.habits' }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  const habitsCol = /** @type {import('../../kernel/types').Collection<HabitItem>} */ (
    ctx.storage.collection('habits')
  );
  const logsCol = /** @type {import('../../kernel/types').Collection<HabitLog>} */ (ctx.storage.collection('logs'));

  const container = h('div', { class: 'nx-habits' });
  replace(root, container);

  async function render() {
    const habits = await habitsCol.all();
    const logs = await logsCol.all();
    const today = new Date().toISOString().split('T')[0];

    // Toolbar
    const toolbar = h(
      'header',
      { class: 'nx-habits-toolbar' },
      h(
        'div',
        { class: 'nx-habits-toolbar-title' },
        icon('flame', { size: 18 }),
        h('span', { text: ctx.i18n.t('habits') }),
      ),
      h(
        'div',
        { class: 'nx-habits-toolbar-actions' },
        button({
          label: ctx.i18n.t('newHabit'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => showHabitModal(),
        }),
      ),
    );

    // Content area
    const content = h('div', { class: 'nx-habits-content' });

    if (habits.length === 0) {
      content.appendChild(
        h(
          'div',
          { class: 'nx-habits-empty' },
          icon('flame', { size: 48 }),
          h('p', { text: ctx.i18n.t('noHabitsYet') }),
          button({
            label: ctx.i18n.t('newHabit'),
            variant: 'primary',
            onClick: () => showHabitModal(),
          }),
        ),
      );
    } else {
      const grid = h('div', { class: 'nx-habits-grid' });

      for (const habit of habits) {
        const todayLog = logs.find((l) => l.habitId === habit.id && l.date === today);
        const isDone = Boolean(todayLog?.completed);
        const isRest = Boolean(todayLog?.isRestDay);
        const { currentStreak, bestStreak, completionRate } = computeHabitStreaks(habit, logs);
        const heatmapData = generateHabitHeatmap(habit.id, logs);

        // Heatmap DOM
        const heatmapCells = heatmapData.map((d) =>
          h('div', {
            class: 'nx-heatmap-cell',
            dataset: { level: String(d.level) },
            title: `${d.date}: ${d.count > 0 ? d.count : d.level === 1 ? 'Rest day' : 'No activity'}`,
          }),
        );

        const card = h(
          'div',
          { class: 'nx-habit-card' },
          h(
            'div',
            { class: 'nx-habit-header' },
            h(
              'div',
              { class: 'nx-habit-title-row' },
              h('div', { class: 'nx-habit-icon-badge' }, icon(habit.icon || 'flame', { size: 18 })),
              h(
                'div',
                { class: 'nx-habit-info' },
                h('div', { class: 'nx-habit-name', text: habit.name }),
                h(
                  'div',
                  { class: 'nx-habit-sub' },
                  habit.freq === 'daily'
                    ? ctx.i18n.t('freqDaily')
                    : habit.freq === 'weekdays'
                      ? ctx.i18n.t('freqWeekdays')
                      : `${habit.targetPerWeek || 3}x ${ctx.i18n.t('freqNPerWeek')}`,
                ),
              ),
            ),
            h(
              'div',
              { class: 'nx-habit-stats' },
              h(
                'div',
                { class: 'nx-habit-stat' },
                h('span', { class: 'nx-habit-stat-val', text: `${currentStreak}d` }),
                h('span', { text: ctx.i18n.t('streak') }),
              ),
              h(
                'div',
                { class: 'nx-habit-stat' },
                h('span', { class: 'nx-habit-stat-val', text: `${bestStreak}d` }),
                h('span', { text: ctx.i18n.t('bestStreak') }),
              ),
              h(
                'div',
                { class: 'nx-habit-stat' },
                h('span', { class: 'nx-habit-stat-val', text: `${completionRate}%` }),
                h('span', { text: ctx.i18n.t('completionRate') }),
              ),
            ),
            h(
              'div',
              { class: 'nx-habit-actions' },
              button({
                label: isDone ? ctx.i18n.t('done') : ctx.i18n.t('checkIn'),
                icon: isDone ? 'check' : 'plus',
                variant: isDone ? 'primary' : 'secondary',
                onClick: async () => {
                  const logId = `${habit.id}:${today}`;
                  if (isDone) {
                    if (todayLog) await logsCol.delete(logId);
                  } else {
                    await logsCol.put({
                      id: logId,
                      habitId: habit.id,
                      date: today,
                      value: habit.targetValue || 1,
                      completed: true,
                      isRestDay: false,
                    });
                  }
                },
              }),
              button({
                label: isRest ? '💤' : ctx.i18n.t('restDay'),
                variant: isRest ? 'primary' : 'secondary',
                onClick: async () => {
                  const logId = `${habit.id}:${today}`;
                  if (isRest) {
                    if (todayLog) await logsCol.delete(logId);
                  } else {
                    await logsCol.put({
                      id: logId,
                      habitId: habit.id,
                      date: today,
                      value: 0,
                      completed: false,
                      isRestDay: true,
                    });
                  }
                },
              }),
              button({
                icon: 'edit',
                onClick: () => showHabitModal(habit),
              }),
              button({
                icon: 'trash',
                onClick: async () => {
                  if (confirm(ctx.i18n.t('confirmDelete'))) {
                    await habitsCol.delete(habit.id);
                    const habitLogs = logs.filter((l) => l.habitId === habit.id);
                    for (const l of habitLogs) {
                      await logsCol.delete(l.id);
                    }
                  }
                },
              }),
            ),
          ),
          h(
            'div',
            { class: 'nx-habit-heatmap-wrap' },
            h('span', { class: 'nx-habit-heatmap-title', text: ctx.i18n.t('activityHeatmap') }),
            h('div', { class: 'nx-habit-heatmap' }, ...heatmapCells),
          ),
        );

        grid.appendChild(card);
      }
      content.appendChild(grid);
    }

    replace(container, toolbar, content);
  }

  /**
   * Modal for creating or editing a habit.
   * @param {HabitItem} [existing]
   */
  function showHabitModal(existing) {
    const isEdit = Boolean(existing);
    let nameVal = existing?.name ?? '';
    let descVal = existing?.description ?? '';
    let freqVal = existing?.freq ?? 'daily';
    let targetTypeVal = existing?.targetType ?? 'boolean';
    let targetNumVal = existing?.targetValue ?? 1;
    let unitVal = existing?.unit ?? '';
    let iconVal = existing?.icon ?? 'flame';
    let reminderVal = existing?.reminderTime ?? '';

    const nameInput = h('input', {
      type: 'text',
      class: 'nx-input',
      value: nameVal,
      placeholder: ctx.i18n.t('namePlaceholder'),
      style: { width: '100%' },
    });
    nameInput.addEventListener('input', (e) => {
      nameVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const descInput = h('input', {
      type: 'text',
      class: 'nx-input',
      value: descVal,
      placeholder: ctx.i18n.t('description'),
      style: { width: '100%' },
    });
    descInput.addEventListener('input', (e) => {
      descVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const freqSelect = h(
      'select',
      { class: 'nx-select', style: { width: '100%' } },
      h('option', { value: 'daily', selected: freqVal === 'daily', text: ctx.i18n.t('freqDaily') }),
      h('option', { value: 'weekdays', selected: freqVal === 'weekdays', text: ctx.i18n.t('freqWeekdays') }),
      h('option', { value: 'n_per_week', selected: freqVal === 'n_per_week', text: ctx.i18n.t('freqNPerWeek') }),
    );
    freqSelect.addEventListener('change', (e) => {
      freqVal = /** @type {import('./model.js').HabitFrequency} */ (/** @type {HTMLSelectElement} */ (e.target).value);
    });

    const typeSelect = h(
      'select',
      { class: 'nx-select', style: { width: '100%' } },
      h('option', { value: 'boolean', selected: targetTypeVal === 'boolean', text: ctx.i18n.t('targetTypeBoolean') }),
      h('option', { value: 'count', selected: targetTypeVal === 'count', text: ctx.i18n.t('targetTypeCount') }),
      h('option', {
        value: 'duration',
        selected: targetTypeVal === 'duration',
        text: ctx.i18n.t('targetTypeDuration'),
      }),
    );
    typeSelect.addEventListener('change', (e) => {
      targetTypeVal = /** @type {import('./model.js').HabitTargetType} */ (
        /** @type {HTMLSelectElement} */ (e.target).value
      );
    });

    const targetInput = h('input', {
      type: 'number',
      class: 'nx-input',
      value: String(targetNumVal),
      min: '1',
      style: { width: '100%' },
    });
    targetInput.addEventListener('input', (e) => {
      targetNumVal = Number(/** @type {HTMLInputElement} */ (e.target).value) || 1;
    });

    const unitInput = h('input', {
      type: 'text',
      class: 'nx-input',
      value: unitVal,
      placeholder: 'e.g. min, glasses, pages',
      style: { width: '100%' },
    });
    unitInput.addEventListener('input', (e) => {
      unitVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const reminderInput = h('input', {
      type: 'time',
      class: 'nx-input',
      value: reminderVal,
      style: { width: '100%' },
    });
    reminderInput.addEventListener('input', (e) => {
      reminderVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '320px' } },
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('name'),
        nameInput,
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('description'),
        descInput,
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('frequency'),
        freqSelect,
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('targetType'),
        typeSelect,
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('targetValue'),
        targetInput,
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('unit'),
        unitInput,
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
        ctx.i18n.t('reminderTime'),
        reminderInput,
      ),
    );

    const modal = openModal({
      title: isEdit ? ctx.i18n.t('editHabit') : ctx.i18n.t('newHabit'),
      content: form,
      actions: [
        {
          label: ctx.i18n.t('cancel'),
          variant: 'secondary',
          onClick: () => modal.close(),
        },
        {
          label: ctx.i18n.t('save'),
          variant: 'primary',
          onClick: async () => {
            if (!nameVal.trim()) return;
            const habitId = existing?.id ?? crypto.randomUUID();
            const habitItem = {
              id: habitId,
              name: nameVal.trim(),
              description: descVal.trim() || undefined,
              color: existing?.color ?? 'flame',
              icon: iconVal,
              freq: freqVal,
              targetType: targetTypeVal,
              targetValue: targetNumVal,
              unit: unitVal.trim() || undefined,
              reminderTime: reminderVal || undefined,
              createdAt: existing?.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            };
            await habitsCol.put(habitItem);
            modal.close();
          },
        },
      ],
    });
  }

  habitsCol.onChange(() => void render());
  logsCol.onChange(() => void render());
  await render();
}
