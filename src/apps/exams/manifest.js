// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.exams',
  name: { en: 'Exam Planner', de: 'Klausurenplaner' },
  description: {
    en: 'Exam countdown cards, topic checklists, automated study plan generator into Tasks, and readiness score',
    de: 'Prüfungs-Countdown-Karten, Themen-Checklisten, automatische Lernplan-Generierung in Aufgaben und Bereitschaftswert',
  },
  version: '1.0.0',
  icon: 'target',
  category: 'study',
  keywords: ['exams', 'planner', 'countdown', 'klausuren', 'prüfungen', 'studium', 'lernplan', 'readiness'],
  window: { width: 1040, height: 680, minWidth: 540, minHeight: 380, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler', 'clipboard'],
  storage: {
    version: 1,
    collections: {
      exams: {
        indexes: {
          date: 'date',
          moduleName: 'moduleName',
        },
      },
    },
  },
  commands: [
    {
      id: 'exams.new',
      title: { en: 'New exam', de: 'Neue Prüfung' },
      icon: 'target',
    },
  ],
  terminal: [
    {
      name: 'exams',
      description: {
        en: 'Show exam countdowns, checklist progress, and generate study plans',
        de: 'Prüfungs-Countdowns und Lernpläne anzeigen',
      },
      usage: 'exams [list | countdown | plan <id>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
