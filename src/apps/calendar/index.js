// @ts-check
// Nexus Calendar (4.3): Day, Week, Month, Year, and Agenda views; mini-month navigator;
// multiple calendars; pointer drag-to-create / drag-to-move / drag-edge-to-resize;
// recurring events with single-instance & this-and-following exceptions;
// overlays for Tasks, Timetable, and German public holidays; RFC 5545 .ics import/export.
import { button, h, iconButton, replace } from '../../ui/dom.js';
import { joinPath } from '../../ui/paths.js';
import {
  addDays,
  applyRecurringEdit,
  computeGermanHolidays,
  deleteRecurringOccurrence,
  expandEventsInRange,
  formatLocalDate,
  getISOWeekNumber,
  parseEventQuickAdd,
  parseICS,
  parseLocalDate,
  serializeICS,
  startOfWeek,
} from './model.js';
import './styles.css';

/** @typedef {import('./model.js').CalendarEvent} CalendarEvent */
/** @typedef {import('./model.js').CalendarSource} CalendarSource */
/** @typedef {import('./model.js').ExpandedOccurrence} ExpandedOccurrence */

const CALENDAR_COLORS = ['cyan', 'emerald', 'purple', 'amber', 'rose', 'blue'];

/**
 * Terminal command handler: `cal [agenda | add <text>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async 'cal-events'(ctx, io) {
    const eventsCol = /** @type {import('../../kernel/types').Collection<CalendarEvent>} */ (
      ctx.storage.collection('events')
    );
    const sub = io.args[0] ?? 'agenda';
    if (sub === 'add') {
      const raw = io.args.slice(1).join(' ');
      if (!raw) {
        io.err('Usage: cal add <text>\n');
        return 1;
      }
      const parsed = parseEventQuickAdd(raw);
      const now = Date.now();
      /** @type {CalendarEvent} */
      const created = {
        id: crypto.randomUUID(),
        calendarId: 'personal',
        title: parsed.title,
        location: parsed.location,
        description: '',
        allDay: parsed.allDay,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
        recurrence: null,
        exdates: [],
        overrides: {},
        reminders: [15],
        createdAt: now,
        updatedAt: now,
      };
      await eventsCol.put(created);
      io.out(`Added event: ${created.title} (${created.startDate} ${created.startTime})\n`);
      return 0;
    }

    const all = await eventsCol.all();
    const today = formatLocalDate(new Date());
    const nextMonth = formatLocalDate(addDays(new Date(), 30));
    const occs = expandEventsInRange(all, today, nextMonth);
    if (!occs.length) {
      io.out('No upcoming events in the next 30 days.\n');
      return 0;
    }
    for (const o of occs) {
      const timeLabel = o.allDay ? 'all-day' : `${o.startTime}-${o.endTime}`;
      io.out(`${o.startDate} [${timeLabel}] ${o.title}${o.location ? ` @ ${o.location}` : ''}\n`);
    }
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'calendar.newEvent': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.calendar', args: { createNew: true } }),
};

/**
 * Command-palette search provider.
 * @param {import('../../kernel/types').HeadlessContext} ctx
 * @param {string} query
 */
export async function search(ctx, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const eventsCol = /** @type {import('../../kernel/types').Collection<CalendarEvent>} */ (
    ctx.storage.collection('events')
  );
  const all = await eventsCol.all();
  return all
    .filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q),
    )
    .slice(0, 8)
    .map((ev) => ({
      id: `cal:${ev.id}`,
      title: ev.title,
      subtitle: `${ev.startDate} ${ev.allDay ? '' : ev.startTime}${ev.location ? ` · ${ev.location}` : ''}`,
      icon: 'calendar',
      run: () =>
        ctx.commands.execute('shell.launchApp', {
          appId: 'nexus.calendar',
          args: { focusDate: ev.startDate, selectEventId: ev.id },
        }),
    }));
}

/**
 * Mounts the Calendar window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const eventsCol = /** @type {import('../../kernel/types').Collection<CalendarEvent>} */ (
    ctx.storage.collection('events')
  );
  const calendarsCol = /** @type {import('../../kernel/types').Collection<CalendarSource>} */ (
    ctx.storage.collection('calendars')
  );

  /** @type {CalendarSource[]} */
  let calendars = [];
  /** @type {CalendarEvent[]} */
  let events = [];
  /** @type {Array<{ id: string, title: string, dueDate: string, dueTime: string | null, completed: boolean }>} */
  let taskOverlayItems = [];
  /** @type {Array<{ id: string, title: string, dayOfWeek: number, startTime: string, endTime: string, room: string }>} */
  let timetableOverlayItems = [];

  const restored = /** @type {any} */ (args.restoredState ?? {});
  const state = {
    view: /** @type {'day' | 'week' | 'month' | 'year' | 'agenda'} */ (restored.view ?? 'week'),
    cursorDate: /** @type {string} */ (args.focusDate ?? restored.cursorDate ?? formatLocalDate(new Date())),
    miniMonthDate: /** @type {string} */ (restored.miniMonthDate ?? formatLocalDate(new Date())),
    searchQuery: /** @type {string} */ (restored.searchQuery ?? ''),
    showTasksOverlay: /** @type {boolean} */ (restored.showTasksOverlay ?? true),
    showTimetableOverlay: /** @type {boolean} */ (restored.showTimetableOverlay ?? true),
    showHolidaysOverlay: /** @type {boolean} */ (restored.showHolidaysOverlay ?? true),
    holidayState: /** @type {string} */ (ctx.settings.get('holidayState') || 'HE'),
    weekStart: /** @type {0 | 1} */ (ctx.settings.get('weekStart') === 'sunday' ? 0 : 1),
    selectedOccurrence: /** @type {ExpandedOccurrence | null} */ (null),
  };

  async function loadExternalOverlays() {
    try {
      const snapPath = joinPath(String(ctx.fs.home), '.config/tasks-snapshot.json');
      if (await ctx.fs.exists(snapPath)) {
        const parsed = JSON.parse(await ctx.fs.readText(snapPath));
        taskOverlayItems = Array.isArray(parsed.tasks) ? parsed.tasks.filter((tk) => tk.dueDate && !tk.completed) : [];
      }
    } catch {
      taskOverlayItems = [];
    }

    try {
      const ttPath = joinPath(String(ctx.fs.home), '.config/timetable-snapshot.json');
      if (await ctx.fs.exists(ttPath)) {
        const parsed = JSON.parse(await ctx.fs.readText(ttPath));
        timetableOverlayItems = Array.isArray(parsed.slots) ? parsed.slots : [];
      }
    } catch {
      timetableOverlayItems = [];
    }
  }

  async function loadData() {
    calendars = await calendarsCol.all();
    events = await eventsCol.all();

    if (!calendars.length) {
      /** @type {CalendarSource[]} */
      const defaults = [
        { id: 'personal', name: ctx.i18n.locale === 'de' ? 'Persönlich' : 'Personal', color: 'cyan', visible: true },
        { id: 'uni', name: ctx.i18n.locale === 'de' ? 'Studium' : 'University', color: 'emerald', visible: true },
        { id: 'work', name: ctx.i18n.locale === 'de' ? 'Arbeit' : 'Work', color: 'purple', visible: true },
      ];
      for (const c of defaults) await calendarsCol.put(c);
      calendars = defaults;
    }

    if (!events.length) {
      const todayStr = formatLocalDate(new Date());
      const tomorrowStr = formatLocalDate(addDays(new Date(), 1));
      const now = Date.now();
      /** @type {CalendarEvent[]} */
      const seeded = [
        {
          id: crypto.randomUUID(),
          calendarId: 'uni',
          title: ctx.i18n.locale === 'de' ? 'Vorlesung Betriebssysteme' : 'Operating Systems Lecture',
          location: 'H1',
          description: 'Kernel scheduling & virtual memory.',
          allDay: false,
          startDate: todayStr,
          endDate: todayStr,
          startTime: '10:00',
          endTime: '11:30',
          timeZone: 'Europe/Berlin',
          recurrence: { freq: 'weekly', interval: 1 },
          exdates: [],
          overrides: {},
          reminders: [15],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          calendarId: 'personal',
          title: ctx.i18n.locale === 'de' ? 'Lerngruppe in der Bibliothek' : 'Study group at Library',
          location: 'Room 2.04',
          description: '',
          allDay: false,
          startDate: tomorrowStr,
          endDate: tomorrowStr,
          startTime: '14:00',
          endTime: '16:00',
          timeZone: 'Europe/Berlin',
          recurrence: null,
          exdates: [],
          overrides: {},
          reminders: [30],
          createdAt: now,
          updatedAt: now,
        },
      ];
      for (const ev of seeded) await eventsCol.put(ev);
      events = seeded;
    }

    await loadExternalOverlays();
  }

  /**
   * Syncs reminders for an event with `ctx.scheduler`.
   * @param {CalendarEvent} ev
   */
  async function syncEventReminders(ev) {
    if (ev.allDay || !ev.reminders?.length) return;
    const [y, m, d] = ev.startDate.split('-').map((n) => Number.parseInt(n, 10));
    const [hh, mm] = (ev.startTime || '09:00').split(':').map((n) => Number.parseInt(n, 10));
    const startMs = new Date(y, m - 1, d, hh || 9, mm || 0, 0).getTime();
    for (const mins of ev.reminders) {
      const fireAt = startMs - mins * 60_000;
      if (fireAt > Date.now()) {
        await ctx.scheduler.schedule({
          at: fireAt,
          title: ev.title,
          body: `${ev.startDate} ${ev.startTime}${ev.location ? ` · ${ev.location}` : ''}`,
          command: 'shell.launchApp',
          args: { appId: 'nexus.calendar', args: { focusDate: ev.startDate, selectEventId: ev.id } },
        });
      }
    }
  }

  /**
   * Computes all occurrences (calendar events + enabled overlays) in `[startStr, endStr]`.
   * @param {string} startStr
   * @param {string} endStr
   * @returns {ExpandedOccurrence[]}
   */
  function getOccurrencesInRange(startStr, endStr) {
    /** @type {Record<string, { color: string, visible: boolean }>} */
    const calMap = {};
    for (const c of calendars) {
      calMap[c.id] = { color: c.color, visible: c.visible };
    }
    const list = expandEventsInRange(events, startStr, endStr, calMap);

    // Holidays overlay
    if (state.showHolidaysOverlay) {
      const y1 = Number.parseInt(startStr.slice(0, 4), 10);
      const y2 = Number.parseInt(endStr.slice(0, 4), 10);
      for (let y = y1; y <= y2; y++) {
        for (const hol of computeGermanHolidays(y, state.holidayState)) {
          if (hol.date >= startStr && hol.date <= endStr) {
            list.push({
              occurrenceId: `holiday:${hol.date}:${hol.titleDe}`,
              eventId: `holiday:${hol.date}`,
              occurrenceDate: hol.date,
              calendarId: 'holidays',
              title: `🎉 ${ctx.i18n.locale === 'de' ? hol.titleDe : hol.titleEn}`,
              location: state.holidayState,
              description: '',
              allDay: true,
              startDate: hol.date,
              endDate: hol.date,
              startTime: '00:00',
              endTime: '23:59',
              color: 'amber',
              isRecurring: false,
              kind: 'holiday',
            });
          }
        }
      }
    }

    // Tasks overlay
    if (state.showTasksOverlay) {
      for (const tk of taskOverlayItems) {
        if (tk.dueDate >= startStr && tk.dueDate <= endStr) {
          const hasTime = Boolean(tk.dueTime);
          const st = tk.dueTime || '09:00';
          const [hr, mn] = st.split(':').map((n) => Number.parseInt(n, 10));
          const endHr = String(Math.min(23, (hr || 9) + 1)).padStart(2, '0');
          list.push({
            occurrenceId: `task:${tk.id}`,
            eventId: `task:${tk.id}`,
            occurrenceDate: tk.dueDate,
            calendarId: 'tasks',
            title: `☑ ${tk.title}`,
            location: '',
            description: '',
            allDay: !hasTime,
            startDate: tk.dueDate,
            endDate: tk.dueDate,
            startTime: st,
            endTime: `${endHr}:${String(mn || 0).padStart(2, '0')}`,
            color: 'rose',
            isRecurring: false,
            kind: 'task',
          });
        }
      }
    }

    // Timetable overlay
    if (state.showTimetableOverlay && timetableOverlayItems.length) {
      let cur = parseLocalDate(startStr);
      const endD = parseLocalDate(endStr);
      while (cur <= endD) {
        const dStr = formatLocalDate(cur);
        const dow = cur.getDay();
        for (const slot of timetableOverlayItems) {
          if (slot.dayOfWeek === dow) {
            list.push({
              occurrenceId: `tt:${slot.id}@${dStr}`,
              eventId: `tt:${slot.id}`,
              occurrenceDate: dStr,
              calendarId: 'timetable',
              title: `🎓 ${slot.title}`,
              location: slot.room || '',
              description: '',
              allDay: false,
              startDate: dStr,
              endDate: dStr,
              startTime: slot.startTime || '08:00',
              endTime: slot.endTime || '09:30',
              color: 'blue',
              isRecurring: true,
              kind: 'timetable',
            });
          }
        }
        cur = addDays(cur, 1);
      }
    }

    const q = state.searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.location.toLowerCase().includes(q) ||
            o.description.toLowerCase().includes(q),
        )
      : list;

    return filtered.sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startTime.localeCompare(b.startTime);
    });
  }

  // DOM skeleton
  const sidebarEl = h('aside', { class: 'nx-cal-sidebar' });
  const mainEl = h('main', { class: 'nx-cal-main' });
  const inspectorEl = h('aside', { class: 'nx-cal-inspector' });
  const rootEl = h('div', { class: 'nx-cal' }, sidebarEl, mainEl);
  container.append(rootEl);

  function selectOccurrence(/** @type {ExpandedOccurrence | null} */ occ) {
    state.selectedOccurrence = occ;
    if (occ && occ.kind === 'event') {
      rootEl.classList.add('has-inspector');
      if (!inspectorEl.parentElement) rootEl.append(inspectorEl);
      renderInspector();
    } else {
      rootEl.classList.remove('has-inspector');
      inspectorEl.remove();
    }
  }

  /**
   * Creates a new event and opens it in the inspector.
   * @param {Partial<CalendarEvent>} [defaults]
   */
  async function createAndSelectEvent(defaults = {}) {
    const now = Date.now();
    const defaultCal = calendars.find((c) => c.visible)?.id ?? 'personal';
    const startDate = defaults.startDate ?? state.cursorDate;
    /** @type {CalendarEvent} */
    const ev = {
      id: crypto.randomUUID(),
      calendarId: defaults.calendarId ?? defaultCal,
      title: defaults.title ?? (ctx.i18n.locale === 'de' ? 'Neuer Termin' : 'New Event'),
      location: defaults.location ?? '',
      description: defaults.description ?? '',
      allDay: defaults.allDay ?? false,
      startDate,
      endDate: defaults.endDate ?? startDate,
      startTime: defaults.startTime ?? '09:00',
      endTime: defaults.endTime ?? '10:00',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
      recurrence: defaults.recurrence ?? null,
      exdates: [],
      overrides: {},
      reminders: [15],
      createdAt: now,
      updatedAt: now,
    };
    await eventsCol.put(ev);
    events.push(ev);
    await syncEventReminders(ev);
    renderMain();
    const occs = expandEventsInRange([ev], ev.startDate, ev.endDate);
    if (occs[0]) selectOccurrence(occs[0]);
  }

  function renderMiniMonth() {
    const cur = parseLocalDate(state.miniMonthDate);
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const monthLabel = cur.toLocaleDateString(ctx.i18n.locale === 'de' ? 'de-DE' : 'en-US', {
      month: 'short',
      year: 'numeric',
    });

    const firstOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
    const gridStart = startOfWeek(firstOfMonth, state.weekStart);
    const todayStr = formatLocalDate(new Date());

    const dowLabels =
      state.weekStart === 1
        ? ctx.i18n.locale === 'de'
          ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
          : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
        : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const cells = [];
    for (const dl of dowLabels) {
      cells.push(h('div', { class: 'nx-cal-mini-dow', text: dl }));
    }

    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const dStr = formatLocalDate(d);
      const isOutside = d.getMonth() !== month;
      const isToday = dStr === todayStr;
      const isSelected = dStr === state.cursorDate;
      cells.push(
        h('button', {
          type: 'button',
          class: `nx-cal-mini-day${isOutside ? ' is-outside' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`,
          text: String(d.getDate()),
          onclick: () => {
            state.cursorDate = dStr;
            state.miniMonthDate = dStr;
            renderSidebar();
            renderMain();
          },
        }),
      );
    }

    return h(
      'div',
      { class: 'nx-cal-mini' },
      h(
        'div',
        { class: 'nx-cal-mini-head' },
        iconButton({
          icon: 'chevronLeft',
          label: 'Previous month',
          onClick: () => {
            const prev = new Date(year, month - 1, 1, 12, 0, 0, 0);
            state.miniMonthDate = formatLocalDate(prev);
            renderSidebar();
          },
        }),
        h('span', { text: monthLabel }),
        iconButton({
          icon: 'chevronRight',
          label: 'Next month',
          onClick: () => {
            const next = new Date(year, month + 1, 1, 12, 0, 0, 0);
            state.miniMonthDate = formatLocalDate(next);
            renderSidebar();
          },
        }),
      ),
      h('div', { class: 'nx-cal-mini-grid' }, ...cells),
    );
  }

  function renderSidebar() {
    const stateSelect = /** @type {HTMLSelectElement} */ (
      h(
        'select',
        {
          class: 'nx-select',
          'aria-label': t('holidayState'),
          onchange: () => {
            state.holidayState = stateSelect.value;
            void ctx.settings.set('holidayState', state.holidayState);
            renderMain();
          },
        },
        ...['HE', 'BW', 'BY', 'BE', 'NW', 'HH', 'SN'].map((code) =>
          h('option', { value: code, selected: state.holidayState === code, text: code }),
        ),
      )
    );

    replace(
      sidebarEl,
      button({
        label: t('newEvent'),
        icon: 'plus',
        variant: 'primary',
        onClick: () => void createAndSelectEvent(),
      }),
      renderMiniMonth(),
      h(
        'div',
        { class: 'nx-cal-section-head' },
        h('span', { text: t('calendars') }),
        iconButton({
          icon: 'plus',
          label: t('newCalendar'),
          onClick: async () => {
            const name = await ctx.dialog.prompt(t('calendarNamePrompt'), '', { title: t('newCalendar') });
            if (!name || !name.trim()) return;
            /** @type {CalendarSource} */
            const cal = {
              id: crypto.randomUUID(),
              name: name.trim(),
              color: CALENDAR_COLORS[calendars.length % CALENDAR_COLORS.length],
              visible: true,
            };
            await calendarsCol.put(cal);
            calendars.push(cal);
            renderSidebar();
            renderMain();
          },
        }),
      ),
      h(
        'div',
        { class: 'nx-cal-source-list' },
        ...calendars.map((cal) =>
          h(
            'label',
            { class: 'nx-cal-source-item' },
            h('input', {
              type: 'checkbox',
              checked: cal.visible,
              onchange: async () => {
                cal.visible = !cal.visible;
                await calendarsCol.put(cal);
                renderMain();
              },
            }),
            h('span', { class: 'nx-cal-dot', dataset: { color: cal.color } }),
            h('span', { text: cal.name }),
          ),
        ),
      ),
      h('div', { class: 'nx-cal-section-head' }, h('span', { text: t('overlays') })),
      h(
        'div',
        { class: 'nx-cal-source-list' },
        h(
          'label',
          { class: 'nx-cal-source-item' },
          h('input', {
            type: 'checkbox',
            checked: state.showTasksOverlay,
            onchange: () => {
              state.showTasksOverlay = !state.showTasksOverlay;
              renderMain();
            },
          }),
          h('span', { class: 'nx-cal-dot', dataset: { color: 'rose' } }),
          h('span', { text: t('overlayTasks') }),
        ),
        h(
          'label',
          { class: 'nx-cal-source-item' },
          h('input', {
            type: 'checkbox',
            checked: state.showTimetableOverlay,
            onchange: () => {
              state.showTimetableOverlay = !state.showTimetableOverlay;
              renderMain();
            },
          }),
          h('span', { class: 'nx-cal-dot', dataset: { color: 'blue' } }),
          h('span', { text: t('overlayTimetable') }),
        ),
        h(
          'label',
          { class: 'nx-cal-source-item' },
          h('input', {
            type: 'checkbox',
            checked: state.showHolidaysOverlay,
            onchange: () => {
              state.showHolidaysOverlay = !state.showHolidaysOverlay;
              renderMain();
            },
          }),
          h('span', { class: 'nx-cal-dot', dataset: { color: 'amber' } }),
          h('span', { text: t('overlayHolidays') }),
        ),
        stateSelect,
      ),
      h(
        'div',
        { class: 'nx-cal-source-list' },
        button({
          label: t('importICS'),
          icon: 'upload',
          onClick: () => void handleImportICS(),
        }),
        button({
          label: t('exportICS'),
          icon: 'download',
          onClick: () => void handleExportICS(),
        }),
        button({
          label: t('print'),
          icon: 'file',
          onClick: () => globalThis.print?.(),
        }),
      ),
    );
  }

  async function handleImportICS() {
    const path = await ctx.dialog.openFile({
      title: t('importICS'),
      startPath: joinPath(String(ctx.fs.home), 'Documents'),
      extensions: ['.ics'],
    });
    if (!path) return;
    const text = await ctx.fs.readText(path);
    const imported = parseICS(text, 'personal');
    for (const ev of imported) {
      await eventsCol.put(ev);
      events.push(ev);
    }
    ctx.notify({ title: t('appTitle'), body: t('importedCount', { count: imported.length }) });
    renderMain();
  }

  async function handleExportICS() {
    const icsText = serializeICS(events);
    const savePath = await ctx.dialog.saveFile({
      title: t('exportICS'),
      startPath: joinPath(String(ctx.fs.home), 'Documents'),
      defaultName: 'nexus-calendar.ics',
    });
    if (savePath) {
      await ctx.fs.writeFile(savePath, icsText, { createParents: true });
    }
    ctx.fs.downloadBlob(new Blob([icsText], { type: 'text/calendar;charset=utf-8' }), 'nexus-calendar.ics');
  }

  function stepPeriod(/** @type {number} */ dir) {
    const cur = parseLocalDate(state.cursorDate);
    if (state.view === 'day') {
      state.cursorDate = formatLocalDate(addDays(cur, dir));
    } else if (state.view === 'week' || state.view === 'agenda') {
      state.cursorDate = formatLocalDate(addDays(cur, dir * 7));
    } else if (state.view === 'month') {
      state.cursorDate = formatLocalDate(new Date(cur.getFullYear(), cur.getMonth() + dir, 1, 12, 0, 0, 0));
    } else if (state.view === 'year') {
      state.cursorDate = formatLocalDate(new Date(cur.getFullYear() + dir, cur.getMonth(), 1, 12, 0, 0, 0));
    }
    state.miniMonthDate = state.cursorDate;
    renderSidebar();
    renderMain();
  }

  function renderMain() {
    const cur = parseLocalDate(state.cursorDate);
    const locale = ctx.i18n.locale === 'de' ? 'de-DE' : 'en-US';
    const periodLabel =
      state.view === 'year'
        ? String(cur.getFullYear())
        : state.view === 'day'
          ? cur.toLocaleDateString(locale, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
          : cur.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const isoWeek = getISOWeekNumber(cur);

    const quickInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input nx-cal-quick-input',
        type: 'text',
        placeholder: t('quickAddPlaceholder'),
        onkeydown: (e) => {
          if (e.key === 'Enter' && quickInput.value.trim()) {
            e.preventDefault();
            const parsed = parseEventQuickAdd(quickInput.value.trim(), cur);
            quickInput.value = '';
            void createAndSelectEvent(parsed);
          }
        },
      })
    );

    const searchInput = /** @type {HTMLInputElement} */ (
      h('input', {
        class: 'nx-input',
        type: 'search',
        placeholder: t('searchPlaceholder'),
        value: state.searchQuery,
        oninput: () => {
          state.searchQuery = searchInput.value;
          renderViewBody(bodyEl);
        },
      })
    );

    const headerEl = h(
      'header',
      { class: 'nx-cal-header' },
      h(
        'div',
        { class: 'nx-cal-toolbar' },
        h(
          'div',
          { class: 'nx-cal-nav-row' },
          iconButton({ icon: 'chevronLeft', label: 'Previous', onClick: () => stepPeriod(-1) }),
          button({
            label: t('today'),
            onClick: () => {
              state.cursorDate = formatLocalDate(new Date());
              state.miniMonthDate = state.cursorDate;
              renderSidebar();
              renderMain();
            },
          }),
          iconButton({ icon: 'chevronRight', label: 'Next', onClick: () => stepPeriod(1) }),
          h('span', { class: 'nx-cal-period-title', text: periodLabel }),
          h('span', { class: 'nx-cal-week-badge', text: `${t('weekPrefix')} ${isoWeek}` }),
        ),
        h(
          'div',
          { class: 'nx-cal-nav-row' },
          searchInput,
          h(
            'div',
            { class: 'nx-btn-group', role: 'group' },
            .../** @type {const} */ (['day', 'week', 'month', 'year', 'agenda']).map((v) =>
              h('button', {
                type: 'button',
                class: `nx-btn${state.view === v ? ' is-primary' : ''}`,
                text: t(`view${v.charAt(0).toUpperCase()}${v.slice(1)}`),
                onclick: () => {
                  state.view = v;
                  renderMain();
                },
              }),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'nx-cal-quickbar' },
        quickInput,
        button({
          label: t('add'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => {
            if (!quickInput.value.trim()) {
              void createAndSelectEvent();
              return;
            }
            const parsed = parseEventQuickAdd(quickInput.value.trim(), cur);
            quickInput.value = '';
            void createAndSelectEvent(parsed);
          },
        }),
      ),
    );

    const bodyEl = h('div', { class: 'nx-cal-body' });
    renderViewBody(bodyEl);
    replace(mainEl, headerEl, bodyEl);
  }

  function renderViewBody(/** @type {HTMLElement} */ bodyEl) {
    if (state.view === 'month') {
      replace(bodyEl, renderMonthView());
    } else if (state.view === 'week') {
      replace(bodyEl, renderTimeGridView(7));
    } else if (state.view === 'day') {
      replace(bodyEl, renderTimeGridView(1));
    } else if (state.view === 'year') {
      replace(bodyEl, renderYearView());
    } else {
      replace(bodyEl, renderAgendaView());
    }
  }

  function renderMonthView() {
    const cur = parseLocalDate(state.cursorDate);
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const firstOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
    const gridStart = startOfWeek(firstOfMonth, state.weekStart);
    const gridEnd = addDays(gridStart, 41);
    const occs = getOccurrencesInRange(formatLocalDate(gridStart), formatLocalDate(gridEnd));
    const todayStr = formatLocalDate(new Date());

    const dowNames =
      state.weekStart === 1
        ? ctx.i18n.locale === 'de'
          ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
          : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const dStr = formatLocalDate(d);
      const dayOccs = occs.filter((o) => o.startDate <= dStr && o.endDate >= dStr);
      cells.push(
        h(
          'div',
          {
            class: `nx-cal-day-cell${d.getMonth() !== month ? ' is-outside' : ''}${dStr === todayStr ? ' is-today' : ''}`,
            dataset: { date: dStr },
            onclick: (e) => {
              if (e.target === e.currentTarget) {
                state.cursorDate = dStr;
                void createAndSelectEvent({ startDate: dStr, endDate: dStr });
              }
            },
          },
          h('div', { class: 'nx-cal-day-num' }, h('span', { text: String(d.getDate()) })),
          ...dayOccs.slice(0, 4).map((o) =>
            h('div', {
              class: 'nx-cal-pill',
              dataset: { color: o.color },
              text: `${o.allDay ? '' : `${o.startTime} `}${o.title}`,
              onclick: (e) => {
                e.stopPropagation();
                selectOccurrence(o);
              },
            }),
          ),
        ),
      );
    }

    return h(
      'div',
      { class: 'nx-cal-month' },
      h('div', { class: 'nx-cal-month-dow' }, ...dowNames.map((n) => h('div', { text: n }))),
      h('div', { class: 'nx-cal-month-grid' }, ...cells),
    );
  }

  /**
   * Renders the Day (`numDays = 1`) or Week (`numDays = 7`) 24-hour time grid with pointer drag-to-create,
   * drag-to-move, and drag-edge-to-resize.
   * @param {1 | 7} numDays
   */
  function renderTimeGridView(numDays) {
    const cur = parseLocalDate(state.cursorDate);
    const startD = numDays === 7 ? startOfWeek(cur, state.weekStart) : cur;
    const days = Array.from({ length: numDays }, (_, i) => addDays(startD, i));
    const startStr = formatLocalDate(days[0]);
    const endStr = formatLocalDate(days[days.length - 1]);
    const occs = getOccurrencesInRange(startStr, endStr);
    const todayStr = formatLocalDate(new Date());
    const locale = ctx.i18n.locale === 'de' ? 'de-DE' : 'en-US';
    const colTemplate = `56px repeat(${numDays}, 1fr)`;

    const headEl = h(
      'div',
      { class: 'nx-cal-timegrid-head', style: { gridTemplateColumns: colTemplate } },
      h('div'),
      ...days.map((d) => {
        const dStr = formatLocalDate(d);
        return h(
          'div',
          {
            style: {
              padding: '6px 8px',
              textAlign: 'center',
              fontWeight: dStr === todayStr ? '700' : '500',
              color: dStr === todayStr ? 'var(--nx-accent, #38bdf8)' : 'inherit',
            },
          },
          d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
        );
      }),
    );

    const allDayEl = h(
      'div',
      { class: 'nx-cal-timegrid-allday', style: { gridTemplateColumns: colTemplate } },
      h('div', { style: { fontSize: '10px', padding: '4px', textAlign: 'right', opacity: '0.6' }, text: t('allDay') }),
      ...days.map((d) => {
        const dStr = formatLocalDate(d);
        const allDayOccs = occs.filter((o) => o.allDay && o.startDate <= dStr && o.endDate >= dStr);
        return h(
          'div',
          { class: 'nx-cal-timegrid-allday-cell' },
          ...allDayOccs.map((o) =>
            h('div', {
              class: 'nx-cal-pill',
              dataset: { color: o.color },
              text: o.title,
              onclick: () => selectOccurrence(o),
            }),
          ),
        );
      }),
    );

    const gutterEl = h(
      'div',
      { class: 'nx-cal-gutter' },
      ...Array.from({ length: 24 }, (_, hr) =>
        h('div', { class: 'nx-cal-hour-label', text: `${String(hr).padStart(2, '0')}:00` }),
      ),
    );

    const dayColumns = days.map((d) => {
      const dStr = formatLocalDate(d);
      const timedOccs = occs.filter((o) => !o.allDay && o.startDate === dStr);

      const colEl = h('div', { class: 'nx-cal-day-col', dataset: { date: dStr } });

      // Pointer drag on empty column space to create a timed event
      colEl.addEventListener('pointerdown', (e) => {
        if (e.target !== colEl || e.button !== 0) return;
        const rect = colEl.getBoundingClientRect();
        const startY = Math.max(0, Math.min(1152, e.clientY - rect.top));
        const startQuarter = Math.floor(startY / 12); // 12px = 15 min
        let endQuarter = startQuarter + 4; // default 1 hour

        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          const sMin = Math.min(startQuarter, endQuarter) * 15;
          const eMin = Math.max(sMin + 30, Math.max(startQuarter, endQuarter) * 15);
          const sTime = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
          const eTime = `${String(Math.min(23, Math.floor(eMin / 60))).padStart(2, '0')}:${String(eMin % 60).padStart(2, '0')}`;
          void createAndSelectEvent({
            startDate: dStr,
            endDate: dStr,
            startTime: sTime,
            endTime: eTime,
            allDay: false,
          });
        };
        const onMove = (/** @type {PointerEvent} */ me) => {
          const curY = Math.max(0, Math.min(1152, me.clientY - rect.top));
          endQuarter = Math.max(startQuarter + 1, Math.round(curY / 12));
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      for (const occ of timedOccs) {
        const [sh, sm] = (occ.startTime || '09:00').split(':').map((n) => Number.parseInt(n, 10));
        const [eh, em] = (occ.endTime || '10:00').split(':').map((n) => Number.parseInt(n, 10));
        const startMins = (sh || 0) * 60 + (sm || 0);
        const endMins = Math.max(startMins + 30, (eh || 0) * 60 + (em || 0));
        const topPx = (startMins / 60) * 48;
        const heightPx = Math.max(22, ((endMins - startMins) / 60) * 48);

        const resizeHandle = h('div', { class: 'nx-cal-resize-handle' });
        const cardEl = h(
          'div',
          {
            class: 'nx-cal-timed-event',
            dataset: { color: occ.color, eventId: occ.eventId },
            style: { top: `${topPx}px`, height: `${heightPx}px` },
            onclick: (e) => {
              e.stopPropagation();
              selectOccurrence(occ);
            },
          },
          h('div', { class: 'nx-cal-timed-event-title', text: occ.title }),
          h('div', { class: 'nx-cal-timed-event-time', text: `${occ.startTime} – ${occ.endTime}` }),
          occ.kind === 'event' ? resizeHandle : null,
        );

        if (occ.kind === 'event' && occ.rawEvent) {
          // Drag bottom edge to resize duration
          resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            const startClientY = e.clientY;
            const origDurationMins = endMins - startMins;
            let newEndMins = endMins;
            const onMove = (/** @type {PointerEvent} */ me) => {
              const deltaMins = Math.round((((me.clientY - startClientY) / 48) * 60) / 15) * 15;
              newEndMins = Math.min(23 * 60 + 45, Math.max(startMins + 15, startMins + origDurationMins + deltaMins));
              cardEl.style.height = `${Math.max(22, ((newEndMins - startMins) / 60) * 48)}px`;
            };
            const onUp = async () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              const endTimeStr = `${String(Math.floor(newEndMins / 60)).padStart(2, '0')}:${String(newEndMins % 60).padStart(2, '0')}`;
              const rawEv = /** @type {CalendarEvent} */ (occ.rawEvent);
              const { updated } = applyRecurringEdit(rawEv, occ.occurrenceDate, { endTime: endTimeStr }, 'this');
              await eventsCol.put(updated);
              events = events.map((ev) => (ev.id === updated.id ? updated : ev));
              renderMain();
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          });

          // Drag event card to move start/end time
          cardEl.addEventListener('pointerdown', (e) => {
            if (e.target === resizeHandle || e.button !== 0) return;
            e.stopPropagation();
            const startClientY = e.clientY;
            const durationMins = endMins - startMins;
            let movedStartMins = startMins;
            let didMove = false;
            const onMove = (/** @type {PointerEvent} */ me) => {
              if (Math.abs(me.clientY - startClientY) > 4) didMove = true;
              const deltaMins = Math.round((((me.clientY - startClientY) / 48) * 60) / 15) * 15;
              movedStartMins = Math.max(0, Math.min(24 * 60 - durationMins, startMins + deltaMins));
              cardEl.style.top = `${(movedStartMins / 60) * 48}px`;
            };
            const onUp = async () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              if (!didMove) return;
              const newEndMins = movedStartMins + durationMins;
              const sStr = `${String(Math.floor(movedStartMins / 60)).padStart(2, '0')}:${String(movedStartMins % 60).padStart(2, '0')}`;
              const eStr = `${String(Math.floor(newEndMins / 60)).padStart(2, '0')}:${String(newEndMins % 60).padStart(2, '0')}`;
              const rawEv = /** @type {CalendarEvent} */ (occ.rawEvent);
              const { updated } = applyRecurringEdit(
                rawEv,
                occ.occurrenceDate,
                { startTime: sStr, endTime: eStr },
                'this',
              );
              await eventsCol.put(updated);
              events = events.map((ev) => (ev.id === updated.id ? updated : ev));
              renderMain();
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          });
        }

        colEl.append(cardEl);
      }

      return colEl;
    });

    const gridBodyEl = h(
      'div',
      { class: 'nx-cal-timegrid-body', style: { gridTemplateColumns: colTemplate } },
      gutterEl,
      ...dayColumns,
    );
    const scrollEl = h('div', { class: 'nx-cal-timegrid-scroll' }, gridBodyEl);
    queueMicrotask(() => {
      scrollEl.scrollTop = 8 * 48; // Scroll to 08:00 by default
    });

    return h('div', { class: 'nx-cal-timegrid-wrap' }, headEl, allDayEl, scrollEl);
  }

  function renderYearView() {
    const year = parseLocalDate(state.cursorDate).getFullYear();
    const locale = ctx.i18n.locale === 'de' ? 'de-DE' : 'en-US';
    const months = [];

    for (let m = 0; m < 12; m++) {
      const first = new Date(year, m, 1, 12, 0, 0, 0);
      const gridStart = startOfWeek(first, state.weekStart);
      const mLabel = first.toLocaleDateString(locale, { month: 'long' });
      const dayButtons = [];
      for (let i = 0; i < 42; i++) {
        const d = addDays(gridStart, i);
        const dStr = formatLocalDate(d);
        dayButtons.push(
          h('button', {
            type: 'button',
            class: `nx-cal-mini-day${d.getMonth() !== m ? ' is-outside' : ''}`,
            text: String(d.getDate()),
            onclick: () => {
              state.cursorDate = dStr;
              state.view = 'day';
              renderMain();
            },
          }),
        );
      }
      months.push(
        h(
          'div',
          { class: 'nx-cal-mini' },
          h('div', { class: 'nx-cal-mini-head' }, h('span', { text: mLabel })),
          h('div', { class: 'nx-cal-mini-grid' }, ...dayButtons),
        ),
      );
    }

    return h('div', { class: 'nx-cal-year-grid' }, ...months);
  }

  function renderAgendaView() {
    const startStr = state.cursorDate;
    const endStr = formatLocalDate(addDays(parseLocalDate(startStr), 60));
    const occs = getOccurrencesInRange(startStr, endStr);
    if (!occs.length) {
      return h('div', { class: 'nx-cal-agenda' }, h('p', { text: t('noEvents') }));
    }

    /** @type {Map<string, ExpandedOccurrence[]>} */
    const byDate = new Map();
    for (const o of occs) {
      const arr = byDate.get(o.startDate) ?? [];
      arr.push(o);
      byDate.set(o.startDate, arr);
    }

    const locale = ctx.i18n.locale === 'de' ? 'de-DE' : 'en-US';
    const groups = [];
    for (const [dStr, items] of byDate.entries()) {
      const label = parseLocalDate(dStr).toLocaleDateString(locale, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      groups.push(
        h(
          'div',
          { class: 'nx-cal-agenda-day' },
          h('div', { class: 'nx-cal-agenda-day-head', text: label }),
          ...items.map((o) =>
            h(
              'div',
              {
                class: 'nx-cal-agenda-row',
                onclick: () => selectOccurrence(o),
              },
              h('span', { class: 'nx-cal-dot', dataset: { color: o.color } }),
              h('span', {
                style: { width: '96px', fontSize: '12px', opacity: '0.8' },
                text: o.allDay ? t('allDay') : `${o.startTime} – ${o.endTime}`,
              }),
              h('strong', { style: { flex: '1' }, text: o.title }),
              o.location ? h('span', { style: { fontSize: '12px', opacity: '0.7' }, text: `📍 ${o.location}` }) : null,
            ),
          ),
        ),
      );
    }

    return h('div', { class: 'nx-cal-agenda' }, ...groups);
  }

  function renderInspector() {
    const occ = state.selectedOccurrence;
    if (!occ || occ.kind !== 'event' || !occ.rawEvent) return;
    const rawEv = occ.rawEvent;

    const titleInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'text', value: occ.title, 'aria-label': t('eventTitle') })
    );
    const calSelect = /** @type {HTMLSelectElement} */ (
      h(
        'select',
        { class: 'nx-select' },
        ...calendars.map((c) => h('option', { value: c.id, selected: c.id === occ.calendarId, text: c.name })),
      )
    );
    const allDayCheck = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: occ.allDay }));
    const startDateInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'date', value: occ.startDate })
    );
    const endDateInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'date', value: occ.endDate })
    );
    const startTimeInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'time', value: occ.startTime })
    );
    const endTimeInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'time', value: occ.endTime })
    );
    const locInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'text', value: occ.location })
    );
    const descArea = /** @type {HTMLTextAreaElement} */ (
      h('textarea', { class: 'nx-textarea', rows: 3, value: occ.description })
    );
    const recSelect = /** @type {HTMLSelectElement} */ (
      h(
        'select',
        { class: 'nx-select' },
        h('option', { value: 'none', selected: !rawEv.recurrence, text: t('recNone') }),
        h('option', { value: 'daily', selected: rawEv.recurrence?.freq === 'daily', text: t('recDaily') }),
        h('option', { value: 'weekly', selected: rawEv.recurrence?.freq === 'weekly', text: t('recWeekly') }),
        h('option', { value: 'monthly', selected: rawEv.recurrence?.freq === 'monthly', text: t('recMonthly') }),
        h('option', { value: 'yearly', selected: rawEv.recurrence?.freq === 'yearly', text: t('recYearly') }),
      )
    );
    const untilInput = /** @type {HTMLInputElement} */ (
      h('input', { class: 'nx-input', type: 'date', value: rawEv.recurrence?.until ?? '' })
    );

    const scopeSelect = /** @type {HTMLSelectElement} */ (
      h(
        'select',
        { class: 'nx-select' },
        h('option', { value: 'all', text: t('scopeAll') }),
        h('option', { value: 'this', text: t('scopeThis') }),
        h('option', { value: 'following', text: t('scopeFollowing') }),
      )
    );

    let reminders = [...(rawEv.reminders ?? [])];
    const remListEl = h('div', { class: 'nx-cal-reminders-list' });
    const remAddSelect = /** @type {HTMLSelectElement} */ (
      h(
        'select',
        { class: 'nx-select' },
        h('option', { value: '5', text: t('rem5') }),
        h('option', { value: '15', selected: true, text: t('rem15') }),
        h('option', { value: '30', text: t('rem30') }),
        h('option', { value: '60', text: t('rem60') }),
        h('option', { value: '1440', text: t('rem1440') }),
      )
    );

    function renderRemindersList() {
      replace(
        remListEl,
        ...reminders.map((m) =>
          h(
            'div',
            { class: 'nx-cal-reminder-chip' },
            h('span', { text: `${m} min` }),
            iconButton({
              icon: 'x',
              label: 'Remove',
              onClick: () => {
                reminders = reminders.filter((x) => x !== m);
                renderRemindersList();
              },
            }),
          ),
        ),
      );
    }
    renderRemindersList();

    replace(
      inspectorEl,
      h(
        'div',
        { class: 'nx-cal-inspector-head' },
        h('strong', { text: t('eventTitle') }),
        iconButton({ icon: 'x', label: t('close'), onClick: () => selectOccurrence(null) }),
      ),
      titleInput,
      h('label', { class: 'nx-field' }, h('span', { text: t('calendar') }), calSelect),
      h('label', { class: 'nx-cal-source-item' }, allDayCheck, h('span', { text: t('allDay') })),
      h(
        'div',
        { class: 'nx-cal-field-row' },
        h('label', { class: 'nx-field' }, h('span', { text: t('startDate') }), startDateInput),
        h('label', { class: 'nx-field' }, h('span', { text: t('endDate') }), endDateInput),
      ),
      h(
        'div',
        { class: 'nx-cal-field-row' },
        h('label', { class: 'nx-field' }, h('span', { text: t('startTime') }), startTimeInput),
        h('label', { class: 'nx-field' }, h('span', { text: t('endTime') }), endTimeInput),
      ),
      h('label', { class: 'nx-field' }, h('span', { text: t('location') }), locInput),
      h('label', { class: 'nx-field' }, h('span', { text: t('description') }), descArea),
      h('label', { class: 'nx-field' }, h('span', { text: t('recurrence') }), recSelect),
      h('label', { class: 'nx-field' }, h('span', { text: t('recUntil') }), untilInput),
      h(
        'div',
        { class: 'nx-field' },
        h('span', { text: t('reminders') }),
        remListEl,
        h(
          'div',
          { class: 'nx-cal-field-row' },
          remAddSelect,
          button({
            label: t('addReminder'),
            icon: 'plus',
            onClick: () => {
              const val = Number.parseInt(remAddSelect.value, 10);
              if (!reminders.includes(val)) {
                reminders.push(val);
                renderRemindersList();
              }
            },
          }),
        ),
      ),
      rawEv.recurrence
        ? h('label', { class: 'nx-field' }, h('span', { text: t('editScopeLabel') }), scopeSelect)
        : null,
      h(
        'div',
        { class: 'nx-cal-field-row' },
        button({
          label: t('save'),
          icon: 'check',
          variant: 'primary',
          onClick: async () => {
            const recVal = recSelect.value;
            const recurrence =
              recVal === 'none'
                ? null
                : {
                    freq: /** @type {'daily' | 'weekly' | 'monthly' | 'yearly'} */ (recVal),
                    interval: 1,
                    ...(untilInput.value ? { until: untilInput.value } : {}),
                  };
            const patch = {
              title: titleInput.value.trim() || 'Untitled',
              calendarId: calSelect.value,
              allDay: allDayCheck.checked,
              startDate: startDateInput.value || occ.startDate,
              endDate: endDateInput.value || startDateInput.value || occ.endDate,
              startTime: startTimeInput.value || '09:00',
              endTime: endTimeInput.value || '10:00',
              location: locInput.value.trim(),
              description: descArea.value,
              recurrence,
              reminders,
            };
            const scope = /** @type {'this' | 'following' | 'all'} */ (rawEv.recurrence ? scopeSelect.value : 'all');
            const { updated, created } = applyRecurringEdit(rawEv, occ.occurrenceDate, patch, scope);
            await eventsCol.put(updated);
            events = events.map((e) => (e.id === updated.id ? updated : e));
            if (created) {
              await eventsCol.put(created);
              events.push(created);
            }
            await syncEventReminders(updated);
            selectOccurrence(null);
            renderMain();
          },
        }),
        button({
          label: t('delete'),
          icon: 'trash',
          variant: 'danger',
          onClick: async () => {
            const scope = /** @type {'this' | 'following' | 'all'} */ (rawEv.recurrence ? scopeSelect.value : 'all');
            if (!rawEv.recurrence || scope === 'all') {
              await eventsCol.delete(rawEv.id);
              events = events.filter((e) => e.id !== rawEv.id);
            } else {
              const updated = deleteRecurringOccurrence(rawEv, occ.occurrenceDate, scope);
              await eventsCol.put(updated);
              events = events.map((e) => (e.id === updated.id ? updated : e));
            }
            selectOccurrence(null);
            renderMain();
          },
        }),
      ),
    );
  }

  // Watch tasks & timetable snapshots in VFS so overlays update live
  ctx.fs.watch(joinPath(String(ctx.fs.home), '.config'), async () => {
    await loadExternalOverlays();
    renderMain();
  });

  ctx.settings.onChange('weekStart', (val) => {
    state.weekStart = val === 'sunday' ? 0 : 1;
    renderSidebar();
    renderMain();
  });

  await loadData();
  renderSidebar();
  renderMain();

  if (args.createNew) {
    await createAndSelectEvent();
  } else if (args.selectEventId) {
    const found = events.find((e) => e.id === args.selectEventId);
    if (found) {
      const occs = expandEventsInRange([found], found.startDate, found.endDate);
      if (occs[0]) selectOccurrence(occs[0]);
    }
  }

  return {
    serializeState: () => ({
      view: state.view,
      cursorDate: state.cursorDate,
      miniMonthDate: state.miniMonthDate,
      searchQuery: state.searchQuery,
      showTasksOverlay: state.showTasksOverlay,
      showTimetableOverlay: state.showTimetableOverlay,
      showHolidaysOverlay: state.showHolidaysOverlay,
    }),
  };
}
