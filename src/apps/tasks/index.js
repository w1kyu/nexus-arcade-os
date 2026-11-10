// @ts-check
// Nexus Tasks (4.2): Projects, sections, Inbox, bilingual natural-language quick add (EN + DE),
// nested subtasks, priority levels, recurring tasks & reminders, List/Kanban/Today/Upcoming/
// Overdue/Calendar views, saved filters, completion sound & undo, and productivity statistics.
import { button, h, icon, iconButton, replace } from '../../ui/dom.js';
import { renderMarkdownInto } from '../../ui/markdown.js';
import { attachContextMenu } from '../../ui/menu.js';
import { baseName, joinPath } from '../../ui/paths.js';
import { addDays, computeTaskStats, formatLocalDate, nextTaskDueDate, parseQuickAdd } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').TaskItem} TaskItem */
/** @typedef {import('./model.js').TaskProject} TaskProject */

const PROJECT_COLORS = ['cyan', 'emerald', 'amber', 'purple', 'rose', 'blue'];

/**
 * Shared snapshot file in VFS so Calendar (task overlay) and Focus (task picker/time logging)
 * can read tasks even when the Tasks window isn't open.
 * @param {import('../../kernel/types').VFS} fs
 * @param {TaskItem[]} tasks
 * @param {TaskProject[]} projects
 */
async function writeSharedTasksSnapshot(fs, tasks, projects) {
  await fs.writeFile(
    joinPath(String(fs.home), '.config/tasks-snapshot.json'),
    JSON.stringify({
      updatedAt: Date.now(),
      projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        priority: t.priority,
        completed: t.completed,
        trackedMinutes: t.trackedMinutes ?? 0,
      })),
    }),
    { createParents: true },
  );
}

/**
 * Terminal command handler: `tasks [list | add <text> | done <id>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async tasks(ctx, io) {
    const tasksCol = /** @type {import('../../kernel/types').Collection<TaskItem>} */ (ctx.storage.collection('tasks'));
    const projectsCol = /** @type {import('../../kernel/types').Collection<TaskProject>} */ (
      ctx.storage.collection('projects')
    );
    const sub = io.args[0] ?? 'list';
    if (sub === 'add') {
      const raw = io.args.slice(1).join(' ');
      if (!raw) {
        io.err('Usage: tasks add <text>\n');
        return 1;
      }
      const parsed = parseQuickAdd(raw);
      const now = Date.now();
      /** @type {TaskItem} */
      const item = {
        id: crypto.randomUUID(),
        title: parsed.title,
        description: '',
        projectId: 'inbox',
        sectionId: '',
        status: 'todo',
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        startDate: null,
        tags: parsed.tags,
        subtasks: [],
        estimateMinutes: parsed.estimateMinutes,
        trackedMinutes: 0,
        attachments: [],
        noteLinks: [],
        recurrence: parsed.recurrence,
        reminderMinutesBefore: null,
        schedulerJobId: null,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        order: now,
      };
      await tasksCol.put(item);
      await writeSharedTasksSnapshot(ctx.fs, await tasksCol.all(), await projectsCol.all());
      ctx.events.emit('tasks:changed', {});
      io.out(`Added: ${item.title} (${item.id.slice(0, 6)})\n`);
      return 0;
    }
    if (sub === 'done') {
      const prefix = io.args[1] ?? '';
      const all = await tasksCol.all();
      const target = all.find((t) => t.id.startsWith(prefix));
      if (!target) {
        io.err(`No task matching "${prefix}"\n`);
        return 1;
      }
      target.completed = true;
      target.completedAt = Date.now();
      target.status = 'done';
      await tasksCol.put(target);
      await writeSharedTasksSnapshot(ctx.fs, await tasksCol.all(), await projectsCol.all());
      ctx.events.emit('tasks:changed', {});
      io.out(`Completed: ${target.title}\n`);
      return 0;
    }
    const all = await tasksCol.all();
    for (const t of all.filter((x) => !x.completed)) {
      io.out(`[P${t.priority}] ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''} [${t.id.slice(0, 6)}]\n`);
    }
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'tasks.new': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.tasks', args: { focusQuickAdd: true } }),
};

/**
 * Mounts the Nexus Tasks window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const tasksCol = /** @type {import('../../kernel/types').Collection<TaskItem>} */ (ctx.storage.collection('tasks'));
  const projectsCol = /** @type {import('../../kernel/types').Collection<TaskProject>} */ (
    ctx.storage.collection('projects')
  );
  const filtersCol =
    /** @type {import('../../kernel/types').Collection<{ id: string, name: string, query: string, nav: string }>} */ (
      ctx.storage.collection('filters')
    );

  /** @type {TaskItem[]} */
  let tasks = [];
  /** @type {TaskProject[]} */
  let projects = [];
  /** @type {{ id: string, name: string, query: string, nav: string }[]} */
  let savedFilters = [];
  /** @type {{ task: TaskItem, prevCompleted: boolean, prevStatus: string, createdNextId?: string } | null} */
  let lastUndo = null;

  const restored = /** @type {any} */ (args.restoredState ?? {});
  const state = {
    nav: /** @type {string} */ (restored.nav ?? 'inbox'), // 'inbox' | 'today' | 'upcoming' | 'overdue' | 'completed' | 'stats' | 'project:<id>' | 'filter:<id>'
    layout: /** @type {'list' | 'kanban' | 'calendar'} */ (restored.layout ?? 'list'),
    groupBy: /** @type {'none' | 'date' | 'project' | 'priority'} */ (restored.groupBy ?? 'none'),
    query: /** @type {string} */ (restored.query ?? ''),
    selectedId: /** @type {string | null} */ (restored.selectedId ?? null),
    quickAddText: '',
  };

  async function loadAll() {
    projects = await projectsCol.all();
    tasks = await tasksCol.all();
    savedFilters = await filtersCol.all();

    // Seed sample projects & tasks on first run so the user has an immediate overview
    if (!projects.length && !tasks.length) {
      const now = Date.now();
      const todayStr = formatLocalDate(new Date());
      const tomorrowStr = formatLocalDate(addDays(new Date(), 1));
      /** @type {TaskProject} */
      const uniProj = {
        id: 'uni',
        name: ctx.i18n.locale === 'de' ? 'Studium' : 'University',
        color: 'cyan',
        icon: 'book',
        sections: [
          { id: 'lectures', name: ctx.i18n.locale === 'de' ? 'Vorlesungen' : 'Lectures' },
          { id: 'exams', name: ctx.i18n.locale === 'de' ? 'Prüfungen' : 'Exams' },
        ],
        columns: [
          { id: 'todo', title: t('colTodo'), wipLimit: 0 },
          { id: 'doing', title: t('colDoing'), wipLimit: 3 },
          { id: 'done', title: t('colDone'), wipLimit: 0 },
        ],
        createdAt: now,
      };
      await projectsCol.put(uniProj);
      projects = [uniProj];

      /** @type {TaskItem[]} */
      const seedTasks = [
        {
          id: crypto.randomUUID(),
          title: ctx.i18n.locale === 'de' ? 'Algorithmen Übungsblatt 4 abgeben' : 'Submit Algorithms problem set 4',
          description: 'Review dynamic programming recurrences and complexity proofs.',
          projectId: 'uni',
          sectionId: 'lectures',
          status: 'doing',
          priority: 1,
          dueDate: todayStr,
          dueTime: '18:00',
          startDate: todayStr,
          tags: ['uni', 'cs'],
          subtasks: [
            { id: 's1', title: 'Problem 1: Knapsack', done: true },
            { id: 's2', title: 'Problem 2: Shortest Paths', done: false },
          ],
          estimateMinutes: 60,
          trackedMinutes: 25,
          attachments: [],
          noteLinks: [],
          recurrence: null,
          reminderMinutesBefore: 15,
          schedulerJobId: null,
          completed: false,
          completedAt: null,
          createdAt: now - 3600_000,
          updatedAt: now,
          order: 1,
        },
        {
          id: crypto.randomUUID(),
          title: ctx.i18n.locale === 'de' ? 'Wochenplanung überprüfen' : 'Review weekly goals',
          description: '',
          projectId: 'inbox',
          sectionId: '',
          status: 'todo',
          priority: 2,
          dueDate: tomorrowStr,
          dueTime: '10:00',
          startDate: null,
          tags: ['planning'],
          subtasks: [],
          estimateMinutes: 20,
          trackedMinutes: 0,
          attachments: [],
          noteLinks: [],
          recurrence: { freq: 'weekly', interval: 1 },
          reminderMinutesBefore: null,
          schedulerJobId: null,
          completed: false,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
          order: 2,
        },
      ];
      for (const st of seedTasks) await tasksCol.put(st);
      tasks = seedTasks;
    }

    await writeSharedTasksSnapshot(ctx.fs, tasks, projects);
    updateDockBadge();
  }

  function updateDockBadge() {
    const todayStr = formatLocalDate(new Date());
    const dueOrOverdue = tasks.filter((x) => !x.completed && x.dueDate && x.dueDate <= todayStr).length;
    ctx.window?.setBadge(dueOrOverdue > 0 ? dueOrOverdue : null);
  }

  /** Schedules or cancels the OS reminder job for `task`. @param {TaskItem} task */
  async function syncTaskReminder(task) {
    if (task.schedulerJobId) {
      await ctx.scheduler.cancel(task.schedulerJobId).catch(() => {});
      task.schedulerJobId = null;
    }
    if (task.completed || !task.dueDate || task.reminderMinutesBefore === null) return;
    const timeStr = task.dueTime || '09:00';
    const dueTs = new Date(`${task.dueDate}T${timeStr}:00`).getTime();
    const fireAt = dueTs - task.reminderMinutesBefore * 60_000;
    if (fireAt > Date.now()) {
      try {
        task.schedulerJobId = await ctx.scheduler.schedule({
          title: task.title,
          body: `${task.dueDate} ${timeStr}`,
          kind: 'task',
          at: fireAt,
          data: { taskId: task.id },
        });
      } catch {
        // Ignore if time already passed.
      }
    }
  }

  /** Saves `task`, updates snapshot & badge, and emits `tasks:changed`. @param {TaskItem} task */
  async function saveTask(task) {
    task.updatedAt = Date.now();
    await syncTaskReminder(task);
    await tasksCol.put(task);
    const idx = tasks.findIndex((x) => x.id === task.id);
    if (idx === -1) tasks.push(task);
    else tasks[idx] = task;
    await writeSharedTasksSnapshot(ctx.fs, tasks, projects);
    updateDockBadge();
    ctx.events.emit('tasks:changed', { id: task.id });
  }

  // ─── DOM Structure ────────────────────────────────────────────────────
  const sidebarEl = h('aside', { class: 'nx-tasks-sidebar' });
  const mainEl = h('main', { class: 'nx-tasks-main' });
  const detailEl = h('aside', { class: 'nx-tasks-detail' });
  const rootEl = h('div', { class: 'nx-tasks' }, sidebarEl, mainEl, detailEl);
  detailEl.hidden = true;
  container.replaceChildren(rootEl);

  const quickInput = h('input', {
    class: 'nx-input',
    type: 'text',
    placeholder: t('quickAddPlaceholder'),
    'aria-label': t('quickAddPlaceholder'),
    oninput: () => {
      state.quickAddText = quickInput.value;
      renderQuickPreview();
    },
    onkeydown: (e) => {
      if (e.key === 'Enter' && quickInput.value.trim()) {
        e.preventDefault();
        void submitQuickAdd();
      }
    },
  });
  const previewChipsEl = h('div', { class: 'nx-tasks-preview-chips' });

  const searchInput = h('input', {
    class: 'nx-input',
    type: 'search',
    placeholder: t('searchPlaceholder'),
    value: state.query,
    'aria-label': t('searchPlaceholder'),
    oninput: () => {
      state.query = searchInput.value;
      renderBody();
    },
  });

  function renderQuickPreview() {
    const raw = state.quickAddText.trim();
    if (!raw) {
      replace(previewChipsEl);
      return;
    }
    const parsed = parseQuickAdd(raw);
    const chips = [h('span', { class: `nx-tasks-chip is-p${parsed.priority}`, text: t(`priority${parsed.priority}`) })];
    if (parsed.dueDate) {
      chips.push(
        h('span', {
          class: 'nx-tasks-chip',
          text: `📅 ${parsed.dueDate}${parsed.dueTime ? ` ${parsed.dueTime}` : ''}`,
        }),
      );
    }
    if (parsed.projectHint) {
      chips.push(h('span', { class: 'nx-tasks-chip', text: `📁 ${parsed.projectHint}` }));
    }
    if (parsed.estimateMinutes) {
      chips.push(h('span', { class: 'nx-tasks-chip', text: `⏱ ${parsed.estimateMinutes}m` }));
    }
    if (parsed.recurrence) {
      chips.push(h('span', { class: 'nx-tasks-chip', text: `↻ ${parsed.recurrence.freq}` }));
    }
    for (const tag of parsed.tags) {
      chips.push(h('span', { class: 'nx-tasks-chip', text: `#${tag}` }));
    }
    replace(previewChipsEl, ...chips);
  }

  async function submitQuickAdd() {
    const raw = quickInput.value.trim();
    if (!raw) return;
    const parsed = parseQuickAdd(raw);
    let projectId = state.nav.startsWith('project:') ? state.nav.slice(8) : 'inbox';
    if (parsed.projectHint) {
      const match = projects.find((p) => p.name.toLowerCase() === parsed.projectHint?.toLowerCase());
      if (match) projectId = match.id;
    }
    const todayStr = formatLocalDate(new Date());
    const dueDate = parsed.dueDate ?? (state.nav === 'today' ? todayStr : null);
    const now = Date.now();
    /** @type {TaskItem} */
    const item = {
      id: crypto.randomUUID(),
      title: parsed.title,
      description: '',
      projectId,
      sectionId: '',
      status: 'todo',
      priority: parsed.priority,
      dueDate,
      dueTime: parsed.dueTime,
      startDate: null,
      tags: parsed.tags,
      subtasks: [],
      estimateMinutes: parsed.estimateMinutes,
      trackedMinutes: 0,
      attachments: [],
      noteLinks: [],
      recurrence: parsed.recurrence,
      reminderMinutesBefore: parsed.dueTime ? 0 : null,
      schedulerJobId: null,
      completed: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      order: now,
    };
    quickInput.value = '';
    state.quickAddText = '';
    renderQuickPreview();
    await saveTask(item);
    selectTask(item.id);
    renderSidebar();
    renderMain();
  }

  // ─── Sidebar Rendering ─────────────────────────────────────────────────
  function renderSidebar() {
    const todayStr = formatLocalDate(new Date());
    const next7Str = formatLocalDate(addDays(new Date(), 7));
    const open = tasks.filter((x) => !x.completed);

    const navBtn = (
      /** @type {string} */ id,
      /** @type {string} */ label,
      /** @type {string} */ iconName,
      /** @type {number | undefined} */ count,
      /** @type {string | undefined} */ dotColor,
    ) =>
      h(
        'button',
        {
          class: `nx-tasks-nav-item${state.nav === id ? ' is-active' : ''}`,
          type: 'button',
          onclick: () => {
            state.nav = id;
            renderSidebar();
            renderMain();
            ctx.window?.stateChanged();
          },
        },
        dotColor
          ? h('span', { class: 'nx-tasks-proj-dot', dataset: { color: dotColor } })
          : icon(iconName, { size: 16 }),
        h('span', { text: label }),
        count !== undefined ? h('span', { class: 'nx-tasks-nav-count', text: String(count) }) : null,
      );

    replace(
      sidebarEl,
      h(
        'div',
        { class: 'nx-tasks-nav-group' },
        navBtn('inbox', t('inbox'), 'folder', open.filter((x) => x.projectId === 'inbox').length, undefined),
        navBtn('today', t('today'), 'star', open.filter((x) => x.dueDate && x.dueDate <= todayStr).length, undefined),
        navBtn(
          'upcoming',
          t('upcoming'),
          'calendar',
          open.filter((x) => x.dueDate && x.dueDate >= todayStr && x.dueDate <= next7Str).length,
          undefined,
        ),
        navBtn(
          'overdue',
          t('overdue'),
          'warning',
          open.filter((x) => x.dueDate && x.dueDate < todayStr).length,
          undefined,
        ),
        navBtn('completed', t('completedView'), 'check', tasks.filter((x) => x.completed).length, undefined),
        navBtn('stats', t('statsView'), 'activity', undefined, undefined),
      ),
      h(
        'div',
        { class: 'nx-tasks-nav-heading' },
        h('span', { text: t('projects') }),
        iconButton({
          icon: 'plus',
          label: t('newProject'),
          onClick: () => void promptNewProject(),
        }),
      ),
      h(
        'div',
        { class: 'nx-tasks-nav-group' },
        ...projects.map((p) => {
          const projTasks = tasks.filter((x) => x.projectId === p.id);
          const openCount = projTasks.filter((x) => !x.completed).length;
          return navBtn(`project:${p.id}`, p.name, p.icon || 'folder', openCount, p.color);
        }),
      ),
      h(
        'div',
        { class: 'nx-tasks-nav-heading' },
        h('span', { text: t('savedFilters') }),
        iconButton({
          icon: 'plus',
          label: t('newFilter'),
          onClick: () => void promptSaveFilter(),
        }),
      ),
      h(
        'div',
        { class: 'nx-tasks-nav-group' },
        ...savedFilters.map((sf) =>
          h(
            'button',
            {
              class: `nx-tasks-nav-item${state.nav === `filter:${sf.id}` ? ' is-active' : ''}`,
              type: 'button',
              onclick: () => {
                state.nav = `filter:${sf.id}`;
                state.query = sf.query;
                searchInput.value = sf.query;
                renderSidebar();
                renderMain();
              },
            },
            icon('filter', { size: 15 }),
            h('span', { text: sf.name }),
          ),
        ),
      ),
    );
  }

  // ─── Task Filtering for Active View ────────────────────────────────────
  function getVisibleTasks() {
    const todayStr = formatLocalDate(new Date());
    const next7Str = formatLocalDate(addDays(new Date(), 7));
    const q = state.query.trim().toLowerCase();

    return tasks
      .filter((item) => {
        if (state.nav === 'completed') {
          if (!item.completed) return false;
        } else if (state.layout !== 'kanban') {
          if (item.completed) return false;
        }
        if (state.nav === 'inbox' && item.projectId !== 'inbox') return false;
        if (state.nav === 'today' && (!item.dueDate || item.dueDate > todayStr)) return false;
        if (state.nav === 'upcoming' && (!item.dueDate || item.dueDate < todayStr || item.dueDate > next7Str))
          return false;
        if (state.nav === 'overdue' && (!item.dueDate || item.dueDate >= todayStr)) return false;
        if (state.nav.startsWith('project:')) {
          const pid = state.nav.slice(8);
          if (item.projectId !== pid) return false;
        }
        if (q) {
          const inTitle = item.title.toLowerCase().includes(q);
          const inDesc = item.description.toLowerCase().includes(q);
          const inTags = item.tags.some((tg) => `#${tg}` === q || tg.includes(q.replace(/^#/, '')));
          if (!inTitle && !inDesc && !inTags) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.priority - b.priority || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order,
      );
  }

  /** @returns {TaskProject | null} */
  function getActiveProject() {
    if (!state.nav.startsWith('project:')) return null;
    const pid = state.nav.slice(8);
    return projects.find((p) => p.id === pid) ?? null;
  }

  const bodyEl = h('div', { class: 'nx-tasks-body' });
  const undoBannerEl = h('div', { class: 'nx-tasks-undo-banner' });
  undoBannerEl.hidden = true;

  function renderMain() {
    if (state.nav === 'stats') {
      renderStatsView();
      return;
    }

    const activeProj = getActiveProject();
    let title = t('inbox');
    if (state.nav === 'today') title = t('today');
    else if (state.nav === 'upcoming') title = t('upcoming');
    else if (state.nav === 'overdue') title = t('overdue');
    else if (state.nav === 'completed') title = t('completedView');
    else if (activeProj) title = activeProj.name;
    else if (state.nav.startsWith('filter:')) {
      title = savedFilters.find((f) => `filter:${f.id}` === state.nav)?.name ?? t('savedFilters');
    }

    let progressBadge = null;
    if (activeProj) {
      const allProj = tasks.filter((x) => x.projectId === activeProj.id);
      const doneProj = allProj.filter((x) => x.completed).length;
      const pct = allProj.length ? Math.round((doneProj / allProj.length) * 100) : 0;
      progressBadge = h('span', { class: 'nx-tasks-progress-pill', text: `${doneProj}/${allProj.length} (${pct}%)` });
    }

    const groupSelect = h(
      'select',
      {
        class: 'nx-select',
        'aria-label': t('groupBy'),
        onchange: () => {
          state.groupBy = /** @type {any} */ (groupSelect.value);
          renderBody();
        },
      },
      h('option', { value: 'none', text: t('groupNone') }),
      h('option', { value: 'date', text: t('groupDate') }),
      h('option', { value: 'project', text: t('groupProject') }),
      h('option', { value: 'priority', text: t('groupPriority') }),
    );
    groupSelect.value = state.groupBy;

    const headerEl = h(
      'header',
      { class: 'nx-tasks-header' },
      h(
        'div',
        { class: 'nx-tasks-header-top' },
        h(
          'div',
          { class: 'nx-tasks-title-row' },
          h('h2', { text: title }),
          progressBadge,
          activeProj
            ? button({
                label: t('newSection'),
                icon: 'plus',
                onClick: () => void promptNewSection(activeProj),
              })
            : null,
        ),
        h(
          'div',
          { class: 'nx-tasks-controls' },
          searchInput,
          groupSelect,
          h(
            'div',
            { class: 'nx-btn-group', role: 'group' },
            .../** @type {const} */ (['list', 'kanban', 'calendar']).map((ly) =>
              h('button', {
                class: `nx-btn${state.layout === ly ? ' is-primary' : ''}`,
                type: 'button',
                text: t(ly === 'list' ? 'viewList' : ly === 'kanban' ? 'viewKanban' : 'viewCalendar'),
                onclick: () => {
                  state.layout = ly;
                  renderMain();
                  ctx.window?.stateChanged();
                },
              }),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'nx-tasks-quickadd' },
        h(
          'div',
          { class: 'nx-tasks-quickadd-row' },
          quickInput,
          button({ label: t('addTask'), icon: 'plus', variant: 'primary', onClick: () => void submitQuickAdd() }),
        ),
        previewChipsEl,
      ),
    );

    renderUndoBanner();
    replace(mainEl, headerEl, bodyEl, undoBannerEl);
    renderBody();
  }

  function renderUndoBanner() {
    if (!lastUndo) {
      undoBannerEl.hidden = true;
      return;
    }
    undoBannerEl.hidden = false;
    replace(
      undoBannerEl,
      h('span', { text: t('taskCompleted', { title: lastUndo.task.title }) }),
      button({
        label: t('undo'),
        icon: 'undo',
        onClick: () => void undoLastCompletion(),
      }),
    );
  }

  function renderBody() {
    if (state.layout === 'kanban') {
      renderKanbanBody();
      return;
    }
    if (state.layout === 'calendar') {
      renderCalendarBody();
      return;
    }
    renderListBody();
  }

  /** Renders a single task row/card. @param {TaskItem} item */
  function renderTaskRow(item) {
    const todayStr = formatLocalDate(new Date());
    const isOverdue = !item.completed && item.dueDate && item.dueDate < todayStr;
    const subDone = item.subtasks.filter((s) => s.done).length;
    const proj = projects.find((p) => p.id === item.projectId);

    const checkbox = h('input', {
      type: 'checkbox',
      checked: item.completed,
      'aria-label': item.title,
      onclick: (e) => e.stopPropagation(),
      onchange: () => void toggleTaskComplete(item, row),
    });

    const row = h(
      'div',
      {
        class: `nx-tasks-row${item.completed ? ' is-done' : ''}${state.selectedId === item.id ? ' is-selected' : ''}`,
        draggable: 'true',
        dataset: { id: item.id },
        onclick: () => selectTask(item.id),
      },
      checkbox,
      h(
        'div',
        { class: 'nx-tasks-row-main' },
        h('div', { class: 'nx-tasks-row-title', text: item.title }),
        h(
          'div',
          { class: 'nx-tasks-row-meta' },
          h('span', { class: `nx-tasks-chip is-p${item.priority}`, text: `P${item.priority}` }),
          item.dueDate
            ? h('span', {
                class: isOverdue ? 'nx-tasks-due-overdue' : '',
                text: `📅 ${item.dueDate}${item.dueTime ? ` ${item.dueTime}` : ''}`,
              })
            : null,
          proj ? h('span', { text: `📁 ${proj.name}` }) : null,
          item.subtasks.length ? h('span', { text: `☑ ${subDone}/${item.subtasks.length}` }) : null,
          item.recurrence ? h('span', { text: `↻ ${item.recurrence.freq}` }) : null,
          item.trackedMinutes ? h('span', { text: `⏱ ${item.trackedMinutes}m` }) : null,
          ...item.tags.map((tg) => h('span', { class: 'nx-tasks-chip', text: `#${tg}` })),
        ),
      ),
    );

    row.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/x-nexus-task-id', item.id);
    });

    attachContextMenu(row, () => [
      {
        label: t('startFocus'),
        icon: 'target',
        run: () => void startFocusOnTask(item),
      },
      'separator',
      {
        label: t('deleteTask'),
        icon: 'trash',
        danger: true,
        run: () => void deleteTask(item),
      },
    ]);

    return row;
  }

  function renderListBody() {
    const visible = getVisibleTasks();
    if (!visible.length) {
      replace(bodyEl, h('div', { class: 'nx-empty', text: t('emptyTasks') }));
      return;
    }

    const activeProj = getActiveProject();
    /** @type {Map<string, TaskItem[]>} */
    const groups = new Map();

    if (state.groupBy === 'date') {
      for (const item of visible) {
        const k = item.dueDate ?? t('noDate');
        groups.set(k, [...(groups.get(k) ?? []), item]);
      }
    } else if (state.groupBy === 'project') {
      for (const item of visible) {
        const pName = projects.find((p) => p.id === item.projectId)?.name ?? t('inbox');
        groups.set(pName, [...(groups.get(pName) ?? []), item]);
      }
    } else if (state.groupBy === 'priority') {
      for (const item of visible) {
        const pLabel = t(`priority${item.priority}`);
        groups.set(pLabel, [...(groups.get(pLabel) ?? []), item]);
      }
    } else if (activeProj && activeProj.sections.length) {
      groups.set(
        t('groupNone'),
        visible.filter((x) => !x.sectionId),
      );
      for (const sec of activeProj.sections) {
        groups.set(
          sec.name,
          visible.filter((x) => x.sectionId === sec.id),
        );
      }
    } else {
      groups.set('', visible);
    }

    replace(
      bodyEl,
      ...[...groups.entries()]
        .filter(([, list]) => list.length > 0 || activeProj?.sections.length)
        .map(([gTitle, list]) =>
          h(
            'section',
            { class: 'nx-tasks-group' },
            gTitle
              ? h(
                  'div',
                  { class: 'nx-tasks-group-head' },
                  h('span', { text: gTitle }),
                  h('span', { text: String(list.length) }),
                )
              : null,
            h('div', { class: 'nx-tasks-list' }, ...list.map(renderTaskRow)),
          ),
        ),
    );
  }

  function renderKanbanBody() {
    const activeProj = getActiveProject();
    const columns = activeProj?.columns?.length
      ? activeProj.columns
      : [
          { id: 'todo', title: t('colTodo'), wipLimit: 0 },
          { id: 'doing', title: t('colDoing'), wipLimit: 3 },
          { id: 'done', title: t('colDone'), wipLimit: 0 },
        ];
    const visible = getVisibleTasks();

    const board = h(
      'div',
      { class: 'nx-tasks-kanban' },
      ...columns.map((col) => {
        const colTasks = visible.filter((item) =>
          item.completed ? col.id === 'done' : (item.status || 'todo') === col.id,
        );
        const wipExceeded = col.wipLimit > 0 && colTasks.length > col.wipLimit;
        const colEl = h(
          'div',
          {
            class: `nx-tasks-col${wipExceeded ? ' is-wip-exceeded' : ''}`,
            dataset: { column: col.id },
          },
          h(
            'div',
            { class: 'nx-tasks-col-head' },
            h('span', { text: col.title }),
            h('span', {
              class: 'nx-tasks-progress-pill',
              title: wipExceeded ? t('wipExceeded') : t('wipLimit'),
              text: col.wipLimit > 0 ? `${colTasks.length}/${col.wipLimit}` : String(colTasks.length),
            }),
          ),
          h('div', { class: 'nx-tasks-col-cards' }, ...colTasks.map(renderTaskRow)),
        );

        colEl.addEventListener('dragover', (e) => {
          if (e.dataTransfer?.types.includes('text/x-nexus-task-id')) {
            e.preventDefault();
            colEl.classList.add('is-drop-target');
          }
        });
        colEl.addEventListener('dragleave', () => colEl.classList.remove('is-drop-target'));
        colEl.addEventListener('drop', async (e) => {
          colEl.classList.remove('is-drop-target');
          const taskId = e.dataTransfer?.getData('text/x-nexus-task-id');
          const item = tasks.find((x) => x.id === taskId);
          if (!item) return;
          item.status = col.id;
          item.completed = col.id === 'done';
          item.completedAt = item.completed ? Date.now() : null;
          await saveTask(item);
          renderSidebar();
          renderBody();
          renderDetail();
        });
        return colEl;
      }),
      activeProj
        ? button({
            label: t('addColumn'),
            icon: 'plus',
            onClick: () => void promptNewColumn(activeProj),
          })
        : null,
    );

    replace(bodyEl, board);
  }

  function renderCalendarBody() {
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const startOfWeek = addDays(now, -((now.getDay() + 6) % 7)); // Monday
    const days = Array.from({ length: 14 }, (_, i) => addDays(startOfWeek, i));
    const visible = getVisibleTasks();

    const grid = h(
      'div',
      { class: 'nx-tasks-cal-grid' },
      ...days.map((d) => {
        const dStr = formatLocalDate(d);
        const dayTasks = visible.filter((x) => x.dueDate === dStr);
        return h(
          'div',
          { class: `nx-tasks-cal-cell${dStr === todayStr ? ' is-today' : ''}` },
          h('div', { class: 'nx-tasks-cal-day', text: dStr.slice(5) }),
          ...dayTasks.map((item) =>
            h('div', {
              class: 'nx-tasks-cal-pill',
              text: item.title,
              onclick: () => selectTask(item.id),
            }),
          ),
        );
      }),
    );
    replace(bodyEl, grid);
  }

  function renderStatsView() {
    const stats = computeTaskStats(tasks);
    const maxDay = Math.max(1, ...stats.last7Days.map((d) => d.count));

    replace(
      mainEl,
      h(
        'header',
        { class: 'nx-tasks-header' },
        h('div', { class: 'nx-tasks-title-row' }, h('h2', { text: t('statsView') })),
      ),
      h(
        'div',
        { class: 'nx-tasks-body nx-tasks-stats' },
        h(
          'div',
          { class: 'nx-tasks-stat-cards' },
          h(
            'div',
            { class: 'nx-tasks-stat-card' },
            h('small', { text: t('statsStreak') }),
            h('strong', { text: t('statsDays', { count: stats.streak }) }),
          ),
          h(
            'div',
            { class: 'nx-tasks-stat-card' },
            h('small', { text: t('statsAvgTime') }),
            h('strong', { text: t('statsHours', { hours: stats.avgCompletionHours }) }),
          ),
          h(
            'div',
            { class: 'nx-tasks-stat-card' },
            h('small', { text: t('statsOverdueRate') }),
            h('strong', { text: `${stats.overdueRate}%` }),
          ),
        ),
        h('h3', { text: t('statsCompleted7d') }),
        h(
          'div',
          { class: 'nx-tasks-bars' },
          ...stats.last7Days.map((d) => {
            const barH = Math.max(6, Math.round((d.count / maxDay) * 86));
            return h(
              'div',
              { class: 'nx-tasks-bar-col' },
              h('small', { text: String(d.count) }),
              h('div', {
                html: `<svg width="28" height="90" viewBox="0 0 28 90" aria-hidden="true"><rect x="2" y="${90 - barH}" width="24" height="${barH}" rx="4" fill="currentColor" class="nx-tasks-bar-svg"/></svg>`,
              }),
              h('small', { text: d.date.slice(5) }),
            );
          }),
        ),
        h('h3', { text: t('statsTrackedByProject') }),
        h(
          'div',
          { class: 'nx-tasks-list' },
          ...Object.entries(stats.timeByProject).map(([pid, mins]) => {
            const pName = projects.find((p) => p.id === pid)?.name ?? t('inbox');
            return h(
              'div',
              { class: 'nx-tasks-row' },
              h('strong', { class: 'nx-tasks-row-main', text: pName }),
              h('span', { text: `${mins} min` }),
            );
          }),
        ),
      ),
    );
  }

  // ─── Task Completion, Recurrence & Undo ────────────────────────────────
  /** @param {TaskItem} item @param {HTMLElement} [rowEl] */
  async function toggleTaskComplete(item, rowEl) {
    const prevCompleted = item.completed;
    const prevStatus = item.status;
    if (!prevCompleted) {
      rowEl?.classList.add('is-completing');
      ctx.sound.play('achievement');
      ctx.achievements.stat('tasks_completed', 1);
    }

    item.completed = !prevCompleted;
    item.completedAt = item.completed ? Date.now() : null;
    item.status = item.completed ? 'done' : 'todo';
    await saveTask(item);

    /** @type {string | undefined} */
    let createdNextId;
    if (item.completed && item.recurrence) {
      const nextDue = nextTaskDueDate(item.dueDate, item.recurrence);
      const now = Date.now();
      /** @type {TaskItem} */
      const nextTask = {
        ...structuredClone(item),
        id: crypto.randomUUID(),
        dueDate: nextDue,
        completed: false,
        completedAt: null,
        status: 'todo',
        subtasks: item.subtasks.map((s) => ({ ...s, done: false })),
        schedulerJobId: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveTask(nextTask);
      createdNextId = nextTask.id;
    }

    if (item.completed) {
      lastUndo = { task: item, prevCompleted, prevStatus, createdNextId };
    } else {
      lastUndo = null;
    }

    renderSidebar();
    renderMain();
    renderDetail();
  }

  async function undoLastCompletion() {
    if (!lastUndo) return;
    const { task, prevCompleted, prevStatus, createdNextId } = lastUndo;
    lastUndo = null;
    task.completed = prevCompleted;
    task.completedAt = null;
    task.status = prevStatus;
    await saveTask(task);
    if (createdNextId) {
      await tasksCol.delete(createdNextId);
      tasks = tasks.filter((x) => x.id !== createdNextId);
    }
    renderSidebar();
    renderMain();
    renderDetail();
  }

  // ─── Detail Inspector Panel ────────────────────────────────────────────
  /** @param {string | null} id */
  function selectTask(id) {
    state.selectedId = id;
    const item = tasks.find((x) => x.id === id) ?? null;
    detailEl.hidden = !item;
    rootEl.classList.toggle('has-detail', Boolean(item));
    renderBody();
    renderDetail();
  }

  function renderDetail() {
    const item = tasks.find((x) => x.id === state.selectedId);
    if (!item) {
      detailEl.hidden = true;
      rootEl.classList.remove('has-detail');
      replace(detailEl);
      return;
    }

    const titleInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: item.title,
      onchange: async () => {
        item.title = titleInput.value.trim() || item.title;
        await saveTask(item);
        renderBody();
      },
    });

    const descPreview = h('div', { class: 'nx-markdown' });
    if (item.description) void renderMarkdownInto(descPreview, item.description);

    const descArea = h('textarea', {
      class: 'nx-textarea',
      rows: '3',
      value: item.description,
      placeholder: t('description'),
      onchange: async () => {
        item.description = descArea.value;
        await saveTask(item);
        void renderMarkdownInto(descPreview, item.description);
      },
    });
    descArea.value = item.description;

    const priSelect = h(
      'select',
      {
        class: 'nx-select',
        onchange: async () => {
          item.priority = /** @type {any} */ (Number(priSelect.value));
          await saveTask(item);
          renderBody();
        },
      },
      ...[1, 2, 3, 4].map((p) => h('option', { value: String(p), text: t(`priority${p}`) })),
    );
    priSelect.value = String(item.priority);

    const dueInput = h('input', {
      class: 'nx-input',
      type: 'date',
      value: item.dueDate ?? '',
      onchange: async () => {
        item.dueDate = dueInput.value || null;
        await saveTask(item);
        renderSidebar();
        renderBody();
      },
    });

    const timeInput = h('input', {
      class: 'nx-input',
      type: 'time',
      value: item.dueTime ?? '',
      onchange: async () => {
        item.dueTime = timeInput.value || null;
        await saveTask(item);
        renderBody();
      },
    });

    const recSelect = h(
      'select',
      {
        class: 'nx-select',
        onchange: async () => {
          const val = recSelect.value;
          item.recurrence = val ? { freq: /** @type {any} */ (val), interval: 1 } : null;
          await saveTask(item);
          renderBody();
        },
      },
      h('option', { value: '', text: t('recNone') }),
      h('option', { value: 'daily', text: t('recDaily') }),
      h('option', { value: 'weekly', text: t('recWeekly') }),
      h('option', { value: 'monthly', text: t('recMonthly') }),
      h('option', { value: 'yearly', text: t('recYearly') }),
    );
    recSelect.value = item.recurrence?.freq ?? '';

    const remSelect = h(
      'select',
      {
        class: 'nx-select',
        onchange: async () => {
          item.reminderMinutesBefore = remSelect.value === '' ? null : Number(remSelect.value);
          await saveTask(item);
        },
      },
      h('option', { value: '', text: t('remNone') }),
      h('option', { value: '0', text: t('remAtDue') }),
      h('option', { value: '15', text: t('rem15m') }),
      h('option', { value: '60', text: t('rem1h') }),
    );
    remSelect.value = item.reminderMinutesBefore === null ? '' : String(item.reminderMinutesBefore);

    const subInput = h('input', {
      class: 'nx-input',
      type: 'text',
      placeholder: t('addSubtask'),
      onkeydown: async (e) => {
        if (e.key === 'Enter' && subInput.value.trim()) {
          e.preventDefault();
          item.subtasks.push({ id: crypto.randomUUID(), title: subInput.value.trim(), done: false });
          subInput.value = '';
          await saveTask(item);
          renderDetail();
          renderBody();
        }
      },
    });

    replace(
      detailEl,
      h(
        'div',
        { class: 'nx-tasks-detail-head' },
        titleInput,
        iconButton({ icon: 'x', label: 'Close', onClick: () => selectTask(null) }),
      ),
      h(
        'div',
        { class: 'nx-tasks-controls' },
        button({
          label: t('startFocus'),
          icon: 'target',
          variant: 'primary',
          onClick: () => void startFocusOnTask(item),
        }),
        button({ label: t('deleteTask'), icon: 'trash', variant: 'danger', onClick: () => void deleteTask(item) }),
      ),
      h(
        'div',
        { class: 'nx-tasks-field-grid' },
        h('label', { class: 'nx-field' }, h('span', { text: t('groupPriority') }), priSelect),
        h('label', { class: 'nx-field' }, h('span', { text: t('dueDate') }), dueInput),
        h('label', { class: 'nx-field' }, h('span', { text: t('dueTime') }), timeInput),
        h('label', { class: 'nx-field' }, h('span', { text: t('recurrence') }), recSelect),
        h('label', { class: 'nx-field' }, h('span', { text: t('reminder') }), remSelect),
      ),
      h('label', { class: 'nx-field' }, h('span', { text: t('description') }), descArea, descPreview),
      h(
        'div',
        { class: 'nx-tasks-sublist' },
        h('strong', { text: t('subtasks') }),
        ...item.subtasks.map((sub) =>
          h(
            'div',
            { class: 'nx-tasks-subitem' },
            h('input', {
              type: 'checkbox',
              checked: sub.done,
              onchange: async () => {
                sub.done = !sub.done;
                await saveTask(item);
                renderDetail();
                renderBody();
              },
            }),
            h('span', { text: sub.title }),
            iconButton({
              icon: 'x',
              label: 'Remove',
              onClick: async () => {
                item.subtasks = item.subtasks.filter((s) => s.id !== sub.id);
                await saveTask(item);
                renderDetail();
                renderBody();
              },
            }),
          ),
        ),
        subInput,
      ),
      h(
        'div',
        { class: 'nx-tasks-sublist' },
        h(
          'div',
          { class: 'nx-tasks-header-top' },
          h('strong', { text: t('noteLinks') }),
          button({
            label: t('addNoteLink'),
            icon: 'note',
            onClick: async () => {
              const noteTitle = await /** @type {any} */ (ctx.dialog).prompt(t('notePrompt'), '', {
                title: t('addNoteLink'),
              });
              if (!noteTitle?.trim()) return;
              const path = `${ctx.fs.home}/Documents/Notes/${noteTitle.trim().replace(/\.md$/i, '')}.md`;
              if (!item.noteLinks.includes(path)) item.noteLinks.push(path);
              await saveTask(item);
              renderDetail();
            },
          }),
        ),
        ...item.noteLinks.map((path) =>
          h('button', {
            class: 'nx-btn is-ghost',
            type: 'button',
            text: `📝 ${baseName(path).replace(/\.md$/i, '')}`,
            onclick: () => void ctx.intents.open(path, { with: 'nexus.notes' }),
          }),
        ),
      ),
      h(
        'div',
        { class: 'nx-tasks-sublist' },
        h(
          'div',
          { class: 'nx-tasks-header-top' },
          h('strong', { text: t('attachments') }),
          button({
            label: t('addAttachment'),
            icon: 'file-plus',
            onClick: async () => {
              const picked = await /** @type {any} */ (ctx.dialog).openFile({ title: t('addAttachment') });
              if (typeof picked === 'string' && !item.attachments.includes(picked)) {
                item.attachments.push(picked);
                await saveTask(item);
                renderDetail();
              }
            },
          }),
        ),
        ...item.attachments.map((path) =>
          h('button', {
            class: 'nx-btn is-ghost',
            type: 'button',
            text: `📎 ${baseName(path)}`,
            onclick: () => void ctx.intents.open(path),
          }),
        ),
      ),
    );
  }

  /** @param {TaskItem} item */
  async function deleteTask(item) {
    if (item.schedulerJobId) await ctx.scheduler.cancel(item.schedulerJobId).catch(() => {});
    await tasksCol.delete(item.id);
    tasks = tasks.filter((x) => x.id !== item.id);
    if (state.selectedId === item.id) state.selectedId = null;
    await writeSharedTasksSnapshot(ctx.fs, tasks, projects);
    updateDockBadge();
    ctx.events.emit('tasks:changed', {});
    renderSidebar();
    renderMain();
    renderDetail();
  }

  /** @param {TaskItem} item */
  async function startFocusOnTask(item) {
    await ctx.commands.execute('shell.launchApp', {
      appId: 'nexus.focus',
      args: { taskId: item.id, taskTitle: item.title, projectId: item.projectId },
    });
  }

  async function promptNewProject() {
    const name = await /** @type {any} */ (ctx.dialog).prompt(t('projectPrompt'), '', { title: t('newProject') });
    if (!name?.trim()) return;
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    /** @type {TaskProject} */
    const proj = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      icon: 'folder',
      sections: [],
      columns: [
        { id: 'todo', title: t('colTodo'), wipLimit: 0 },
        { id: 'doing', title: t('colDoing'), wipLimit: 3 },
        { id: 'done', title: t('colDone'), wipLimit: 0 },
      ],
      createdAt: Date.now(),
    };
    await projectsCol.put(proj);
    projects.push(proj);
    state.nav = `project:${proj.id}`;
    await writeSharedTasksSnapshot(ctx.fs, tasks, projects);
    renderSidebar();
    renderMain();
  }

  /** @param {TaskProject} proj */
  async function promptNewSection(proj) {
    const name = await /** @type {any} */ (ctx.dialog).prompt(t('sectionPrompt'), '', { title: t('newSection') });
    if (!name?.trim()) return;
    proj.sections.push({ id: crypto.randomUUID(), name: name.trim() });
    await projectsCol.put(proj);
    renderMain();
  }

  /** @param {TaskProject} proj */
  async function promptNewColumn(proj) {
    const title = await /** @type {any} */ (ctx.dialog).prompt(t('columnPrompt'), '', { title: t('addColumn') });
    if (!title?.trim()) return;
    const wipStr = await /** @type {any} */ (ctx.dialog).prompt(t('wipPrompt'), '0', { title: t('wipLimit') });
    const wipLimit = Math.max(0, Number(wipStr) || 0);
    proj.columns.push({ id: crypto.randomUUID(), title: title.trim(), wipLimit });
    await projectsCol.put(proj);
    renderBody();
  }

  async function promptSaveFilter() {
    const name = await /** @type {any} */ (ctx.dialog).prompt(t('filterPrompt'), state.query || 'Filter', {
      title: t('newFilter'),
    });
    if (!name?.trim()) return;
    const sf = { id: crypto.randomUUID(), name: name.trim(), query: state.query, nav: state.nav };
    await filtersCol.put(sf);
    savedFilters.push(sf);
    renderSidebar();
  }

  // Listen for cross-app events: Notes checklist → Task, Focus session → log tracked time
  ctx.events.on('tasks:create-from-note', async (/** @type {any} */ payload) => {
    if (!payload?.title) return;
    const now = Date.now();
    /** @type {TaskItem} */
    const item = {
      id: crypto.randomUUID(),
      title: String(payload.title),
      description: '',
      projectId: 'inbox',
      sectionId: '',
      status: 'todo',
      priority: 3,
      dueDate: formatLocalDate(new Date()),
      dueTime: null,
      startDate: null,
      tags: [],
      subtasks: [],
      estimateMinutes: 0,
      trackedMinutes: 0,
      attachments: [],
      noteLinks: payload.notePath ? [String(payload.notePath)] : [],
      recurrence: null,
      reminderMinutesBefore: null,
      schedulerJobId: null,
      completed: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      order: now,
    };
    await saveTask(item);
    renderSidebar();
    renderMain();
  });

  ctx.events.on('focus:logged', async (/** @type {any} */ payload) => {
    const item = tasks.find((x) => x.id === payload?.taskId);
    if (!item) return;
    item.trackedMinutes = (item.trackedMinutes || 0) + (Number(payload.minutes) || 0);
    await saveTask(item);
    renderBody();
    renderDetail();
  });

  ctx.i18n.onChange(() => {
    quickInput.placeholder = t('quickAddPlaceholder');
    searchInput.placeholder = t('searchPlaceholder');
    renderSidebar();
    renderMain();
    renderDetail();
  });

  await loadAll();
  renderSidebar();
  renderMain();
  if (state.selectedId) selectTask(state.selectedId);
  if (args.focusQuickAdd) setTimeout(() => quickInput.focus(), 50);

  return {
    saveState: () => ({
      nav: state.nav,
      layout: state.layout,
      groupBy: state.groupBy,
      query: state.query,
      selectedId: state.selectedId,
    }),
    onIntent(intent) {
      if (intent.action === 'share') {
        const data = /** @type {any} */ (intent.data);
        const text = typeof data === 'string' ? data : data?.title;
        if (text) {
          quickInput.value = text;
          state.quickAddText = text;
          void submitQuickAdd();
        }
      }
    },
  };
}
