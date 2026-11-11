// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.nonogram',
  name: { en: 'Nonogram', de: 'Nonogramm' },
  description: {
    en: 'Japanese Picross grid logic puzzles with line-check helpers, penalty options, and procedural generator',
    de: 'Japanische Picross-Gitterrätsel mit Zeilenprüfer, Strafzeit-Option und prozeduralem Generator',
  },
  version: '1.0.0',
  icon: 'grid',
  category: 'games',
  keywords: ['nonogram', 'picross', 'griddlers', 'paint by numbers', 'logic', 'puzzle'],
  window: { width: 840, height: 720, minWidth: 460, minHeight: 480 },
  commands: [{ id: 'nonogram.open', title: { en: 'Open Nonogram', de: 'Nonogramm öffnen' }, icon: 'grid' }],
  terminal: [
    {
      name: 'nonogram',
      description: { en: 'Launch Nonogram puzzle game', de: 'Nonogramm Rätselspiel starten' },
      usage: 'nonogram',
    },
  ],
  achievements: [
    {
      id: 'nonogram_first_win',
      title: { en: 'Pixel Pioneer', de: 'Pixel-Pionier' },
      description: { en: 'Solve your first nonogram puzzle', de: 'Löse dein erstes Nonogramm-Rätsel' },
      icon: 'star',
    },
    {
      id: 'nonogram_flawless',
      title: { en: 'Flawless Deduction', de: 'Makellose Deduktion' },
      description: {
        en: 'Solve a 10×10 or larger puzzle with zero errors',
        de: 'Löse ein 10×10 oder größeres Rätsel ohne Fehler',
      },
      icon: 'sparkles',
    },
    {
      id: 'nonogram_expert',
      title: { en: 'Master Illustrative', de: 'Meister-Illustrator' },
      description: { en: 'Solve a 15×15 grid puzzle', de: 'Löse ein 15×15 Gitterrätsel' },
      icon: 'trophy',
    },
    {
      id: 'nonogram_speed',
      title: { en: 'Speed Sketcher', de: 'Schnellzeichner' },
      description: { en: 'Solve a puzzle in under 2 minutes', de: 'Löse ein Rätsel in unter 2 Minuten' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
