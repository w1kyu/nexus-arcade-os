// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.match3',
  name: { en: 'Match-3 Puzzle', de: 'Match-3 Puzzle' },
  description: {
    en: 'Swap and match vibrant cyber gems with cascade combos, special bombs, and level goals',
    de: 'Tausche und verbinde Cyber-Edelsteine mit Kaskaden-Kombos, Bomben und Level-Zielen',
  },
  version: '1.0.0',
  icon: 'sparkles',
  category: 'games',
  keywords: ['match3', 'puzzle', 'gems', 'cascade', 'combo', 'arcade'],
  window: { width: 720, height: 720, minWidth: 480, minHeight: 480 },
  commands: [
    { id: 'match3.open', title: { en: 'Open Match-3 Puzzle', de: 'Match-3 Puzzle öffnen' }, icon: 'sparkles' },
  ],
  terminal: [
    {
      name: 'match3',
      description: { en: 'Launch Match-3 Puzzle', de: 'Match-3 Puzzle starten' },
      usage: 'match3',
    },
  ],
  achievements: [
    {
      id: 'match3_first_clear',
      title: { en: 'Gem Smasher', de: 'Edelstein-Zertrümmerer' },
      description: { en: 'Clear Level 1 in Match-3 Puzzle', de: 'Schließe Level 1 im Match-3 Puzzle ab' },
      icon: 'star',
    },
    {
      id: 'match3_cascade_4',
      title: { en: 'Cascade Reaction', de: 'Kaskaden-Reaktion' },
      description: {
        en: 'Trigger a 4x cascade combo in a single move',
        de: 'Löse eine 4-fache Kaskaden-Kombo in einem Zug aus',
      },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
