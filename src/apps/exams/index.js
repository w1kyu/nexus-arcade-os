// @ts-check
// Nexus Exam Planner: countdown cards, topic checklists, readiness scores,
// and automated study plan generation distributed into Tasks.
import { button, h, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { computeDaysRemaining, computeReadinessScore, generateStudyPlan } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').ExamItem} ExamItem */
/** @typedef {import('./model.js').ExamTopic} ExamTopic */

/**
 * Terminal command handler: `exams [list | countdown | plan <id>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async exams(ctx, io) {
    const examsCol = /** @type {import('../../kernel/types').Collection<ExamItem>} */ (ctx.storage.collection('exams'));
    const exams = await examsCol.all();
    const sub = io.args[0] ?? 'countdown';

    if (sub === 'countdown' || sub === 'list') {
      io.out(`--- Exam Countdown (${exams.length} upcoming) ---\n`);
      for (const ex of exams) {
        const days = computeDaysRemaining(ex.date);
        const { score, status } = computeReadinessScore(ex);
        const daysText = days === 0 ? 'TODAY!' : days > 0 ? `in ${days} day(s)` : `${Math.abs(days)} days ago`;
        io.out(
          `• ${ex.moduleName} (${ex.type}): ${daysText} @ ${ex.time} in ${ex.room || 'TBD'} [Readiness: ${score}% - ${status}]\n`,
        );
      }
      return 0;
    }

    if (sub === 'plan') {
      const idPrefix = io.args[1] || '';
      const target = exams.find(
        (e) => e.id.startsWith(idPrefix) || e.moduleName.toLowerCase().includes(idPrefix.toLowerCase()),
      );
      if (!target) {
        io.err(`No exam matching "${idPrefix}"\n`);
        return 1;
      }
      const plan = generateStudyPlan(target);
      io.out(`--- Study Plan for ${target.moduleName} ---\n`);
      for (const day of plan) {
        io.out(`[${day.date}]: ${day.topics.map((t) => t.title).join(', ')}\n`);
      }
      return 0;
    }

    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'exams.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.exams', args: { action: 'newExam' } }),
};

/**
 * Mounts the Exam Planner window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const examsCol = /** @type {import('../../kernel/types').Collection<ExamItem>} */ (ctx.storage.collection('exams'));

  /** @type {ExamItem[]} */
  let exams = [];

  async function loadData() {
    exams = await examsCol.all();

    if (!exams.length) {
      const now = new Date();
      const in14Days = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const in28Days = new Date(now.getTime() + 28 * 86400000).toISOString().split('T')[0];

      const seeded = [
        {
          id: crypto.randomUUID(),
          moduleName: ctx.i18n.locale === 'de' ? 'Betriebssysteme' : 'Operating Systems',
          moduleCode: 'CS201',
          date: in14Days,
          time: '09:00',
          room: 'H1',
          type: /** @type {const} */ ('written'),
          topics: [
            { id: '1', title: 'Prozesse, Threads & Synchronisation', done: true },
            { id: '2', title: 'CPU-Scheduling Algorithmen', done: true },
            { id: '3', title: 'Virtueller Speicher & Paging', done: false },
            { id: '4', title: 'Dateisysteme & Inodes', done: false },
            { id: '5', title: 'Deadlocks & Banker-Algorithmus', done: false },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          moduleName: ctx.i18n.locale === 'de' ? 'Theoretische Informatik' : 'Theoretical Computer Science',
          moduleCode: 'CS202',
          date: in28Days,
          time: '14:00',
          room: 'C213',
          type: /** @type {const} */ ('written'),
          topics: [
            { id: '1', title: 'Endliche Automaten & Reguläre Sprachen', done: true },
            { id: '2', title: 'Kontextfreie Grammatiken & Kellerautomaten', done: false },
            { id: '3', title: 'Turing-Maschinen & Berechenbarkeit', done: false },
            { id: '4', title: 'P vs. NP & Komplexitätsklassen', done: false },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      for (const e of seeded) await examsCol.put(e);
      exams = seeded;
    }
  }

  const root = h('div', { class: 'nx-ex' });
  container.replaceChildren(root);

  function render() {
    replace(root);

    const toolbar = h(
      'div',
      { class: 'nx-ex-toolbar' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('strong', { text: t('appTitle') })),
      button({
        label: t('newExam'),
        icon: 'plus',
        variant: 'primary',
        onClick: () => promptEditExam(),
      }),
    );

    const grid = h('div', { class: 'nx-ex-grid' });

    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));

    for (const ex of sorted) {
      const days = computeDaysRemaining(ex.date);
      const daysText =
        days === 0
          ? t('daysRemainingToday')
          : days > 0
            ? t('daysRemaining', { count: days })
            : t('daysRemainingPassed');

      const { score, status } = computeReadinessScore(ex);
      const statusKey =
        status === 'ready'
          ? 'statusReady'
          : status === 'on_track'
            ? 'statusOnTrack'
            : status === 'needs_work'
              ? 'statusNeedsWork'
              : 'statusCritical';

      const card = h(
        'div',
        { class: 'nx-ex-card' },
        h(
          'div',
          { class: 'nx-ex-countdown' },
          h('div', { class: 'nx-ex-days' }, daysText),
          h('span', { class: `nx-grades-badge nx-ex-badge-${status}`, text: `${t(statusKey)} (${score}%)` }),
        ),
        h(
          'div',
          {},
          h('strong', { style: { fontSize: '16px' }, text: ex.moduleName }),
          ex.moduleCode
            ? h('span', { style: { fontSize: '12px', opacity: '0.7', marginLeft: '6px' }, text: ex.moduleCode })
            : null,
        ),
        h(
          'div',
          { style: { fontSize: '12px', opacity: '0.8' } },
          `📅 ${ex.date} @ ${ex.time} · 📍 ${ex.room || 'TBD'}`,
        ),
      );

      // Topics Checklist
      const topicList = h('div', { class: 'nx-ex-topic-list' });
      for (const topic of ex.topics) {
        const check = h('input', { type: 'checkbox' });
        check.checked = topic.done;
        check.addEventListener('change', async () => {
          topic.done = check.checked;
          ex.updatedAt = Date.now();
          await examsCol.put(ex);
          render();
        });

        const topicItem = h(
          'div',
          { class: `nx-ex-topic-item${topic.done ? ' is-done' : ''}` },
          check,
          h('span', { text: topic.title }),
        );
        topicList.append(topicItem);
      }
      card.append(topicList);

      // Actions: Generate study plan + Edit
      const actions = h(
        'div',
        { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
        button({
          label: t('generateStudyPlan'),
          icon: 'checklist',
          onClick: async () => {
            const plan = generateStudyPlan(ex);
            if (!plan.length) {
              ctx.notify({ title: ex.moduleName, body: t('studyPlanEmpty') });
              return;
            }
            for (const day of plan) {
              for (const topic of day.topics) {
                ctx.events.emit('tasks:create-from-note', {
                  title: `[${ex.moduleName}] ${topic.title}`,
                  dueDate: day.date,
                });
              }
            }
            ctx.notify({ title: ex.moduleName, body: t('studyPlanSuccess') });
          },
        }),
        button({
          icon: 'edit',
          onClick: () => promptEditExam(ex),
        }),
      );
      card.append(actions);

      grid.append(card);
    }

    root.append(toolbar, grid);
  }

  async function promptEditExam(/** @type {ExamItem} */ [existing]) {
    const nameInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.moduleName || '',
      placeholder: 'e.g. Theoretical Computer Science',
    });
    const codeInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.moduleCode || '',
      placeholder: 'e.g. CS202',
    });
    const dateInput = h('input', {
      class: 'nx-input',
      type: 'date',
      value: existing?.date || new Date().toISOString().split('T')[0],
    });
    const timeInput = h('input', { class: 'nx-input', type: 'time', value: existing?.time || '09:00' });
    const roomInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.room || '',
      placeholder: 'e.g. H1',
    });

    const topicsInput = h('textarea', {
      class: 'nx-input',
      rows: '5',
      value: existing?.topics ? existing.topics.map((t) => t.title).join('\n') : '',
      placeholder: 'Enter study topics, one per line',
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('label', {}, t('moduleName'), nameInput),
      h('label', {}, t('moduleCode'), codeInput),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        h('label', {}, t('examDate'), dateInput),
        h('label', {}, t('examTime'), timeInput),
      ),
      h('label', {}, t('room'), roomInput),
      h('label', {}, t('topics'), topicsInput),
    );

    await openModal({
      title: existing ? t('editExam') : t('newExam'),
      body: form,
      actions: [
        ...(existing
          ? [
              {
                label: t('delete'),
                value: false,
                variant: /** @type {const} */ ('danger'),
                accept: async () => {
                  const confirmed = await ctx.dialog.confirm(t('confirmDelete'));
                  if (confirmed) {
                    await examsCol.delete(existing.id);
                    exams = exams.filter((e) => e.id !== existing.id);
                    render();
                    return true;
                  }
                  return false;
                },
              },
            ]
          : []),
        { label: t('cancel'), value: false },
        {
          label: t('save'),
          value: true,
          variant: 'primary',
          accept: async () => {
            const name = nameInput.value.trim();
            if (!name) return false;

            const rawTopics = topicsInput.value
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);
            const topics = rawTopics.map((title, i) => {
              const old = existing?.topics?.[i];
              return { id: old?.id || crypto.randomUUID(), title, done: old?.done || false };
            });

            /** @type {ExamItem} */
            const item = {
              id: existing?.id || crypto.randomUUID(),
              moduleName: name,
              moduleCode: codeInput.value.trim(),
              date: dateInput.value || new Date().toISOString().split('T')[0],
              time: timeInput.value || '09:00',
              room: roomInput.value.trim(),
              type: existing?.type || 'written',
              topics,
              createdAt: existing?.createdAt || Date.now(),
              updatedAt: Date.now(),
            };

            await examsCol.put(item);
            const idx = exams.findIndex((e) => e.id === item.id);
            if (idx === -1) exams.push(item);
            else exams[idx] = item;
            render();
            return true;
          },
        },
      ],
    });
  }

  await loadData();
  render();

  if (args.action === 'newExam') {
    setTimeout(() => promptEditExam(), 50);
  }

  return {};
}
