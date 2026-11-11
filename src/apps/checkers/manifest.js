// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.checkers',
  name: { en: 'Checkers', de: 'Dame' },
  description: {
    en: 'Draughts with standard and international rules, forced captures, multi-jumps and an AI opponent',
    de: 'Dame nach Standard- und internationalen Regeln mit Schlagzwang, Mehrfachsprüngen und KI-Gegner',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['checkers', 'draughts', 'dame', 'board', 'strategy', '2player'],
  window: { width: 700, height: 740, minWidth: 380, minHeight: 480 },
  commands: [{ id: 'checkers.open', title: { en: 'Open Checkers', de: 'Dame öffnen' }, icon: 'gamepad' }],
  terminal: [
    {
      name: 'checkers',
      description: { en: 'Launch Checkers', de: 'Dame starten' },
      usage: 'checkers',
    },
  ],
  achievements: [
    {
      id: 'checkers_first_win',
      title: { en: 'Board Cleared', de: 'Brett geräumt' },
      description: { en: 'Win a game against the AI', de: 'Gewinne ein Spiel gegen die KI' },
      icon: 'star',
    },
    {
      id: 'checkers_king',
      title: { en: 'Coronation', de: 'Krönung' },
      description: { en: 'Crown your first king', de: 'Kröne deine erste Dame' },
      icon: 'award',
    },
    {
      id: 'checkers_triple',
      title: { en: 'Triple Jump', de: 'Dreifachsprung' },
      description: { en: 'Capture three pieces in one move', de: 'Schlage drei Steine in einem Zug' },
      icon: 'zap',
    },
    {
      id: 'checkers_beat_hard',
      title: { en: 'Draughts Master', de: 'Dame-Meister' },
      description: { en: 'Beat the Hard AI', de: 'Besiege die schwere KI' },
      icon: 'trophy',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
