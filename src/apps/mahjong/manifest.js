// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.mahjong',
  name: { en: 'Mahjong Solitaire', de: 'Mahjong Solitaire' },
  description: {
    en: 'Classic 3D tile-matching with multiple layouts, hints, shuffle, and verified solvable deals',
    de: 'Klassisches 3D-Kachel-Matching mit mehreren Layouts, Hinweisen, Mischen und garantierten Lösungen',
  },
  version: '1.0.0',
  icon: 'layers',
  category: 'games',
  keywords: ['mahjong', 'solitaire', 'tiles', 'matching', 'puzzle', 'oriental'],
  window: { width: 920, height: 700, minWidth: 640, minHeight: 480 },
  commands: [
    { id: 'mahjong.open', title: { en: 'Open Mahjong Solitaire', de: 'Mahjong Solitaire öffnen' }, icon: 'layers' },
  ],
  terminal: [
    {
      name: 'mahjong',
      description: { en: 'Launch Mahjong Solitaire', de: 'Mahjong Solitaire starten' },
      usage: 'mahjong',
    },
  ],
  achievements: [
    {
      id: 'mahjong_first_clear',
      title: { en: 'Tile Clearer', de: 'Kachelräumer' },
      description: { en: 'Complete a game of Mahjong Solitaire', de: 'Schließe ein Spiel Mahjong Solitaire ab' },
      icon: 'star',
    },
    {
      id: 'mahjong_speed_match',
      title: { en: 'Dragon Speed', de: 'Drachentempo' },
      description: { en: 'Clear a board in under 4 minutes', de: 'Räume ein Brett in unter 4 Minuten ab' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
