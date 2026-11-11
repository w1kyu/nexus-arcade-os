// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.sudoku',
  name: { en: 'Sudoku', de: 'Sudoku' },
  description: {
    en: 'Logic number placement with unique solutions, pencil notes, auto-candidates, and technique hints',
    de: 'Logisches Zahlenrätsel mit eindeutigen Lösungen, Bleistift-Notizen und Technik-Hinweisen',
  },
  version: '1.0.0',
  icon: 'hash',
  category: 'games',
  keywords: ['sudoku', 'puzzle', 'logic', 'numbers', 'brain'],
  window: { width: 620, height: 720, minWidth: 420, minHeight: 520 },
  permissions: ['intents'],
  commands: [
    {
      id: 'sudoku.open',
      title: { en: 'Open Sudoku', de: 'Sudoku öffnen' },
      icon: 'hash',
    },
  ],
  terminal: [
    {
      name: 'sudoku',
      description: {
        en: 'Launch Sudoku puzzle game',
        de: 'Sudoku Logikspiel starten',
      },
      usage: 'sudoku',
    },
  ],
  achievements: [
    {
      id: 'sudoku_complete',
      title: { en: 'Grid Master', de: 'Gitter-Meister' },
      description: { en: 'Complete any Sudoku puzzle', de: 'Löse ein beliebiges Sudoku-Rätsel' },
      icon: 'trophy',
    },
    {
      id: 'sudoku_expert',
      title: { en: 'Grandmaster Logician', de: 'Großmeister-Logiker' },
      description: { en: 'Solve an Expert difficulty Sudoku', de: 'Löse ein Experten-Sudoku' },
      icon: 'star',
    },
    {
      id: 'sudoku_daily',
      title: { en: 'Daily Ritual', de: 'Tägliches Ritual' },
      description: { en: 'Solve the Daily Challenge Sudoku', de: 'Löse das tägliche Sudoku' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
