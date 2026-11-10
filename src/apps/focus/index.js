// @ts-check
// Nexus Focus (4.4): Pomodoro & Flow timer with ring UI, compact mini-window mode,
// task linking & time logging, procedural 10-channel Web Audio ambient mixer with saved mixes,
// automatic Do-Not-Disturb & window distraction blocking with override tracking, and stats.
import { button, h, replace } from '../../ui/dom.js';
import { joinPath } from '../../ui/paths.js';
import { AMBIENT_CHANNELS, createAmbientMixer } from './audio.js';
import {
  computeFocusStats,
  formatLocalDate,
  formatTimerMMSS,
  getPhaseDurationSeconds,
  nextPomodoroPhase,
} from './model.js';
import './styles.css';

/** @typedef {import('./model.js').FocusPhase} FocusPhase */
/** @typedef {import('./model.js').FocusSessionRecord} FocusSessionRecord */
/** @typedef {import('./audio.js').AmbientChannelId} AmbientChannelId */

const PRESET_MIXES = {
  presetRainy: { rain: 0.65, thunder: 0.25, fireplace: 0.2 },
  presetDeep: { binaural: 0.45, brown: 0.3 },
  presetCozy: { fireplace: 0.6, rain: 0.25, cafe: 0.15 },
};

/**
 * Terminal command handler: `focus [stats | start]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async focus(ctx, io) {
    const sessionsCol = /** @type {import('../../kernel/types').Collection<FocusSessionRecord>} */ (
      ctx.storage.collection('sessions')
    );
    const sub = io.args[0] ?? 'stats';
    if (sub === 'start') {
      await ctx.commands.execute('shell.launchApp', { appId: 'nexus.focus', args: { autoStart: true } });
      io.out('Launched Focus timer.\n');
      return 0;
    }
    const all = await sessionsCol.all();
    const goal = Number(ctx.settings.get('dailyGoalMinutes')) || 240;
    const stats = computeFocusStats(all, goal);
    io.out(`Today: ${stats.todayMinutes} / ${goal} min (${Math.round(stats.dailyGoalProgress * 100)}%)\n`);
    io.out(`Total sessions: ${stats.totalSessions} (${stats.totalMinutes} min)\n`);
    io.out(`Longest streak: ${stats.longestStreakDays} day(s)\n`);
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'focus.start': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.focus', args: { autoStart: true } }),
};

/**
 * Mounts the Focus window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const sessionsCol = /** @type {import('../../kernel/types').Collection<FocusSessionRecord>} */ (
    ctx.storage.collection('sessions')
  );
  const mixesCol =
    /** @type {import('../../kernel/types').Collection<{ id: string, name: string, volumes: Record<string, number> }>} */ (
      ctx.storage.collection('mixes')
    );

  const mixer = createAmbientMixer(ctx.sound);

  /** @type {FocusSessionRecord[]} */
  let sessions = [];
  /** @type {{ id: string, name: string, volumes: Record<string, number> }[]} */
  let savedMixes = [];
  /** @type {Array<{ id: string, title: string, projectId: string, completed: boolean }>} */
  let openTasks = [];

  const config = {
    workMinutes: Number(ctx.settings.get('workMinutes')) || 25,
    shortBreakMinutes: Number(ctx.settings.get('shortBreakMinutes')) || 5,
    longBreakMinutes: Number(ctx.settings.get('longBreakMinutes')) || 15,
    roundsBeforeLongBreak: Number(ctx.settings.get('roundsBeforeLongBreak')) || 4,
    dailyGoalMinutes: Number(ctx.settings.get('dailyGoalMinutes')) || 240,
    autoStartNext: Boolean(ctx.settings.get('autoStartNext')),
  };

  const restored = /** @type {any} */ (args.restoredState ?? {});
  const state = {
    tab: /** @type {'timer' | 'sounds' | 'blocker' | 'stats'} */ (restored.tab ?? 'timer'),
    mode: /** @type {'pomodoro' | 'flow'} */ (restored.mode ?? 'pomodoro'),
    phase: /** @type {FocusPhase} */ (restored.phase ?? 'work'),
    round: /** @type {number} */ (restored.round ?? 1),
    running: false,
    secondsRemaining: getPhaseDurationSeconds('work', config),
    flowSecondsElapsed: 0,
    startedAt: 0,
    selectedTaskId: /** @type {string} */ (args.taskId ?? restored.selectedTaskId ?? ''),
    selectedTaskTitle: /** @type {string} */ (args.taskTitle ?? restored.selectedTaskTitle ?? ''),
    journalNote: '',
    compact: false,
    blockGames: /** @type {boolean} */ (restored.blockGames ?? true),
    blockedApps: /** @type {string[]} */ (restored.blockedApps ?? ['nexus.browser']),
    sessionOverrides: 0,
    totalOverrides: 0,
  };

  async function loadTasksSnapshot() {
    try {
      const snapPath = joinPath(String(ctx.fs.home), '.config/tasks-snapshot.json');
      if (await ctx.fs.exists(snapPath)) {
        const parsed = JSON.parse(await ctx.fs.readText(snapPath));
        openTasks = Array.isArray(parsed.tasks) ? parsed.tasks.filter((tk) => !tk.completed) : [];
        if (state.selectedTaskId && !state.selectedTaskTitle) {
          const found = openTasks.find((tk) => tk.id === state.selectedTaskId);
          if (found) state.selectedTaskTitle = found.title;
        }
      }
    } catch {
      openTasks = [];
    }
  }

  async function loadAll() {
    sessions = await sessionsCol.all();
    savedMixes = await mixesCol.all();
    state.totalOverrides = sessions.reduce((acc, s) => acc + (s.overrides || 0), 0);
    await loadTasksSnapshot();
  }

  /**
   * Broadcasts the active work-session distraction blocker state so the Window Manager
   * and Notification Service (Do-Not-Disturb) react automatically.
   */
  function broadcastBlockerState() {
    const active = state.running && state.phase === 'work';
    const payload = {
      active,
      endsAt: active ? Date.now() + state.secondsRemaining * 1000 : 0,
      blockGames: state.blockGames,
      blockedApps: state.blockedApps,
      remainingText:
        state.mode === 'flow' ? formatTimerMMSS(state.flowSecondsElapsed) : formatTimerMMSS(state.secondsRemaining),
    };
    /** @type {any} */ (globalThis).__nexusFocusBlocker = payload;
    ctx.events.emit('focus:blocker', payload);
  }

  /**
   * Logs completed work minutes onto the linked task and persists a `FocusSessionRecord`.
   * @param {number} minutes
   */
  async function recordCompletedWorkSession(minutes) {
    if (minutes <= 0) return;
    const now = Date.now();
    const linked = openTasks.find((tk) => tk.id === state.selectedTaskId);
    /** @type {FocusSessionRecord} */
    const rec = {
      id: crypto.randomUUID(),
      phase: 'work',
      mode: state.mode,
      durationMinutes: minutes,
      taskId: state.selectedTaskId || null,
      taskTitle: linked?.title || state.selectedTaskTitle || t('noTask'),
      projectId: linked?.projectId || 'inbox',
      note: state.journalNote.trim(),
      overrides: state.sessionOverrides,
      startedAt: state.startedAt || now - minutes * 60_000,
      completedAt: now,
      date: formatLocalDate(new Date(now)),
    };
    await sessionsCol.put(rec);
    sessions.push(rec);
    state.sessionOverrides = 0;
    state.journalNote = '';

    if (state.selectedTaskId) {
      ctx.events.emit('focus:logged', { taskId: state.selectedTaskId, minutes });
      // Also update tasks-snapshot.json in case Tasks isn't open right now
      try {
        const snapPath = joinPath(String(ctx.fs.home), '.config/tasks-snapshot.json');
        if (await ctx.fs.exists(snapPath)) {
          const parsed = JSON.parse(await ctx.fs.readText(snapPath));
          if (Array.isArray(parsed.tasks)) {
            for (const tk of parsed.tasks) {
              if (tk.id === state.selectedTaskId) {
                tk.trackedMinutes = (tk.trackedMinutes || 0) + minutes;
              }
            }
            await ctx.fs.writeFile(snapPath, JSON.stringify(parsed));
          }
        }
      } catch {
        // ignore
      }
    }
  }

  /** @type {(() => void) | null} */
  let stopInterval = null;

  function startTimer() {
    if (state.running) return;
    state.running = true;
    if (!state.startedAt) state.startedAt = Date.now();
    ctx.sound.play('click');
    broadcastBlockerState();
    stopInterval = ctx.timers.setInterval(() => {
      if (state.mode === 'flow') {
        state.flowSecondsElapsed += 1;
        updateLiveTimerDOM();
        broadcastBlockerState();
      } else {
        state.secondsRemaining -= 1;
        updateLiveTimerDOM();
        broadcastBlockerState();
        if (state.secondsRemaining <= 0) {
          void completeCurrentPhase();
        }
      }
    }, 1000);
    renderBody();
  }

  function pauseTimer() {
    if (!state.running) return;
    state.running = false;
    stopInterval?.();
    stopInterval = null;
    ctx.window?.setProgress(null);
    broadcastBlockerState();
    renderBody();
  }

  function resetTimer() {
    pauseTimer();
    state.startedAt = 0;
    state.flowSecondsElapsed = 0;
    state.secondsRemaining = getPhaseDurationSeconds(state.phase, config);
    renderBody();
  }

  async function completeCurrentPhase() {
    pauseTimer();
    ctx.sound.play('achievement');

    if (state.mode === 'flow') {
      const mins = Math.max(1, Math.round(state.flowSecondsElapsed / 60));
      await recordCompletedWorkSession(mins);
      state.flowSecondsElapsed = 0;
      state.startedAt = 0;
      renderBody();
      return;
    }

    if (state.phase === 'work') {
      await recordCompletedWorkSession(config.workMinutes);
    }

    const next = nextPomodoroPhase(state.phase, state.round, config);
    state.phase = next.nextPhase;
    state.round = next.nextRound;
    state.secondsRemaining = next.durationSeconds;
    state.startedAt = 0;

    const phaseLabel =
      state.phase === 'work'
        ? t('phaseWork')
        : state.phase === 'shortBreak'
          ? t('phaseShortBreak')
          : t('phaseLongBreak');
    ctx.notify({
      title: t('phaseDoneTitle'),
      body: t('phaseDoneBody', { phase: phaseLabel }),
    });

    if (config.autoStartNext) {
      startTimer();
    } else {
      renderBody();
    }
  }

  // Listen for override logs from Window Manager
  ctx.events.on('focus:override-logged', () => {
    state.sessionOverrides += 1;
    state.totalOverrides += 1;
    if (state.tab === 'blocker' || state.tab === 'stats') renderBody();
  });

  // Listen for start-task intent from Tasks app
  ctx.events.on('focus:start-task', (/** @type {any} */ payload) => {
    if (payload?.taskId) {
      state.selectedTaskId = payload.taskId;
      state.selectedTaskTitle = payload.taskTitle || '';
      state.tab = 'timer';
      renderTop();
      renderBody();
    }
  });

  // DOM skeleton
  const topEl = h('header', { class: 'nx-focus-top' });
  const bodyEl = h('div', { class: 'nx-focus-body' });
  const rootEl = h('div', { class: 'nx-focus' }, topEl, bodyEl);
  container.append(rootEl);

  /** @type {HTMLElement | null} */
  let digitsEl = null;
  /** @type {SVGCircleElement | null} */
  let ringCircleEl = null;

  function updateLiveTimerDOM() {
    const displaySecs = state.mode === 'flow' ? state.flowSecondsElapsed : state.secondsRemaining;
    if (digitsEl) digitsEl.textContent = formatTimerMMSS(displaySecs);
    const totalSecs = getPhaseDurationSeconds(state.phase, config);
    const ratio =
      state.mode === 'flow'
        ? (state.flowSecondsElapsed % 3600) / 3600
        : totalSecs > 0
          ? 1 - state.secondsRemaining / totalSecs
          : 0;
    const circumference = 2 * Math.PI * 94;
    if (ringCircleEl) {
      ringCircleEl.setAttribute('stroke-dashoffset', String(circumference * (1 - Math.max(0, Math.min(1, ratio)))));
    }
    ctx.window?.setProgress(state.running ? Math.max(0.02, Math.min(1, ratio)) : null);
  }

  function toggleCompactMode() {
    state.compact = !state.compact;
    rootEl.classList.toggle('is-compact', state.compact);
    if (state.compact) {
      ctx.window?.resize(340, 390);
    } else {
      ctx.window?.resize(960, 660);
    }
    renderTop();
    renderBody();
  }

  function renderTop() {
    replace(
      topEl,
      h(
        'div',
        { class: 'nx-focus-tabs', role: 'tablist' },
        .../** @type {const} */ (['timer', 'sounds', 'blocker', 'stats']).map((tb) =>
          h('button', {
            type: 'button',
            role: 'tab',
            class: `nx-btn${state.tab === tb ? ' is-primary' : ''}`,
            text: t(
              tb === 'timer'
                ? 'tabTimer'
                : tb === 'sounds'
                  ? 'tabSounds'
                  : tb === 'blocker'
                    ? 'tabBlocker'
                    : 'tabStats',
            ),
            onclick: () => {
              state.tab = tb;
              renderTop();
              renderBody();
            },
          }),
        ),
      ),
      button({
        label: state.compact ? t('expandMode') : t('compactMode'),
        icon: state.compact ? 'maximize' : 'minimize',
        onClick: toggleCompactMode,
      }),
    );
  }

  function renderBody() {
    if (state.tab === 'sounds') {
      renderSoundsTab();
    } else if (state.tab === 'blocker') {
      renderBlockerTab();
    } else if (state.tab === 'stats') {
      renderStatsTab();
    } else {
      renderTimerTab();
    }
  }

  function renderTimerTab() {
    const circumference = 2 * Math.PI * 94;
    const totalSecs = getPhaseDurationSeconds(state.phase, config);
    const ratio =
      state.mode === 'flow'
        ? (state.flowSecondsElapsed % 3600) / 3600
        : totalSecs > 0
          ? 1 - state.secondsRemaining / totalSecs
          : 0;
    const dashOffset = circumference * (1 - Math.max(0, Math.min(1, ratio)));
    const displaySecs = state.mode === 'flow' ? state.flowSecondsElapsed : state.secondsRemaining;

    const svgWrap = h('div', {
      html: `<svg class="nx-focus-ring-svg" viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r="94" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
        <circle class="nx-focus-ring-fg" cx="110" cy="110" r="94" fill="none" stroke="#38bdf8" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"/>
      </svg>`,
    });
    ringCircleEl = svgWrap.querySelector('.nx-focus-ring-fg');
    digitsEl = h('div', { class: 'nx-focus-digits', text: formatTimerMMSS(displaySecs) });

    const phaseLabel =
      state.mode === 'flow'
        ? t('modeFlow')
        : state.phase === 'work'
          ? t('phaseWork')
          : state.phase === 'shortBreak'
            ? t('phaseShortBreak')
            : t('phaseLongBreak');

    const taskSelect = /** @type {HTMLSelectElement} */ (
      h(
        'select',
        {
          class: 'nx-select',
          'aria-label': t('linkedTask'),
          onchange: () => {
            state.selectedTaskId = taskSelect.value;
            const found = openTasks.find((tk) => tk.id === state.selectedTaskId);
            state.selectedTaskTitle = found?.title ?? '';
          },
        },
        h('option', { value: '', selected: !state.selectedTaskId, text: t('noTask') }),
        ...openTasks.map((tk) =>
          h('option', { value: tk.id, selected: tk.id === state.selectedTaskId, text: tk.title }),
        ),
      )
    );

    const journalInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input',
        type: 'text',
        placeholder: t('journalPlaceholder'),
        value: state.journalNote,
        oninput: () => {
          state.journalNote = journalInput.value;
        },
      })
    );

    const workInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input',
        type: 'number',
        min: '1',
        max: '120',
        value: String(config.workMinutes),
        onchange: () => {
          config.workMinutes = Math.max(1, Number.parseInt(workInput.value, 10) || 25);
          void ctx.settings.set('workMinutes', config.workMinutes);
          if (!state.running && state.phase === 'work') {
            state.secondsRemaining = config.workMinutes * 60;
            updateLiveTimerDOM();
          }
        },
      })
    );

    const shortInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input',
        type: 'number',
        min: '1',
        max: '60',
        value: String(config.shortBreakMinutes),
        onchange: () => {
          config.shortBreakMinutes = Math.max(1, Number.parseInt(shortInput.value, 10) || 5);
          void ctx.settings.set('shortBreakMinutes', config.shortBreakMinutes);
          if (!state.running && state.phase === 'shortBreak') {
            state.secondsRemaining = config.shortBreakMinutes * 60;
            updateLiveTimerDOM();
          }
        },
      })
    );

    const longInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input',
        type: 'number',
        min: '1',
        max: '60',
        value: String(config.longBreakMinutes),
        onchange: () => {
          config.longBreakMinutes = Math.max(1, Number.parseInt(longInput.value, 10) || 15);
          void ctx.settings.set('longBreakMinutes', config.longBreakMinutes);
          if (!state.running && state.phase === 'longBreak') {
            state.secondsRemaining = config.longBreakMinutes * 60;
            updateLiveTimerDOM();
          }
        },
      })
    );

    const goalInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input',
        type: 'number',
        min: '15',
        max: '720',
        value: String(config.dailyGoalMinutes),
        onchange: () => {
          config.dailyGoalMinutes = Math.max(15, Number.parseInt(goalInput.value, 10) || 240);
          void ctx.settings.set('dailyGoalMinutes', config.dailyGoalMinutes);
        },
      })
    );

    replace(
      bodyEl,
      h(
        'div',
        { class: 'nx-focus-timer-layout' },
        h(
          'div',
          { class: 'nx-focus-ring-card' },
          h(
            'div',
            { class: 'nx-btn-group', role: 'group' },
            h('button', {
              type: 'button',
              class: `nx-btn${state.mode === 'pomodoro' && state.phase === 'work' ? ' is-primary' : ''}`,
              text: t('phaseWork'),
              onclick: () => {
                pauseTimer();
                state.mode = 'pomodoro';
                state.phase = 'work';
                state.secondsRemaining = getPhaseDurationSeconds('work', config);
                renderBody();
              },
            }),
            h('button', {
              type: 'button',
              class: `nx-btn${state.mode === 'pomodoro' && state.phase === 'shortBreak' ? ' is-primary' : ''}`,
              text: t('phaseShortBreak'),
              onclick: () => {
                pauseTimer();
                state.mode = 'pomodoro';
                state.phase = 'shortBreak';
                state.secondsRemaining = getPhaseDurationSeconds('shortBreak', config);
                renderBody();
              },
            }),
            h('button', {
              type: 'button',
              class: `nx-btn${state.mode === 'pomodoro' && state.phase === 'longBreak' ? ' is-primary' : ''}`,
              text: t('phaseLongBreak'),
              onclick: () => {
                pauseTimer();
                state.mode = 'pomodoro';
                state.phase = 'longBreak';
                state.secondsRemaining = getPhaseDurationSeconds('longBreak', config);
                renderBody();
              },
            }),
            h('button', {
              type: 'button',
              class: `nx-btn${state.mode === 'flow' ? ' is-primary' : ''}`,
              text: t('modeFlow'),
              onclick: () => {
                pauseTimer();
                state.mode = 'flow';
                state.phase = 'work';
                renderBody();
              },
            }),
          ),
          h(
            'div',
            { class: 'nx-focus-ring-wrap' },
            svgWrap.firstElementChild,
            h(
              'div',
              { class: 'nx-focus-ring-center' },
              digitsEl,
              h('div', { class: 'nx-focus-phase-badge', text: phaseLabel }),
              state.mode === 'pomodoro'
                ? h('div', {
                    class: 'nx-focus-round-sub',
                    text: t('roundLabel', { current: state.round, total: config.roundsBeforeLongBreak }),
                  })
                : null,
            ),
          ),
          h(
            'div',
            { class: 'nx-focus-controls' },
            button({
              label: state.running ? t('pause') : t('start'),
              icon: state.running ? 'pause' : 'play',
              variant: 'primary',
              onClick: () => (state.running ? pauseTimer() : startTimer()),
            }),
            button({
              label: t('skip'),
              icon: 'skip-forward',
              onClick: () => void completeCurrentPhase(),
            }),
            button({
              label: t('reset'),
              icon: 'refresh',
              onClick: resetTimer,
            }),
          ),
        ),
        h(
          'div',
          { class: 'nx-focus-side-card' },
          h('label', { class: 'nx-field' }, h('span', { text: t('linkedTask') }), taskSelect),
          h('label', { class: 'nx-field' }, h('span', { text: t('journalPlaceholder') }), journalInput),
          h(
            'div',
            { class: 'nx-focus-config-grid' },
            h('label', { class: 'nx-field' }, h('span', { text: t('workLen') }), workInput),
            h('label', { class: 'nx-field' }, h('span', { text: t('shortLen') }), shortInput),
            h('label', { class: 'nx-field' }, h('span', { text: t('longLen') }), longInput),
            h('label', { class: 'nx-field' }, h('span', { text: t('goalLen') }), goalInput),
          ),
        ),
      ),
    );
  }

  function renderSoundsTab() {
    const vols = mixer.getVolumes();
    replace(
      bodyEl,
      h(
        'div',
        { class: 'nx-focus-mixer' },
        h(
          'div',
          { class: 'nx-focus-presets' },
          ...Object.entries(PRESET_MIXES).map(([key, preset]) =>
            button({
              label: t(key),
              icon: 'music',
              onClick: () => {
                mixer.applyMix(preset);
                renderSoundsTab();
              },
            }),
          ),
          ...savedMixes.map((sm) =>
            button({
              label: sm.name,
              icon: 'star',
              onClick: () => {
                mixer.applyMix(sm.volumes);
                renderSoundsTab();
              },
            }),
          ),
          button({
            label: t('saveMix'),
            icon: 'plus',
            variant: 'primary',
            onClick: async () => {
              const name = await ctx.dialog.prompt(t('mixNamePrompt'), '', { title: t('saveMix') });
              if (!name || !name.trim()) return;
              const entry = { id: crypto.randomUUID(), name: name.trim(), volumes: mixer.getVolumes() };
              await mixesCol.put(entry);
              savedMixes.push(entry);
              renderSoundsTab();
            },
          }),
          button({
            label: t('muteAll'),
            icon: 'volume-off',
            onClick: () => {
              mixer.stopAll();
              renderSoundsTab();
            },
          }),
        ),
        h(
          'div',
          { class: 'nx-focus-channels' },
          ...AMBIENT_CHANNELS.map((ch) => {
            const curVol = vols[ch.id] ?? 0;
            const slider = /** @type {HTMLInputElement} */ (
              h('input', {
                type: 'range',
                min: '0',
                max: '100',
                value: String(Math.round(curVol * 100)),
                'aria-label': t(ch.labelKey),
                oninput: () => {
                  const v = Number(slider.value) / 100;
                  mixer.setVolume(ch.id, v);
                  cardEl.classList.toggle('is-active', v > 0.01);
                  pctSpan.textContent = `${Math.round(v * 100)}%`;
                },
              })
            );
            const pctSpan = h('span', { text: `${Math.round(curVol * 100)}%` });
            const cardEl = h(
              'div',
              { class: `nx-focus-channel${curVol > 0.01 ? ' is-active' : ''}`, dataset: { channel: ch.id } },
              h('div', { class: 'nx-focus-channel-head' }, h('span', { text: t(ch.labelKey) }), pctSpan),
              slider,
            );
            return cardEl;
          }),
        ),
      ),
    );
  }

  function renderBlockerTab() {
    const candidateApps = [
      { id: 'nexus.browser', label: 'Browser' },
      { id: 'nexus.appcenter', label: 'App Center' },
      { id: 'nexus.terminal', label: 'Terminal' },
    ];

    replace(
      bodyEl,
      h(
        'div',
        { class: 'nx-focus-panel' },
        h('h3', { text: t('blockerHeading') }),
        h('p', { style: { opacity: '0.8', fontSize: '13px' }, text: t('blockerDesc') }),
        h(
          'label',
          { class: 'nx-focus-row' },
          h('span', { text: t('blockGames') }),
          h('input', {
            type: 'checkbox',
            checked: state.blockGames,
            onchange: (e) => {
              state.blockGames = /** @type {HTMLInputElement} */ (e.currentTarget).checked;
              broadcastBlockerState();
            },
          }),
        ),
        h('strong', { text: t('blockedAppsList') }),
        h(
          'div',
          { class: 'nx-focus-list' },
          ...candidateApps.map((app) =>
            h(
              'label',
              { class: 'nx-focus-row' },
              h('span', { text: app.label }),
              h('input', {
                type: 'checkbox',
                checked: state.blockedApps.includes(app.id),
                onchange: (e) => {
                  const on = /** @type {HTMLInputElement} */ (e.currentTarget).checked;
                  if (on && !state.blockedApps.includes(app.id)) state.blockedApps.push(app.id);
                  if (!on) state.blockedApps = state.blockedApps.filter((x) => x !== app.id);
                  broadcastBlockerState();
                },
              }),
            ),
          ),
        ),
        h(
          'div',
          { class: 'nx-focus-row' },
          h('strong', { text: t('overridesLogged', { count: state.totalOverrides }) }),
        ),
      ),
    );
  }

  function renderStatsTab() {
    const stats = computeFocusStats(sessions, config.dailyGoalMinutes);
    const maxMin = Math.max(25, ...stats.weekByDay.map((d) => d.minutes));

    replace(
      bodyEl,
      h(
        'div',
        { class: 'nx-focus-panel nx-focus-stats' },
        h(
          'div',
          { class: 'nx-focus-stat-cards' },
          h(
            'div',
            { class: 'nx-focus-stat-card' },
            h('div', { style: { fontSize: '12px', opacity: '0.75' }, text: t('statsToday') }),
            h('div', { class: 'nx-focus-stat-val', text: `${stats.todayMinutes}m` }),
            h('div', {
              style: { fontSize: '11px', opacity: '0.65' },
              text: `${t('statsGoal', { goal: config.dailyGoalMinutes })} · ${Math.round(stats.dailyGoalProgress * 100)}%`,
            }),
          ),
          h(
            'div',
            { class: 'nx-focus-stat-card' },
            h('div', { style: { fontSize: '12px', opacity: '0.75' }, text: t('statsSessions') }),
            h('div', { class: 'nx-focus-stat-val', text: `${stats.totalSessions}` }),
          ),
          h(
            'div',
            { class: 'nx-focus-stat-card' },
            h('div', { style: { fontSize: '12px', opacity: '0.75' }, text: t('statsStreak') }),
            h('div', { class: 'nx-focus-stat-val', text: `${stats.longestStreakDays} d` }),
          ),
          h(
            'div',
            { class: 'nx-focus-stat-card' },
            h('div', { style: { fontSize: '12px', opacity: '0.75' }, text: t('statsBestTime') }),
            h('div', { class: 'nx-focus-stat-val', text: t(`tod_${stats.bestTimeOfDay}`) }),
          ),
        ),
        h('strong', { text: t('statsWeekChart') }),
        h(
          'div',
          { class: 'nx-focus-bars' },
          ...stats.weekByDay.map((day) => {
            const barH = Math.max(4, Math.round((day.minutes / maxMin) * 76));
            return h(
              'div',
              { class: 'nx-focus-bar-col' },
              h('span', { text: `${day.minutes}m` }),
              h('div', {
                html: `<svg width="28" height="80" viewBox="0 0 28 80" aria-hidden="true"><rect x="2" y="${80 - barH}" width="24" height="${barH}" rx="4" fill="currentColor" class="nx-focus-bar-svg"/></svg>`,
              }),
              h('span', { text: day.date.slice(5) }),
            );
          }),
        ),
        h('strong', { text: t('statsByTask') }),
        h(
          'div',
          { class: 'nx-focus-list' },
          ...stats.byTask.map((tk) =>
            h(
              'div',
              { class: 'nx-focus-row' },
              h('span', { text: tk.taskTitle }),
              h('strong', { text: `${tk.minutes} min (${tk.sessions})` }),
            ),
          ),
        ),
      ),
    );
  }

  ctx.signal.addEventListener('abort', () => {
    stopInterval?.();
    mixer.stopAll();
    /** @type {any} */ (globalThis).__nexusFocusBlocker = { active: false };
    ctx.events.emit('focus:blocker', { active: false });
  });

  await loadAll();
  renderTop();
  renderBody();

  if (args.autoStart) {
    startTimer();
  }

  return {
    serializeState: () => ({
      tab: state.tab,
      mode: state.mode,
      phase: state.phase,
      round: state.round,
      selectedTaskId: state.selectedTaskId,
      selectedTaskTitle: state.selectedTaskTitle,
      blockGames: state.blockGames,
      blockedApps: state.blockedApps,
    }),
  };
}
