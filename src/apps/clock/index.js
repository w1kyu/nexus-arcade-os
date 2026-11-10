// @ts-check
// Nexus Clock: World clock (analog + digital), multiple named timers,
// stopwatch with lap recording and export, and time-zone meeting planner.
import { button, h, replace } from '../../ui/dom.js';
import { DEFAULT_CITIES, exportLapsText, formatStopwatchTime, getCityTime, planMeetingOverlap } from './model.js';
import './styles.css';

/**
 * Terminal command: `clock [world | meeting <city1> <city2> ...]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async clock(ctx, io) {
    const sub = io.args[0] ?? 'world';

    if (sub === 'world') {
      const now = new Date();
      io.out(`--- World Clock (${DEFAULT_CITIES.length} cities) ---\n`);
      for (const c of DEFAULT_CITIES) {
        const { timeStr, dateStr } = getCityTime(now, c.timeZone);
        io.out(`• ${c.name} (${c.country}): ${timeStr} · ${dateStr}\n`);
      }
      return 0;
    }

    if (sub === 'meeting') {
      const chosenTzs = ['Europe/Berlin', 'America/New_York', 'Asia/Tokyo'];
      const overlap = planMeetingOverlap(chosenTzs);
      const ideal = overlap.filter((o) => o.isIdeal);

      io.out(`--- Meeting Planner (Berlin, New York, Tokyo) ---\n`);
      if (ideal.length === 0) {
        io.out(`No single hour has all 3 locations within 09:00 - 18:00.\n`);
      } else {
        io.out(`Ideal UTC hours: ${ideal.map((i) => `${i.utcHour}:00`).join(', ')}\n`);
      }
      return 0;
    }

    io.err(`Unknown subcommand "${sub}". Try: clock [world | meeting]\n`);
    return 1;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'clock.timer': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.clock', args: { tab: 'timers' } }),
  'clock.stopwatch': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.clock', args: { tab: 'stopwatch' } }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  /** @type {'world' | 'timers' | 'stopwatch' | 'meeting'} */
  let activeTab = 'world';

  // Stopwatch state
  let swRunning = false;
  let swElapsed = 0;
  let swLastTimestamp = 0;
  /** @type {Array<{ lapIndex: number, lapTimeMs: number, overallTimeMs: number }>} */
  const swLaps = [];

  // Multi-timer state
  /** @type {Array<{ id: string, name: string, totalSec: number, remSec: number, running: boolean }>} */
  const timers = [
    { id: '1', name: 'Pomodoro', totalSec: 25 * 60, remSec: 25 * 60, running: false },
    { id: '2', name: 'Tea', totalSec: 3 * 60, remSec: 3 * 60, running: false },
  ];

  const container = h('div', { class: 'nx-clock' });
  replace(root, container);

  (ctx.timers?.setInterval ?? setInterval)(() => {
    if (activeTab === 'world' || activeTab === 'timers' || (activeTab === 'stopwatch' && swRunning)) {
      render();
    }
  }, 1000);

  let swInterval = null;

  function render() {
    const nav = h(
      'header',
      { class: 'nx-clock-nav' },
      h(
        'div',
        { style: { display: 'flex', gap: '6px' } },
        button({
          label: ctx.i18n.t('tabWorld'),
          variant: activeTab === 'world' ? 'primary' : 'secondary',
          size: 'small',
          onClick: () => {
            activeTab = 'world';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('tabTimers'),
          variant: activeTab === 'timers' ? 'primary' : 'secondary',
          size: 'small',
          onClick: () => {
            activeTab = 'timers';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('tabStopwatch'),
          variant: activeTab === 'stopwatch' ? 'primary' : 'secondary',
          size: 'small',
          onClick: () => {
            activeTab = 'stopwatch';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('tabMeeting'),
          variant: activeTab === 'meeting' ? 'primary' : 'secondary',
          size: 'small',
          onClick: () => {
            activeTab = 'meeting';
            render();
          },
        }),
      ),
    );

    const body = h('div', { class: 'nx-clock-body' });

    if (activeTab === 'world') {
      renderWorldClock(body);
    } else if (activeTab === 'timers') {
      renderTimers(body);
    } else if (activeTab === 'stopwatch') {
      renderStopwatch(body);
    } else if (activeTab === 'meeting') {
      renderMeetingPlanner(body);
    }

    replace(container, nav, body);
  }

  function renderWorldClock(host) {
    const now = new Date();
    const cards = DEFAULT_CITIES.map((city) => {
      const { timeStr, dateStr, hour, minute, second } = getCityTime(now, city.timeZone);

      // Analog hand rotations
      const hourDeg = (hour % 12) * 30 + minute * 0.5;
      const minDeg = minute * 6;
      const secDeg = second * 6;

      const analog = h(
        'div',
        { class: 'nx-analog-clock' },
        h('div', { class: 'nx-analog-hand nx-hand-hour', style: { transform: `rotate(${hourDeg}deg)` } }),
        h('div', { class: 'nx-analog-hand nx-hand-min', style: { transform: `rotate(${minDeg}deg)` } }),
        h('div', { class: 'nx-analog-hand nx-hand-sec', style: { transform: `rotate(${secDeg}deg)` } }),
        h('div', { class: 'nx-analog-center-dot' }),
      );

      return h(
        'div',
        { class: 'nx-clock-card' },
        analog,
        h('div', { class: 'nx-clock-city', text: city.name }),
        h('div', { class: 'nx-clock-digital', text: timeStr }),
        h('div', { class: 'nx-clock-date', text: dateStr }),
      );
    });

    const grid = h('div', { class: 'nx-clock-grid' }, ...cards);
    replace(host, grid);
  }

  function renderTimers(host) {
    const items = timers.map((t) => {
      const mins = Math.floor(t.remSec / 60);
      const secs = t.remSec % 60;
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--nx-bg-surface, #1a1d26)',
            borderRadius: '8px',
            border: '1px solid var(--nx-border, #2d3342)',
          },
        },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('strong', { text: t.name }),
          h('span', {
            style: { fontSize: '24px', fontWeight: '700', fontFamily: 'monospace', color: '#ff8a3d' },
            text: timeStr,
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          button({
            label: t.running ? ctx.i18n.t('pause') : ctx.i18n.t('start'),
            variant: t.running ? 'secondary' : 'primary',
            onClick: () => {
              t.running = !t.running;
              renderTimers(host);
            },
          }),
          button({
            label: ctx.i18n.t('reset'),
            variant: 'secondary',
            onClick: () => {
              t.remSec = t.totalSec;
              t.running = false;
              renderTimers(host);
            },
          }),
          button({
            icon: 'trash',
            onClick: () => {
              const idx = timers.findIndex((x) => x.id === t.id);
              if (idx !== -1) timers.splice(idx, 1);
              renderTimers(host);
            },
          }),
        ),
      );
    });

    const addTimerBtn = button({
      label: ctx.i18n.t('newTimer'),
      icon: 'plus',
      variant: 'primary',
      onClick: () => {
        const name = prompt('Timer Name:') || 'Timer';
        const mins = parseInt(prompt('Minutes:') || '5', 10);
        timers.push({
          id: crypto.randomUUID(),
          name,
          totalSec: mins * 60,
          remSec: mins * 60,
          running: false,
        });
        renderTimers(host);
      },
    });

    const wrap = h(
      'div',
      {
        style: { flex: '1', display: 'flex', flexDirection: 'column', padding: '20px', gap: '14px', overflowY: 'auto' },
      },
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between' } },
        h('strong', { text: ctx.i18n.t('tabTimers') }),
        addTimerBtn,
      ),
      ...items,
    );

    replace(host, wrap);
  }

  function renderStopwatch(host) {
    const timeDisplay = h('div', { class: 'nx-stopwatch-display', text: formatStopwatchTime(swElapsed) });

    const startBtn = button({
      label: swRunning ? ctx.i18n.t('pause') : ctx.i18n.t('start'),
      variant: swRunning ? 'secondary' : 'primary',
      onClick: () => {
        swRunning = !swRunning;
        if (swRunning) {
          swLastTimestamp = Date.now();
          swInterval = setInterval(() => {
            const now = Date.now();
            swElapsed += now - swLastTimestamp;
            swLastTimestamp = now;
            timeDisplay.textContent = formatStopwatchTime(swElapsed);
          }, 50);
        } else {
          if (swInterval) clearInterval(swInterval);
        }
        renderStopwatch(host);
      },
    });

    const lapBtn = button({
      label: ctx.i18n.t('lap'),
      disabled: !swRunning,
      onClick: () => {
        const prevTotal = swLaps.reduce((acc, l) => acc + l.lapTimeMs, 0);
        const lapTime = swElapsed - prevTotal;
        swLaps.unshift({
          lapIndex: swLaps.length + 1,
          lapTimeMs: lapTime,
          overallTimeMs: swElapsed,
        });
        renderStopwatch(host);
      },
    });

    const resetBtn = button({
      label: ctx.i18n.t('reset'),
      variant: 'secondary',
      onClick: () => {
        swRunning = false;
        if (swInterval) clearInterval(swInterval);
        swElapsed = 0;
        swLaps.length = 0;
        renderStopwatch(host);
      },
    });

    const exportBtn = button({
      label: ctx.i18n.t('exportLaps'),
      disabled: swLaps.length === 0,
      onClick: () => {
        const txt = exportLapsText(swLaps);
        navigator.clipboard.writeText(txt);
        alert('Copied laps to clipboard!');
      },
    });

    const lapsList = h(
      'div',
      { class: 'nx-stopwatch-laps' },
      ...swLaps.map((l) =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderBottom: '1px solid var(--nx-border-subtle, #212631)',
              fontSize: '13px',
              fontFamily: 'monospace',
            },
          },
          h('span', { text: `Lap ${l.lapIndex}` }),
          h('span', { style: { color: '#ff8a3d' }, text: formatStopwatchTime(l.lapTimeMs) }),
          h('span', { style: { color: 'var(--nx-text-muted, #7d8590)' }, text: formatStopwatchTime(l.overallTimeMs) }),
        ),
      ),
    );

    const controls = h('div', { style: { display: 'flex', gap: '10px' } }, startBtn, lapBtn, resetBtn, exportBtn);

    const wrap = h('div', { class: 'nx-stopwatch-wrap' }, timeDisplay, controls, lapsList);
    replace(host, wrap);
  }

  function renderMeetingPlanner(host) {
    const selectedTzs = ['Europe/Berlin', 'America/New_York', 'Asia/Tokyo'];
    const overlap = planMeetingOverlap(selectedTzs);
    const ideal = overlap.filter((o) => o.isIdeal);

    const header = h(
      'div',
      { class: 'nx-meeting-row' },
      h('strong', { text: 'City' }),
      ...Array.from({ length: 24 }, (_, i) =>
        h('div', {
          style: { textAlign: 'center', fontSize: '10px', color: 'var(--nx-text-muted, #7d8590)' },
          text: `${i}h`,
        }),
      ),
    );

    const rows = selectedTzs.map((tz) => {
      const cityName = tz.split('/')[1].replace(/_/g, ' ');
      const cells = overlap.map((item) => {
        const localH = item.cityHours[tz];
        const isWork = localH >= 9 && localH < 18;
        const isNight = localH >= 22 || localH < 7;
        return h('div', {
          class: `nx-meeting-cell${isWork ? ' is-work' : isNight ? ' is-night' : ''}`,
          text: String(localH),
          title: `${cityName}: ${localH}:00`,
        });
      });
      return h(
        'div',
        { class: 'nx-meeting-row' },
        h('span', { style: { fontSize: '11px', fontWeight: '600' }, text: cityName }),
        ...cells,
      );
    });

    const idealBanner = h(
      'div',
      {
        style: { padding: '12px', background: 'var(--nx-bg-surface, #1a1d26)', borderRadius: '6px', fontSize: '13px' },
      },
      ideal.length > 0
        ? h('span', {
            style: { color: '#4ade80' },
            text: `${ctx.i18n.t('idealTime')} ${ideal.map((i) => `${i.utcHour}:00 UTC`).join(', ')}`,
          })
        : h('span', { style: { color: '#ff8a3d' }, text: ctx.i18n.t('noIdealTime') }),
    );

    const grid = h('div', { class: 'nx-meeting-grid' }, idealBanner, header, ...rows);
    replace(host, grid);
  }

  render();
}
