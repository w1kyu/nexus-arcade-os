// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.grades',
  name: { en: 'Grade Tracker', de: 'Notenrechner' },
  description: {
    en: 'German 1.0–5.0 and international grading scales, ECTS-weighted GPA, semester dashboard, and What-If calculator',
    de: 'Deutsches 1,0–5,0-System & internationale Notenskalen, ECTS-gewichteter Schnitt, Semester-Dashboard und Was-wäre-wenn-Rechner',
  },
  version: '1.0.0',
  icon: 'award',
  category: 'study',
  keywords: ['grades', 'gpa', 'ects', 'noten', 'notenrechner', 'studium', 'schnitt', 'abschlussnote'],
  window: { width: 1020, height: 680, minWidth: 540, minHeight: 380, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler', 'clipboard'],
  storage: {
    version: 1,
    collections: {
      profiles: {
        indexes: {
          name: 'name',
        },
      },
      modules: {
        indexes: {
          profileId: 'profileId',
          semester: 'semester',
          status: 'status',
        },
      },
    },
  },
  settings: [
    {
      key: 'defaultScale',
      label: { en: 'Grading scale', de: 'Notenskala' },
      type: 'enum',
      default: 'german',
      options: [
        { value: 'german', label: { en: 'German (1.0 - 5.0)', de: 'Deutsch (1,0 - 5,0)' } },
        { value: 'us_gpa', label: { en: 'US GPA (4.0 - 0.0)', de: 'US GPA (4.0 - 0.0)' } },
        { value: 'percentage', label: { en: 'Percentage (0 - 100%)', de: 'Prozent (0 - 100 %)' } },
        { value: 'swiss', label: { en: 'Swiss (6.0 - 1.0)', de: 'Schweiz (6.0 - 1.0)' } },
        { value: 'austrian', label: { en: 'Austrian (1 - 5)', de: 'Österreich (1 - 5)' } },
      ],
    },
    {
      key: 'targetGrade',
      label: { en: 'Target final grade', de: 'Ziel-Abschlussnote' },
      type: 'number',
      min: 1.0,
      max: 5.0,
      step: 0.1,
      default: 2.0,
    },
  ],
  commands: [
    {
      id: 'grades.summary',
      title: { en: 'Grade summary', de: 'Notenübersicht' },
      icon: 'award',
    },
  ],
  terminal: [
    {
      name: 'grades',
      description: {
        en: 'Display grade statistics and What-If analysis',
        de: 'Notenstatistiken und Was-Wäre-Wenn-Berechnung anzeigen',
      },
      usage: 'grades [summary | list | whatif <target>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
