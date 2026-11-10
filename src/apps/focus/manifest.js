// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.focus',
  name: { en: 'Focus', de: 'Fokus' },
  description: {
    en: 'Pomodoro & Flow timer with procedural Web Audio ambient soundscapes, distraction blocking, and task logging',
    de: 'Pomodoro- & Flow-Timer mit prozeduralen Web-Audio-Klangwelten, Ablenkungsschutz und Aufgaben-Zeiterfassung',
  },
  version: '1.0.0',
  icon: 'timer',
  category: 'productivity',
  keywords: ['focus', 'pomodoro', 'timer', 'ambient', 'study', 'fokus', 'konzentration'],
  window: { width: 960, height: 660, minWidth: 320, minHeight: 300, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler'],
  storage: {
    version: 1,
    collections: {
      sessions: {
        indexes: {
          date: 'date',
          taskId: 'taskId',
        },
      },
      mixes: {
        indexes: {
          name: 'name',
        },
      },
    },
  },
  settings: [
    {
      key: 'workMinutes',
      label: { en: 'Work duration (minutes)', de: 'Arbeitsdauer (Minuten)' },
      type: 'number',
      min: 1,
      max: 120,
      default: 25,
    },
    {
      key: 'shortBreakMinutes',
      label: { en: 'Short break (minutes)', de: 'Kurze Pause (Minuten)' },
      type: 'number',
      min: 1,
      max: 60,
      default: 5,
    },
    {
      key: 'longBreakMinutes',
      label: { en: 'Long break (minutes)', de: 'Lange Pause (Minuten)' },
      type: 'number',
      min: 1,
      max: 60,
      default: 15,
    },
    {
      key: 'roundsBeforeLongBreak',
      label: { en: 'Rounds before long break', de: 'Runden bis zur langen Pause' },
      type: 'number',
      min: 1,
      max: 12,
      default: 4,
    },
    {
      key: 'dailyGoalMinutes',
      label: { en: 'Daily focus goal (minutes)', de: 'Tagesziel Fokus (Minuten)' },
      type: 'number',
      min: 15,
      max: 720,
      default: 240,
    },
    {
      key: 'autoStartNext',
      label: { en: 'Auto-start next phase', de: 'Nächste Phase automatisch starten' },
      type: 'boolean',
      default: false,
    },
  ],
  commands: [
    {
      id: 'focus.start',
      title: { en: 'Start Focus session', de: 'Fokus-Sitzung starten' },
      icon: 'timer',
      shortcut: 'Mod+Alt+F',
    },
  ],
  terminal: [
    {
      name: 'focus',
      description: {
        en: 'Show focus statistics or start a session',
        de: 'Fokus-Statistiken anzeigen oder Sitzung starten',
      },
      usage: 'focus [stats | start]',
    },
  ],
  widgets: [
    {
      id: 'goal',
      title: { en: 'Focus Goal', de: 'Fokus-Tagesziel' },
      icon: 'timer',
      size: [2, 2],
      minSize: [2, 2],
      load: () => import('./widget.js'),
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
