// @ts-check
// Nexus Timetable: weekly course grid, biweekly A/B weeks, semester periods,
// Now & Next cards, calendar sync via ~/.config/timetable-snapshot.json, study links.
import { button, h, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { joinPath } from '../../ui/paths.js';
import {
  computeNowAndNext,
  COURSE_COLORS,
  COURSE_TYPES,
  exportTimetableToICS,
  exportTimetableToJSON,
  getBiweeklyWeekType,
  timeToMinutes,
} from './model.js';
import './styles.css';

/** @typedef {import('./model.js').Course} Course */
/** @typedef {import('./model.js').Semester} Semester */
/** @typedef {import('./model.js').AttendanceRecord} AttendanceRecord */

const DAY_LABELS = ['mon', 'tue', 'wed', 'thu', 'fri'];

/**
 * Writes shared snapshot so Calendar displays Timetable courses as an overlay layer.
 * @param {import('../../kernel/types').VFS} fs
 * @param {Course[]} courses
 */
async function writeTimetableSnapshot(fs, courses) {
  try {
    const snapPath = joinPath(String(fs.home), '.config/timetable-snapshot.json');
    const payload = {
      updatedAt: Date.now(),
      slots: courses.map((c) => ({
        id: c.id,
        title: c.name,
        dayOfWeek: c.dayOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
        room: c.room,
        color: c.color,
      })),
    };
    await fs.writeFile(snapPath, JSON.stringify(payload), { createParents: true });
  } catch {
    // Ignore errors in tests/bare host
  }
}

/**
 * Terminal command handler: `timetable [next | today | list]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async timetable(ctx, io) {
    const coursesCol = /** @type {import('../../kernel/types').Collection<Course>} */ (
      ctx.storage.collection('courses')
    );
    const courses = await coursesCol.all();
    const sub = io.args[0] ?? 'next';

    if (sub === 'next') {
      const { current, next, minutesToNext } = computeNowAndNext(courses, new Date());
      if (current) {
        io.out(`Now: ${current.name} (${current.startTime}-${current.endTime}) in ${current.room || 'TBD'}\n`);
      }
      if (next) {
        io.out(
          `Next: ${next.name} (${next.startTime}-${next.endTime}) in ${next.room || 'TBD'} [in ${minutesToNext}m]\n`,
        );
      }
      if (!current && !next) {
        io.out('No courses scheduled right now or upcoming today.\n');
      }
      return 0;
    }

    if (sub === 'today') {
      const dow = new Date().getDay();
      const todayCourses = courses
        .filter((c) => c.dayOfWeek === dow)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      if (!todayCourses.length) {
        io.out('No courses today!\n');
        return 0;
      }
      for (const c of todayCourses) {
        io.out(`[${c.startTime}-${c.endTime}] ${c.name} (${c.type}) @ ${c.room || 'TBD'}\n`);
      }
      return 0;
    }

    for (const c of courses) {
      io.out(`[Day ${c.dayOfWeek} ${c.startTime}-${c.endTime}] ${c.name} - ${c.lecturer || 'N/A'}\n`);
    }
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'timetable.next': async (ctx) => {
    const coursesCol = /** @type {import('../../kernel/types').Collection<Course>} */ (
      ctx.storage.collection('courses')
    );
    const courses = await coursesCol.all();
    const { current, next, minutesToNext } = computeNowAndNext(courses, new Date());
    const text = current
      ? `${current.name} (${current.room})`
      : next
        ? `${next.name} in ${minutesToNext}m`
        : 'No upcoming courses';
    ctx.notify({ title: ctx.i18n.t('nowAndNext'), body: text });
  },
  'timetable.newCourse': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.timetable', args: { action: 'newCourse' } }),
};

/**
 * Mounts the Timetable window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const semestersCol = /** @type {import('../../kernel/types').Collection<Semester>} */ (
    ctx.storage.collection('semesters')
  );
  const coursesCol = /** @type {import('../../kernel/types').Collection<Course>} */ (ctx.storage.collection('courses'));
  const attendanceCol = /** @type {import('../../kernel/types').Collection<AttendanceRecord>} */ (
    ctx.storage.collection('attendance')
  );

  /** @type {Semester[]} */
  let semesters = [];
  /** @type {Course[]} */
  let courses = [];
  /** @type {string} */
  let activeSemesterId = '';
  /** @type {'A' | 'B'} */
  let currentWeekType = getBiweeklyWeekType(new Date(), '2026-10-01', 'A');

  const startHour = Number(ctx.settings.get('dayStartHour')) || 8;
  const endHour = Number(ctx.settings.get('dayEndHour')) || 20;

  async function loadData() {
    semesters = await semestersCol.all();
    courses = await coursesCol.all();

    if (!semesters.length) {
      const defaultSem = {
        id: crypto.randomUUID(),
        name: ctx.i18n.locale === 'de' ? 'Wintersemester 2026/27' : 'Winter Semester 2026/27',
        startDate: '2026-10-01',
        endDate: '2027-03-31',
        active: true,
        archived: false,
      };
      await semestersCol.put(defaultSem);
      semesters = [defaultSem];
    }

    const active = semesters.find((s) => s.active) || semesters[0];
    activeSemesterId = active.id;

    if (!courses.length) {
      const seeded = [
        {
          id: crypto.randomUUID(),
          semesterId: activeSemesterId,
          name: ctx.i18n.locale === 'de' ? 'Betriebssysteme' : 'Operating Systems',
          code: 'CS201',
          type: /** @type {const} */ ('lecture'),
          lecturer: 'Prof. Dr. Weber',
          room: 'C213',
          color: 'cyan',
          dayOfWeek: 1, // Mon
          startTime: '08:15',
          endTime: '09:45',
          weekType: /** @type {const} */ ('all'),
        },
        {
          id: crypto.randomUUID(),
          semesterId: activeSemesterId,
          name: ctx.i18n.locale === 'de' ? 'Algorithmen & Datenstrukturen' : 'Algorithms & Data Structures',
          code: 'CS102',
          type: /** @type {const} */ ('lecture'),
          lecturer: 'Prof. Dr. Klein',
          room: 'H1',
          color: 'emerald',
          dayOfWeek: 2, // Tue
          startTime: '10:00',
          endTime: '11:30',
          weekType: /** @type {const} */ ('all'),
        },
        {
          id: crypto.randomUUID(),
          semesterId: activeSemesterId,
          name: ctx.i18n.locale === 'de' ? 'Mathematik 1 Praktikum' : 'Mathematics 1 Lab',
          code: 'MATH101',
          type: /** @type {const} */ ('lab'),
          lecturer: 'Dr. Becker',
          room: 'Lab 4',
          color: 'purple',
          dayOfWeek: 3, // Wed
          startTime: '14:15',
          endTime: '15:45',
          weekType: /** @type {const} */ ('A'),
        },
      ];
      for (const c of seeded) await coursesCol.put(c);
      courses = seeded;
    }

    await writeTimetableSnapshot(ctx.fs, courses);
  }

  const root = h('div', { class: 'nx-tt' });
  container.replaceChildren(root);

  function render() {
    replace(root);

    // 1. Toolbar
    const semesterSelect = h('select', { class: 'nx-select' });
    for (const sem of semesters.filter((s) => !s.archived)) {
      const opt = h('option', { value: sem.id, text: sem.name });
      if (sem.id === activeSemesterId) opt.selected = true;
      semesterSelect.append(opt);
    }
    semesterSelect.addEventListener('change', () => {
      activeSemesterId = semesterSelect.value;
      render();
    });

    const weekToggleBtn = button({
      label: t('currentWeek', { type: currentWeekType }),
      icon: 'refresh',
      onClick: () => {
        currentWeekType = currentWeekType === 'A' ? 'B' : 'A';
        render();
      },
    });

    const toolbar = h(
      'div',
      { class: 'nx-tt-toolbar' },
      h('div', { class: 'nx-tt-toolbar-left' }, h('strong', { text: t('appTitle') }), semesterSelect, weekToggleBtn),
      h(
        'div',
        { class: 'nx-tt-toolbar-right' },
        button({
          label: t('newCourse'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => promptEditCourse(),
        }),
        button({
          label: t('exportICS'),
          icon: 'download',
          onClick: () => {
            const activeSem = semesters.find((s) => s.id === activeSemesterId);
            const semCourses = courses.filter((c) => c.semesterId === activeSemesterId);
            const ics = exportTimetableToICS(semCourses, activeSem);
            ctx.fs.downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'timetable.ics');
          },
        }),
        button({
          label: t('exportJSON'),
          icon: 'upload',
          onClick: () => {
            const activeSem = semesters.find((s) => s.id === activeSemesterId) || semesters[0];
            const semCourses = courses.filter((c) => c.semesterId === activeSemesterId);
            const json = exportTimetableToJSON(activeSem, semCourses);
            ctx.fs.downloadBlob(new Blob([json], { type: 'application/json' }), 'timetable.json');
          },
        }),
      ),
    );

    // 2. Now & Next bar
    const nowNext = computeNowAndNext(courses, new Date(), currentWeekType);
    const nowCard = h(
      'div',
      { class: 'nx-tt-nn-card is-now' },
      h('span', { class: 'nx-tt-nn-tag', text: t('now') }),
      h(
        'div',
        {},
        nowNext.current
          ? h('strong', { text: `${nowNext.current.name} (${nowNext.current.room})` })
          : h('span', { style: { opacity: '0.6' }, text: t('noCurrentCourse') }),
      ),
    );
    const nextCard = h(
      'div',
      { class: 'nx-tt-nn-card is-next' },
      h('span', { class: 'nx-tt-nn-tag', text: t('next') }),
      h(
        'div',
        {},
        nowNext.next
          ? h('strong', {
              text: `${nowNext.next.name} (${nowNext.next.room}) ${nowNext.minutesToNext ? ` · ${t('inMinutes', { min: nowNext.minutesToNext })}` : ''}`,
            })
          : h('span', { style: { opacity: '0.6' }, text: t('noUpcomingCourse') }),
      ),
    );
    const nowNextBar = h('div', { class: 'nx-tt-now-next-bar' }, nowCard, nextCard);

    // 3. Grid container
    const gridContainer = h('div', { class: 'nx-tt-grid-container' });

    // Grid header
    const gridHeader = h('div', { class: 'nx-tt-grid-header' }, h('div', { text: '' }));
    for (let i = 0; i < 5; i++) {
      gridHeader.append(h('div', { text: t(DAY_LABELS[i]) }));
    }

    // Grid body
    const gridBody = h('div', { class: 'nx-tt-grid-body' });

    // Hours column
    const hourCol = h('div', { class: 'nx-tt-hour-col' });
    for (let hIndex = startHour; hIndex < endHour; hIndex++) {
      hourCol.append(h('div', { class: 'nx-tt-hour-cell', text: `${String(hIndex).padStart(2, '0')}:00` }));
    }
    gridBody.append(hourCol);

    // 5 day columns (Monday = 1 ... Friday = 5)
    for (let dayIndex = 1; dayIndex <= 5; dayIndex++) {
      const dayCol = h('div', { class: 'nx-tt-day-col', dataset: { day: String(dayIndex) } });

      const dayCourses = courses.filter(
        (c) =>
          c.semesterId === activeSemesterId &&
          c.dayOfWeek === dayIndex &&
          (!c.weekType || c.weekType === 'all' || c.weekType === currentWeekType),
      );

      for (const course of dayCourses) {
        const startM = timeToMinutes(course.startTime);
        const endM = timeToMinutes(course.endTime);
        const topPx = (startM - startHour * 60) * (60 / 60);
        const heightPx = Math.max(28, (endM - startM) * (60 / 60) - 2);

        const card = h(
          'div',
          {
            class: `nx-tt-card nx-tt-color-${course.color || 'cyan'}`,
            style: { top: `${topPx}px`, height: `${heightPx}px` },
            onclick: () => showCourseDetails(course),
          },
          h(
            'div',
            { class: 'nx-tt-card-title', text: course.name },
            course.code
              ? h('span', { style: { opacity: '0.7', marginLeft: '4px', fontSize: '10px' }, text: course.code })
              : null,
          ),
          h(
            'div',
            { class: 'nx-tt-card-meta' },
            h('span', { text: `${course.startTime} - ${course.endTime}` }),
            course.room ? h('span', { text: `· ${course.room}` }) : null,
          ),
        );
        dayCol.append(card);
      }

      gridBody.append(dayCol);
    }

    gridContainer.append(gridHeader, gridBody);
    root.append(toolbar, nowNextBar, gridContainer);
  }

  /**
   * Opens course detail modal with study links (Notes, Tasks, Flashcards) & attendance.
   * @param {Course} course
   */
  async function showCourseDetails(course) {
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });

    body.append(
      h('div', {}, h('strong', { text: `${course.name} (${course.code || course.type})` })),
      h(
        'div',
        { style: { fontSize: '12px', opacity: '0.85' } },
        `${t('lecturer')}: ${course.lecturer || 'N/A'} · ${t('room')}: ${course.room || 'N/A'}`,
      ),
      h(
        'div',
        { style: { fontSize: '12px', opacity: '0.85' } },
        `${t('startTime')}: ${course.startTime} - ${course.endTime} · ${t('recurrence')}: ${course.weekType === 'all' ? t('recurrenceAll') : course.weekType === 'A' ? t('recurrenceA') : t('recurrenceB')}`,
      ),
    );

    // Cross-app study links!
    const linksDiv = h('div', { class: 'nx-tt-links' });

    // Link: Notes
    linksDiv.append(
      button({
        label: t('openNotes'),
        icon: 'note',
        onClick: async () => {
          const notesDir = `${ctx.fs.home}/Documents/Notes/Courses/${course.name.replace(/[/\\?%*:|"<>]/g, '_')}`;
          await ctx.fs.mkdir(notesDir, { createParents: true });
          const notePath = `${notesDir}/Overview.md`;
          if (!(await ctx.fs.exists(notePath))) {
            await ctx.fs.writeFile(
              notePath,
              `# ${course.name}\n\nLecturer: ${course.lecturer || 'N/A'}\nRoom: ${course.room || 'N/A'}\n\n## Lecture Notes\n\n`,
            );
          }
          await ctx.intents.open(notePath, { with: 'nexus.notes' });
        },
      }),
    );

    // Link: Tasks
    linksDiv.append(
      button({
        label: t('openTasks'),
        icon: 'checklist',
        onClick: async () => {
          await ctx.commands.execute('shell.launchApp', { appId: 'nexus.tasks' });
        },
      }),
    );

    // Link: Flashcards
    linksDiv.append(
      button({
        label: t('openFlashcards'),
        icon: 'cards',
        onClick: async () => {
          await ctx.commands.execute('shell.launchApp', { appId: 'nexus.flashcards', args: { deckName: course.name } });
        },
      }),
    );

    body.append(h('strong', { style: { marginTop: '8px' }, text: t('links') }), linksDiv);

    // Attendance buttons
    const todayStr = new Date().toISOString().split('T')[0];
    const attDiv = h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } });
    attDiv.append(
      button({
        label: t('markAttended'),
        icon: 'check',
        variant: 'primary',
        onClick: async () => {
          await attendanceCol.put({
            id: `${course.id}:${todayStr}`,
            courseId: course.id,
            date: todayStr,
            status: 'attended',
          });
          ctx.notify({ title: course.name, body: t('markAttended') });
        },
      }),
      button({
        label: t('markCancelled'),
        icon: 'x',
        onClick: async () => {
          await attendanceCol.put({
            id: `${course.id}:${todayStr}`,
            courseId: course.id,
            date: todayStr,
            status: 'cancelled',
          });
          ctx.notify({ title: course.name, body: t('markCancelled') });
        },
      }),
    );
    body.append(h('strong', { style: { marginTop: '8px' }, text: t('attendance') }), attDiv);

    await openModal({
      title: course.name,
      body,
      actions: [
        {
          label: t('delete'),
          value: 'delete',
          variant: 'danger',
          accept: async () => {
            const confirmed = await ctx.dialog.confirm(t('confirmDelete'));
            if (confirmed) {
              await coursesCol.delete(course.id);
              courses = courses.filter((c) => c.id !== course.id);
              await writeTimetableSnapshot(ctx.fs, courses);
              render();
              return true;
            }
            return false;
          },
        },
        {
          label: t('editCourse'),
          value: 'edit',
          variant: 'primary',
          accept: async () => {
            promptEditCourse(course);
            return true;
          },
        },
        { label: t('close'), value: 'close' },
      ],
    });
  }

  /**
   * Prompts to create or edit a course.
   * @param {Course} [existing]
   */
  async function promptEditCourse(existing) {
    const nameInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.name || '',
      placeholder: 'e.g. Operating Systems',
    });
    const codeInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.code || '',
      placeholder: 'e.g. CS201',
    });
    const lecturerInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.lecturer || '',
      placeholder: 'e.g. Prof. Weber',
    });
    const roomInput = h('input', {
      class: 'nx-input',
      type: 'text',
      value: existing?.room || '',
      placeholder: 'e.g. C213',
    });
    const startInput = h('input', { class: 'nx-input', type: 'time', value: existing?.startTime || '08:15' });
    const endInput = h('input', { class: 'nx-input', type: 'time', value: existing?.endTime || '09:45' });

    const daySelect = h('select', { class: 'nx-select' });
    for (let d = 1; d <= 5; d++) {
      const opt = h('option', { value: String(d), text: t(DAY_LABELS[d - 1]) });
      if (existing ? existing.dayOfWeek === d : d === 1) opt.selected = true;
      daySelect.append(opt);
    }

    const typeSelect = h('select', { class: 'nx-select' });
    for (const ct of COURSE_TYPES) {
      const opt = h('option', { value: ct, text: t(`type${ct[0].toUpperCase()}${ct.slice(1)}`) });
      if (existing?.type === ct) opt.selected = true;
      typeSelect.append(opt);
    }

    const weekSelect = h('select', { class: 'nx-select' });
    weekSelect.append(
      h('option', { value: 'all', text: t('recurrenceAll'), selected: existing?.weekType === 'all' }),
      h('option', { value: 'A', text: t('recurrenceA'), selected: existing?.weekType === 'A' }),
      h('option', { value: 'B', text: t('recurrenceB'), selected: existing?.weekType === 'B' }),
    );

    const colorSelect = h('select', { class: 'nx-select' });
    for (const col of COURSE_COLORS) {
      const opt = h('option', { value: col, text: col });
      if (existing?.color === col) opt.selected = true;
      colorSelect.append(opt);
    }

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('label', {}, t('courseName'), nameInput),
      h('label', {}, t('courseCode'), codeInput),
      h('label', {}, t('courseType'), typeSelect),
      h('label', {}, t('lecturer'), lecturerInput),
      h('label', {}, t('room'), roomInput),
      h('label', {}, t('dayOfWeek'), daySelect),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        h('label', {}, t('startTime'), startInput),
        h('label', {}, t('endTime'), endInput),
      ),
      h('label', {}, t('recurrence'), weekSelect),
      h('label', {}, t('color'), colorSelect),
    );

    await openModal({
      title: existing ? t('editCourse') : t('newCourse'),
      body: form,
      actions: [
        { label: t('cancel'), value: false },
        {
          label: t('save'),
          value: true,
          variant: 'primary',
          accept: async () => {
            const name = nameInput.value.trim();
            if (!name) return false;
            /** @type {Course} */
            const item = {
              id: existing?.id || crypto.randomUUID(),
              semesterId: activeSemesterId,
              name,
              code: codeInput.value.trim(),
              type: /** @type {any} */ (typeSelect.value),
              lecturer: lecturerInput.value.trim(),
              room: roomInput.value.trim(),
              dayOfWeek: Number(daySelect.value),
              startTime: startInput.value || '08:00',
              endTime: endInput.value || '09:30',
              weekType: /** @type {any} */ (weekSelect.value),
              color: colorSelect.value,
            };
            await coursesCol.put(item);
            const idx = courses.findIndex((c) => c.id === item.id);
            if (idx === -1) courses.push(item);
            else courses[idx] = item;
            await writeTimetableSnapshot(ctx.fs, courses);
            render();
            return true;
          },
        },
      ],
    });
  }

  await loadData();
  render();

  if (args.action === 'newCourse') {
    setTimeout(() => promptEditCourse(), 50);
  }

  return {
    saveState: () => ({ activeSemesterId, currentWeekType }),
  };
}
