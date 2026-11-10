// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.habits',
  name: { en: 'Habits', de: 'Gewohnheiten' },
  description: {
    en: 'Daily and weekly habit tracking, streak counters, GitHub-style yearly heatmaps, and quick check-ins',
    de: 'Tägliche & wöchentliche Gewohnheiten, Serien-Zähler, GitHub-Heatmaps und Schnell-Check-ins',
  },
  version: '1.0.0',
  icon: 'flame',
  category: 'productivity',
  keywords: ['habits', 'streaks', 'goals', 'tracker', 'gewohnheiten', 'routine', 'disziplin'],
  window: { width: 1040, height: 680, minWidth: 540, minHeight: 400, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler', 'clipboard'],
  storage: {
    version: 1,
    collections: {
      habits: {
        indexes: {
          name: 'name',
        },
      },
      logs: {
        indexes: {
          habitId: 'habitId',
          date: 'date',
        },
      },
    },
  },
  commands: [
    {
      id: 'habits.check',
      title: { en: 'Check habit', de: 'Gewohnheit abhaken' },
      icon: 'flame',
    },
    {
      id: 'habits.new',
      title: { en: 'New habit', de: 'Neue Gewohnheit' },
      icon: 'flame',
    },
  ],
  terminal: [
    {
      name: 'habit',
      description: {
        en: 'Check in or list habits',
        de: 'Gewohnheiten auflisten oder abhaken',
      },
      usage: 'habit [list | done <name>]',
    },
  ],
  widgets: [
    {
      id: 'habits-widget',
      title: { en: 'Habit Streaks', de: 'Gewohnheiten' },
      icon: 'flame',
      size: [2, 2],
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
