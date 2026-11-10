// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.timetable',
  name: { en: 'Timetable', de: 'Stundenplan' },
  description: {
    en: 'Weekly university course grid, biweekly A/B weeks, semesters, attendance tracking, and Calendar sync',
    de: 'Wöchentlicher Vorlesungsplan, A/B-Wochen, Semesterverwaltung, Anwesenheitserfassung und Kalender-Sync',
  },
  version: '1.0.0',
  icon: 'table',
  category: 'study',
  keywords: ['timetable', 'courses', 'classes', 'stundenplan', 'vorlesungen', 'studium', 'semester'],
  window: { width: 1040, height: 680, minWidth: 540, minHeight: 380, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler', 'clipboard'],
  storage: {
    version: 1,
    collections: {
      semesters: {
        indexes: {
          active: 'active',
        },
      },
      courses: {
        indexes: {
          semesterId: 'semesterId',
          dayOfWeek: 'dayOfWeek',
        },
      },
      attendance: {
        indexes: {
          courseId: 'courseId',
          date: 'date',
        },
      },
    },
  },
  settings: [
    {
      key: 'biweeklyWeekStart',
      label: { en: 'Initial week type (A or B)', de: 'Start-Wochentyp (A oder B)' },
      type: 'enum',
      default: 'A',
      options: [
        { value: 'A', label: { en: 'Week A', de: 'Woche A' } },
        { value: 'B', label: { en: 'Week B', de: 'Woche B' } },
      ],
    },
    {
      key: 'dayStartHour',
      label: { en: 'Grid start hour', de: 'Startzeit Stundenplan (Stunde)' },
      type: 'number',
      min: 6,
      max: 10,
      default: 8,
    },
    {
      key: 'dayEndHour',
      label: { en: 'Grid end hour', de: 'Endzeit Stundenplan (Stunde)' },
      type: 'number',
      min: 16,
      max: 22,
      default: 20,
    },
  ],
  commands: [
    {
      id: 'timetable.next',
      title: { en: 'Next course', de: 'Nächste Vorlesung' },
      icon: 'table',
    },
    {
      id: 'timetable.newCourse',
      title: { en: 'New course', de: 'Neuer Kurs' },
      icon: 'table',
    },
  ],
  terminal: [
    {
      name: 'timetable',
      description: {
        en: 'Show timetable status and next course',
        de: 'Stundenplan-Status und nächste Vorlesung anzeigen',
      },
      usage: 'timetable [next | today | list]',
    },
  ],
  widgets: [
    {
      id: 'now-next',
      title: { en: 'Now & Next', de: 'Jetzt & Nächste' },
      icon: 'table',
      size: [2, 1],
      minSize: [2, 1],
      load: () => import('./widget.js'),
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
