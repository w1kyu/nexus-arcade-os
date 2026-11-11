// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.chess',
  name: { en: 'Nexus Chess', de: 'Nexus Schach' },
  description: {
    en: 'Tactical chess with alpha-beta AI, puzzle challenges, PGN import/export, and local 2-player',
    de: 'Taktisches Schach mit Alpha-Beta-KI, Rätsel-Herausforderungen, PGN-Import/Export und lokalem 2-Spieler-Modus',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['chess', 'schach', 'board', 'strategy', 'puzzle', 'ai', '2player'],
  window: { width: 860, height: 720, minWidth: 480, minHeight: 520 },
  commands: [{ id: 'chess.open', title: { en: 'Open Nexus Chess', de: 'Nexus Schach öffnen' }, icon: 'gamepad' }],
  terminal: [
    {
      name: 'chess',
      description: { en: 'Launch Nexus Chess', de: 'Nexus Schach starten' },
      usage: 'chess',
    },
  ],
  achievements: [
    {
      id: 'chess_first_win',
      title: { en: 'Grandmaster Spark', de: 'Großmeister-Funke' },
      description: { en: 'Win a chess game against the AI', de: 'Gewinne eine Schachpartie gegen die KI' },
      icon: 'star',
    },
    {
      id: 'chess_puzzle_master',
      title: { en: 'Tactical Mind', de: 'Taktischer Geist' },
      description: { en: 'Solve 5 chess tactics puzzles', de: 'Löse 5 taktische Schachrätsel' },
      icon: 'sparkles',
    },
    {
      id: 'chess_beat_master',
      title: { en: 'Deep Circuit', de: 'Tiefer Schaltkreis' },
      description: { en: 'Defeat the Level 5 Master AI', de: 'Besiege die Stufe 5 Meister-KI' },
      icon: 'trophy',
    },
    {
      id: 'chess_quick_mate',
      title: { en: 'Blitzkrieg Checkmate', de: 'Blitz-Schachmatt' },
      description: { en: 'Achieve checkmate in under 20 moves', de: 'Setze in weniger als 20 Zügen schachmatt' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
