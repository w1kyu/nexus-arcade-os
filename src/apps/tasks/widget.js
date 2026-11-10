// @ts-check
// Desktop widget for Nexus Tasks: "Today's tasks" with live completion checkboxes.
import { h, icon, replace } from '../../ui/dom.js';
import { formatLocalDate } from './model.js';

/**
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export function mount(container, ctx) {
  container.classList.add('nx-tasks-widget');
  const tasksCol = /** @type {import('../../kernel/types').Collection<import('./model.js').TaskItem>} */ (
    ctx.storage.collection('tasks')
  );
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);

  async function syncSharedSnapshot() {
    const all = await tasksCol.all();
    await ctx.fs.writeFile(
      `${ctx.fs.home}/.config/tasks-snapshot.json`,
      JSON.stringify(
        all.map((item) => ({
          id: item.id,
          title: item.title,
          projectId: item.projectId,
          dueDate: item.dueDate,
          dueTime: item.dueTime,
          priority: item.priority,
          completed: item.completed,
          trackedMinutes: item.trackedMinutes ?? 0,
        })),
      ),
      { createParents: true },
    );
  }

  async function render() {
    const today = formatLocalDate(new Date());
    const all = await tasksCol.all();
    const list = all
      .filter((item) => !item.completed && (!item.dueDate || item.dueDate <= today))
      .sort((a, b) => a.priority - b.priority || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 6);

    replace(
      container,
      h(
        'header',
        { class: 'nx-tasks-whead' },
        icon('checklist', { size: 16 }),
        h('strong', { text: t('today') }),
        h('span', { class: 'nx-tasks-wcount', text: String(list.length) }),
      ),
      list.length
        ? h(
            'ul',
            { class: 'nx-tasks-wlist' },
            ...list.map((item) =>
              h(
                'li',
                { class: 'nx-tasks-witem' },
                h('input', {
                  type: 'checkbox',
                  checked: item.completed,
                  onchange: async () => {
                    item.completed = true;
                    item.completedAt = Date.now();
                    item.status = 'done';
                    await tasksCol.put(item);
                    await syncSharedSnapshot();
                    ctx.events.emit('tasks:changed', {});
                    await render();
                  },
                }),
                h('span', { text: item.title }),
              ),
            ),
          )
        : h('p', { class: 'nx-tasks-wempty', text: t('widgetEmpty') }),
    );
  }

  tasksCol.onChange(() => void render());
  ctx.events.on('tasks:changed', () => void render());
  void render();
}
