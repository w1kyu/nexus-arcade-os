// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.uttt',
  name: { en: 'Ultimate Tic-Tac-Toe', de: 'Ultimate Tic-Tac-Toe' },
  description: {
    en: 'Tic-tac-toe inside tic-tac-toe, against the computer or a friend',
    de: 'Tic-Tac-Toe in Tic-Tac-Toe, gegen den Computer oder Freunde',
  },
  version: '1.0.0',
  icon: 'grid',
  category: 'games',
  keywords: ['uttt', 'tic-tac-toe', 'ultimate', 'board', 'strategy', '2player'],
  window: { width: 680, height: 720, minWidth: 440, minHeight: 480 },
  commands: [
    { id: 'uttt.open', title: { en: 'Open Ultimate Tic-Tac-Toe', de: 'Ultimate Tic-Tac-Toe öffnen' }, icon: 'grid' },
  ],
  terminal: [
    {
      name: 'uttt',
      description: { en: 'Launch Ultimate Tic-Tac-Toe', de: 'Ultimate Tic-Tac-Toe starten' },
      usage: 'uttt',
    },
  ],
  achievements: [
    {
      id: 'uttt_first_win',
      title: { en: 'Macro Master', de: 'Makro-Meister' },
      description: { en: 'Win a game of Ultimate Tic-Tac-Toe', de: 'Gewinne ein Spiel Ultimate Tic-Tac-Toe' },
      icon: 'star',
    },
    {
      id: 'uttt_beat_hard',
      title: { en: 'Grand Strategist', de: 'Großstratege' },
      description: {
        en: 'Beat the Hard AI in Ultimate Tic-Tac-Toe',
        de: 'Besiege die schwere KI in Ultimate Tic-Tac-Toe',
      },
      icon: 'trophy',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
