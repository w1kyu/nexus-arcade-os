// @ts-check
// Nexus Grade Tracker: German 1.0-5.0 & international GPA scales, ECTS weighting,
// semester analytics, exam attempts, partial grades, and What-If simulator.
import { button, h, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { computeDegreeStats, computeWhatIfTarget, GERMAN_GRADES, simulateGradeForModule } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').ModuleItem} ModuleItem */
/** @typedef {import('./model.js').DegreeProfile} DegreeProfile */
/** @typedef {import('./model.js').PartialGrade} PartialGrade */

/**
 * Terminal command handler: `grades [summary | list | whatif <target>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async grades(ctx, io) {
    const modulesCol = /** @type {import('../../kernel/types').Collection<ModuleItem>} */ (
      ctx.storage.collection('modules')
    );
    const profilesCol = /** @type {import('../../kernel/types').Collection<DegreeProfile>} */ (
      ctx.storage.collection('profiles')
    );

    const modules = await modulesCol.all();
    const profiles = await profilesCol.all();
    const profile = profiles[0] || { name: 'Degree', requiredEcts: 180, scale: 'german', targetGrade: 2.0 };
    const stats = computeDegreeStats(modules);

    const sub = io.args[0] ?? 'summary';

    if (sub === 'summary') {
      io.out(`--- ${profile.name} ---\n`);
      io.out(`Weighted Average: ${stats.average !== null ? stats.average.toFixed(2) : 'N/A'}\n`);
      io.out(
        `Passed ECTS: ${stats.passedEcts} / ${profile.requiredEcts} (${Math.round((stats.passedEcts / profile.requiredEcts) * 100)}%)\n`,
      );
      return 0;
    }

    if (sub === 'whatif') {
      const target = Number(io.args[1]) || profile.targetGrade || 2.0;
      const whatif = computeWhatIfTarget(modules, target, profile.requiredEcts, profile.scale);
      io.out(`Target Grade: ${target}\n`);
      io.out(`Remaining ECTS: ${whatif.remainingEcts}\n`);
      io.out(
        `Needed Average in remaining modules: ${whatif.neededAverage !== null ? whatif.neededAverage.toFixed(2) : 'N/A'}\n`,
      );
      io.out(`Achievable: ${whatif.possible ? 'YES' : 'NO'}\n`);
      return 0;
    }

    for (const m of modules) {
      io.out(`[Sem ${m.semester}] ${m.name} (${m.ects} ECTS): ${m.grade !== null ? m.grade : '-'} (${m.status})\n`);
    }
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'grades.summary': async (ctx) => {
    const modulesCol = /** @type {import('../../kernel/types').Collection<ModuleItem>} */ (
      ctx.storage.collection('modules')
    );
    const modules = await modulesCol.all();
    const stats = computeDegreeStats(modules);
    ctx.notify({
      title: ctx.i18n.t('appTitle'),
      body: `Average: ${stats.average !== null ? stats.average.toFixed(2) : 'N/A'} · ${stats.passedEcts} ECTS`,
    });
  },
};

/**
 * Mounts the Grade Tracker window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, _args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const profilesCol = /** @type {import('../../kernel/types').Collection<DegreeProfile>} */ (
    ctx.storage.collection('profiles')
  );
  const modulesCol = /** @type {import('../../kernel/types').Collection<ModuleItem>} */ (
    ctx.storage.collection('modules')
  );

  /** @type {DegreeProfile[]} */
  let profiles = [];
  /** @type {ModuleItem[]} */
  let modules = [];
  /** @type {DegreeProfile} */
  let activeProfile;

  let whatIfTargetGrade = Number(ctx.settings.get('targetGrade')) || 2.0;
  let simModuleId = '';
  let simGrade = 1.3;

  async function loadData() {
    profiles = await profilesCol.all();
    modules = await modulesCol.all();

    if (!profiles.length) {
      const defaultProf = {
        id: crypto.randomUUID(),
        name: ctx.i18n.locale === 'de' ? 'B.Sc. Informatik' : 'B.Sc. Computer Science',
        requiredEcts: 180,
        scale: /** @type {const} */ ('german'),
        targetGrade: 2.0,
      };
      await profilesCol.put(defaultProf);
      profiles = [defaultProf];
    }
    activeProfile = profiles[0];

    if (!modules.length) {
      const seeded = [
        {
          id: crypto.randomUUID(),
          profileId: activeProfile.id,
          name: ctx.i18n.locale === 'de' ? 'Programmieren 1' : 'Programming 1',
          code: 'CS101',
          ects: 8,
          grade: 1.3,
          semester: 1,
          status: /** @type {const} */ ('passed'),
          countsTowardsFinal: true,
          attempt: 1,
        },
        {
          id: crypto.randomUUID(),
          profileId: activeProfile.id,
          name: ctx.i18n.locale === 'de' ? 'Diskrete Mathematik' : 'Discrete Mathematics',
          code: 'MATH101',
          ects: 7,
          grade: 2.0,
          semester: 1,
          status: /** @type {const} */ ('passed'),
          countsTowardsFinal: true,
          attempt: 1,
        },
        {
          id: crypto.randomUUID(),
          profileId: activeProfile.id,
          name: ctx.i18n.locale === 'de' ? 'Betriebssysteme' : 'Operating Systems',
          code: 'CS201',
          ects: 8,
          grade: 1.7,
          semester: 2,
          status: /** @type {const} */ ('passed'),
          countsTowardsFinal: true,
          attempt: 1,
        },
        {
          id: crypto.randomUUID(),
          profileId: activeProfile.id,
          name: ctx.i18n.locale === 'de' ? 'Algorithmen & Datenstrukturen' : 'Algorithms & Data Structures',
          code: 'CS102',
          ects: 8,
          grade: null,
          semester: 2,
          status: /** @type {const} */ ('in_progress'),
          countsTowardsFinal: true,
          attempt: 1,
        },
        {
          id: crypto.randomUUID(),
          profileId: activeProfile.id,
          name: ctx.i18n.locale === 'de' ? 'Datenbanken' : 'Databases',
          code: 'CS202',
          ects: 6,
          grade: null,
          semester: 3,
          status: /** @type {const} */ ('planned'),
          countsTowardsFinal: true,
          attempt: 1,
        },
      ];
      for (const m of seeded) await modulesCol.put(m);
      modules = seeded;
    }

    if (modules.length && !simModuleId) {
      simModuleId = modules[0].id;
    }
  }

  const root = h('div', { class: 'nx-grades' });
  container.replaceChildren(root);

  function render() {
    replace(root);

    const stats = computeDegreeStats(modules);
    const progressPct = Math.min(100, Math.round((stats.passedEcts / activeProfile.requiredEcts) * 100));

    // Best & worst modules
    const graded = modules.filter((m) => m.grade !== null && Number.isFinite(m.grade));
    graded.sort((a, b) => (a.grade || 0) - (b.grade || 0));
    const bestMod = graded.length ? `${graded[0].name} (${graded[0].grade})` : '—';
    const worstMod = graded.length ? `${graded.at(-1)?.name} (${graded.at(-1)?.grade})` : '—';

    // 1. Toolbar
    const toolbar = h(
      'div',
      { class: 'nx-grades-toolbar' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('strong', { text: activeProfile.name }),
        h('span', { class: 'nx-grades-badge is-passed', text: `${activeProfile.requiredEcts} ECTS` }),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        button({
          label: t('newModule'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => promptEditModule(),
        }),
      ),
    );

    // 2. KPI Cards
    const kpiAverage = h(
      'div',
      { class: 'nx-grades-card' },
      h('span', { style: { fontSize: '11px', opacity: '0.7' }, text: t('weightedAverage') }),
      h('div', { class: 'nx-grades-card-val' }, stats.average !== null ? stats.average.toFixed(2) : '—'),
      h('span', { style: { fontSize: '11px', opacity: '0.6' } }, `${stats.gradedEcts} ECTS counted`),
    );

    const kpiEcts = h(
      'div',
      { class: 'nx-grades-card' },
      h('span', { style: { fontSize: '11px', opacity: '0.7' }, text: t('ectsEarned') }),
      h('div', { class: 'nx-grades-card-val' }, `${stats.passedEcts} / ${activeProfile.requiredEcts}`),
      h(
        'div',
        { class: 'nx-grades-progress-bar' },
        h('div', { class: 'nx-grades-progress-fill', style: { width: `${progressPct}%` } }),
      ),
    );

    const kpiExtremes = h(
      'div',
      { class: 'nx-grades-card' },
      h('span', { style: { fontSize: '11px', opacity: '0.7' }, text: `${t('bestModule')} / ${t('worstModule')}` }),
      h('div', { style: { fontSize: '13px', fontWeight: '600', marginTop: '4px' } }, `★ ${bestMod}`),
      h('div', { style: { fontSize: '12px', opacity: '0.75' } }, `▼ ${worstMod}`),
    );

    const kpis = h('div', { class: 'nx-grades-kpis' }, kpiAverage, kpiEcts, kpiExtremes);

    // 3. Body layout: Left = Table, Right = What-If
    const body = h('div', { class: 'nx-grades-body' });

    // Left: Modules list
    const listSection = h('div', { class: 'nx-grades-list-section' });
    const table = h('table', { class: 'nx-grades-module-table' });
    const thead = h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { text: t('semester') }),
        h('th', { text: t('moduleName') }),
        h('th', { text: t('ects') }),
        h('th', { text: t('grade') }),
        h('th', { text: t('status') }),
        h('th', { text: '' }),
      ),
    );
    const tbody = h('tbody');

    const sortedModules = [...modules].sort((a, b) => a.semester - b.semester || a.name.localeCompare(b.name));

    for (const m of sortedModules) {
      const statusBadge = h('span', {
        class: `nx-grades-badge is-${m.status === 'passed' ? 'passed' : m.status === 'failed' ? 'failed' : m.status === 'in_progress' ? 'progress' : 'planned'}`,
        text: t(`status${m.status === 'in_progress' ? 'InProgress' : m.status[0].toUpperCase() + m.status.slice(1)}`),
      });

      const row = h(
        'tr',
        { class: 'nx-grades-module-row' },
        h('td', { style: { fontWeight: '600' } }, `Sem. ${m.semester}`),
        h(
          'td',
          {},
          h('strong', { text: m.name }),
          m.code ? h('span', { style: { marginLeft: '6px', fontSize: '11px', opacity: '0.6' }, text: m.code }) : null,
        ),
        h('td', { text: `${m.ects} ECTS` }),
        h('td', { style: { fontWeight: '700' }, text: m.grade !== null ? String(m.grade.toFixed(1)) : '—' }),
        h('td', {}, statusBadge),
        h(
          'td',
          { style: { textAlign: 'right' } },
          button({
            icon: 'edit',
            onClick: () => promptEditModule(m),
          }),
        ),
      );
      tbody.append(row);
    }
    table.append(thead, tbody);
    listSection.append(table);

    // Right: What-If Calculator & Scenario Simulator
    const whatIfSection = h('div', { class: 'nx-grades-whatif-section' });

    // What-If Box
    const whatIfCalc = computeWhatIfTarget(modules, whatIfTargetGrade, activeProfile.requiredEcts, activeProfile.scale);
    const whatIfTargetInput = h('input', {
      class: 'nx-input',
      type: 'number',
      min: '1.0',
      max: '5.0',
      step: '0.1',
      value: String(whatIfTargetGrade),
    });
    whatIfTargetInput.addEventListener('change', () => {
      whatIfTargetGrade = Number(whatIfTargetInput.value) || 2.0;
      render();
    });

    const whatIfBox = h(
      'div',
      { class: 'nx-grades-whatif-box' },
      h('h3', { style: { margin: '0 0 6px 0', fontSize: '15px' }, text: t('whatIfTargetTitle') }),
      h('p', { style: { margin: '0', fontSize: '12px', opacity: '0.75' }, text: t('whatIfTargetDesc') }),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('label', { text: t('targetGrade') }),
        whatIfTargetInput,
      ),
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' } },
        h('span', { text: t('neededAverage') }),
        h(
          'strong',
          { style: { fontSize: '18px', color: whatIfCalc.possible ? '#34d399' : '#fb7185' } },
          whatIfCalc.neededAverage !== null ? whatIfCalc.neededAverage.toFixed(2) : '—',
        ),
      ),
      h('span', {
        class: `nx-grades-badge is-${whatIfCalc.possible ? 'passed' : 'failed'}`,
        text: whatIfCalc.possible ? t('achievable') : t('notAchievable'),
      }),
    );

    // Scenario Simulator
    const modSelect = h('select', { class: 'nx-select' });
    for (const m of modules) {
      const opt = h('option', { value: m.id, text: `${m.name} (${m.ects} ECTS)` });
      if (m.id === simModuleId) opt.selected = true;
      modSelect.append(opt);
    }
    modSelect.addEventListener('change', () => {
      simModuleId = modSelect.value;
      render();
    });

    const gradeSelect = h('select', { class: 'nx-select' });
    for (const g of GERMAN_GRADES) {
      const opt = h('option', { value: String(g), text: String(g.toFixed(1)) });
      if (Math.abs(g - simGrade) < 0.05) opt.selected = true;
      gradeSelect.append(opt);
    }
    gradeSelect.addEventListener('change', () => {
      simGrade = Number(gradeSelect.value);
      render();
    });

    const simulatedAvg = simulateGradeForModule(modules, simModuleId, simGrade);

    const scenarioBox = h(
      'div',
      { class: 'nx-grades-whatif-box' },
      h('h3', { style: { margin: '0 0 6px 0', fontSize: '15px' }, text: t('scenarioSim') }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, modSelect, gradeSelect),
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' } },
        h('span', { text: t('simulatedResult') }),
        h(
          'strong',
          { style: { fontSize: '20px', color: 'var(--nx-accent, #38bdf8)' } },
          simulatedAvg !== null ? simulatedAvg.toFixed(2) : '—',
        ),
      ),
    );

    whatIfSection.append(whatIfBox, scenarioBox);
    body.append(listSection, whatIfSection);

    root.append(toolbar, kpis, body);
  }

  /**
   * Prompts to create or edit a module.
   * @param {ModuleItem} [existing]
   */
  async function promptEditModule(existing) {
    const nameInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.name || '',
      placeholder: 'e.g. Software Engineering',
    });
    const codeInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.code || '',
      placeholder: 'e.g. CS301',
    });
    const ectsInput = h('input', {
      class: 'nx-input',
      type: 'number',
      min: '1',
      max: '30',
      value: String(existing?.ects || 5),
    });
    const gradeInput = h('input', {
      class: 'nx-input',
      type: 'number',
      min: '1.0',
      max: '5.0',
      step: '0.1',
      value: existing?.grade !== null && existing?.grade !== undefined ? String(existing.grade) : '',
    });
    const semInput = h('input', {
      class: 'nx-input',
      type: 'number',
      min: '1',
      max: '12',
      value: String(existing?.semester || 1),
    });
    const attemptInput = h('input', {
      class: 'nx-input',
      type: 'number',
      min: '1',
      max: '3',
      value: String(existing?.attempt || 1),
    });

    const statusSelect = h('select', { class: 'nx-select' });
    statusSelect.append(
      h('option', { value: 'planned', text: t('statusPlanned'), selected: existing?.status === 'planned' }),
      h('option', { value: 'in_progress', text: t('statusInProgress'), selected: existing?.status === 'in_progress' }),
      h('option', { value: 'passed', text: t('statusPassed'), selected: existing?.status === 'passed' }),
      h('option', { value: 'failed', text: t('statusFailed'), selected: existing?.status === 'failed' }),
    );

    const countsCheck = h('input', { type: 'checkbox' });
    countsCheck.checked = existing ? existing.countsTowardsFinal : true;

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('label', {}, t('moduleName'), nameInput),
      h('label', {}, t('moduleCode'), codeInput),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        h('label', {}, t('ects'), ectsInput),
        h('label', {}, t('grade'), gradeInput),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        h('label', {}, t('semester'), semInput),
        h('label', {}, t('attempt'), attemptInput),
      ),
      h('label', {}, t('status'), statusSelect),
      h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, countsCheck, t('countsFinal')),
    );

    await openModal({
      title: existing ? t('editModule') : t('newModule'),
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
                    await modulesCol.delete(existing.id);
                    modules = modules.filter((m) => m.id !== existing.id);
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
            const parsedGrade = gradeInput.value ? Number(gradeInput.value) : null;
            /** @type {ModuleItem} */
            const item = {
              id: existing?.id || crypto.randomUUID(),
              profileId: activeProfile.id,
              name,
              code: codeInput.value.trim(),
              ects: Number(ectsInput.value) || 5,
              grade: parsedGrade,
              semester: Number(semInput.value) || 1,
              status: /** @type {any} */ (statusSelect.value),
              countsTowardsFinal: countsCheck.checked,
              attempt: Number(attemptInput.value) || 1,
              updatedAt: Date.now(),
            };
            await modulesCol.put(item);
            const idx = modules.findIndex((m) => m.id === item.id);
            if (idx === -1) modules.push(item);
            else modules[idx] = item;
            render();
            return true;
          },
        },
      ],
    });
  }

  await loadData();
  render();

  return {
    saveState: () => ({ activeProfileId: activeProfile.id, whatIfTargetGrade }),
  };
}
