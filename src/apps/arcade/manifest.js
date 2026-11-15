// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.arcade',
  name: { en: 'Arcade Hub', de: 'Arcade-Zentrale' },
  description: {
    en: 'All games in one place, with your level, favorites and achievements',
    de: 'Alle Spiele an einem Ort, mit deinem Level, Favoriten und Erfolgen',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['arcade', 'hub', 'games', 'play', 'launcher', 'achievements'],
  window: { width: 980, height: 720, minWidth: 640, minHeight: 480 },
  permissions: ['system', 'intents'],
  commands: [
    {
      id: 'arcade.open',
      title: { en: 'Open Arcade Hub', de: 'Arcade-Zentrale öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'arcade',
      description: {
        en: 'Launch Arcade Hub game library',
        de: 'Arcade-Zentrale Spielebibliothek starten',
      },
      usage: 'arcade',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
