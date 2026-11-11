// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.connectfour',
  name: { en: 'Connect Four', de: 'Vier gewinnt' },
  description: {
    en: 'Drop discs and connect four in a row against a minimax AI or a friend',
    de: 'Wirf Scheiben ein und verbinde vier in einer Reihe, gegen eine Minimax-KI oder zu zweit',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['connect four', 'vier gewinnt', 'board', 'strategy', '2player'],
  window: { width: 640, height: 660, minWidth: 360, minHeight: 440 },
  commands: [
    { id: 'connectfour.open', title: { en: 'Open Connect Four', de: 'Vier gewinnt öffnen' }, icon: 'gamepad' },
  ],
  terminal: [
    {
      name: 'connectfour',
      description: { en: 'Launch Connect Four', de: 'Vier gewinnt starten' },
      usage: 'connectfour',
    },
  ],
  achievements: [
    {
      id: 'connectfour_first_win',
      title: { en: 'Four in a Row', de: 'Vier in einer Reihe' },
      description: { en: 'Win a game against the AI', de: 'Gewinne ein Spiel gegen die KI' },
      icon: 'star',
    },
    {
      id: 'connectfour_beat_hard',
      title: { en: 'Grid Strategist', de: 'Raster-Stratege' },
      description: { en: 'Beat the Hard AI', de: 'Besiege die schwere KI' },
      icon: 'trophy',
    },
    {
      id: 'connectfour_quick',
      title: { en: 'Swift Connection', de: 'Schnelle Verbindung' },
      description: {
        en: 'Win against the AI within 8 of your moves',
        de: 'Gewinne gegen die KI mit höchstens 8 eigenen Zügen',
      },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
