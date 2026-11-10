// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.clock',
  name: { en: 'Clock', de: 'Uhr' },
  description: {
    en: 'World clock (analog + digital), multiple named timers, stopwatch with laps & export, and time-zone meeting planner',
    de: 'Weltzeituhr (analog & digital), mehrere benannte Timer, Stoppuhr mit Rundenzeiten und Zeitzonen-Meetingplaner',
  },
  version: '1.0.0',
  icon: 'clock',
  category: 'productivity',
  keywords: ['clock', 'world', 'time', 'timezone', 'uhr', 'zeit', 'stopwatch', 'timer', 'alarm'],
  window: { width: 880, height: 640, minWidth: 480, minHeight: 400, singleInstance: false },
  permissions: ['scheduler', 'notifications', 'clipboard'],
  storage: {
    version: 1,
    collections: {
      cities: {
        indexes: {},
      },
      timers: {
        indexes: {},
      },
      alarms: {
        indexes: {},
      },
    },
  },
  commands: [
    {
      id: 'clock.timer',
      title: { en: 'New Timer', de: 'Neuer Timer' },
      icon: 'clock',
    },
    {
      id: 'clock.stopwatch',
      title: { en: 'Open Stopwatch', de: 'Stoppuhr öffnen' },
      icon: 'clock',
    },
  ],
  terminal: [
    {
      name: 'clock',
      description: {
        en: 'Inspect time across cities',
        de: 'Uhrzeit in verschiedenen Städten prüfen',
      },
      usage: 'clock [world | meeting <city1> <city2> ...]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
