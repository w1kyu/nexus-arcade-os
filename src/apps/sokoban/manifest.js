// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.sokoban',
  name: { en: 'Block Pusher', de: 'Block Pusher' },
  description: {
    en: 'Sokoban warehouse puzzle with 60+ verified solvable levels and level editor',
    de: 'Sokoban Lagerhaus-Rätsel mit über 60 überprüften lösbaren Levels und Level-Editor',
  },
  version: '1.0.0',
  icon: 'package',
  category: 'games',
  keywords: ['sokoban', 'block pusher', 'puzzle', 'boxes', 'warehouse', 'logic'],
  window: { width: 780, height: 680, minWidth: 420, minHeight: 460 },
  commands: [{ id: 'sokoban.open', title: { en: 'Open Block Pusher', de: 'Block Pusher öffnen' }, icon: 'package' }],
  terminal: [
    {
      name: 'sokoban',
      description: { en: 'Launch Block Pusher game', de: 'Block Pusher Spiel starten' },
      usage: 'sokoban',
    },
  ],
  achievements: [
    {
      id: 'sokoban_first_win',
      title: { en: 'First Delivery', de: 'Erste Lieferung' },
      description: { en: 'Clear your first Sokoban level', de: 'Löse dein erstes Sokoban-Level' },
      icon: 'star',
    },
    {
      id: 'sokoban_10_levels',
      title: { en: 'Warehouse Manager', de: 'Lagerleiter' },
      description: { en: 'Clear 10 Sokoban levels', de: 'Löse 10 Sokoban-Levels' },
      icon: 'trophy',
    },
    {
      id: 'sokoban_builder',
      title: { en: 'Architect', de: 'Architekt' },
      description: {
        en: 'Import or create a custom level in the editor',
        de: 'Erstelle oder importiere ein eigenes Level im Editor',
      },
      icon: 'sparkles',
    },
    {
      id: 'sokoban_master',
      title: { en: 'Logistics Overlord', de: 'Logistik-Meister' },
      description: { en: 'Conquer 30 Sokoban puzzle levels', de: 'Meistere 30 Sokoban-Rätsellevel' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
