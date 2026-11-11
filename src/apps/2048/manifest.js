// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.2048',
  name: { en: '2048 Cyber', de: '2048 Cyber' },
  description: {
    en: 'The classic 2048 sliding puzzle with undo, multiple board sizes, and post-2048 endless mode',
    de: 'Das klassische 2048-Schiebepuzzle mit Rückgängig-Funktion, variablen Spielfeldgrößen und Endlosmodus',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['2048', 'puzzle', 'math', 'numbers', 'sliding', 'brain'],
  window: { width: 560, height: 680, minWidth: 380, minHeight: 480 },
  permissions: ['intents'],
  commands: [
    {
      id: '2048.open',
      title: { en: 'Open 2048 Cyber', de: '2048 Cyber öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'play2048',
      description: {
        en: 'Launch 2048 sliding puzzle game',
        de: '2048 Schiebepuzzle-Spiel starten',
      },
      usage: 'play2048',
    },
  ],
  achievements: [
    {
      id: '2048_first_merge',
      title: { en: 'Binary Fusion', de: 'Binäre Fusion' },
      description: { en: 'Merge two identical tiles in 2048', de: 'Verschmelze zwei identische Kacheln in 2048' },
      icon: 'star',
    },
    {
      id: '2048_reach_512',
      title: { en: 'Half Kilobyte', de: 'Halbes Kilobyte' },
      description: { en: 'Reach the 512 tile', de: 'Erreiche die 512er-Kachel' },
      icon: 'star',
    },
    {
      id: '2048_reach_2048',
      title: { en: 'Singularity 2048', de: 'Singularität 2048' },
      description: { en: 'Form the legendary 2048 tile', de: 'Erschaffe die legendäre 2048-Kachel' },
      icon: 'trophy',
    },
    {
      id: '2048_reach_4096',
      title: { en: 'Beyond Infinity', de: 'Jenseits der Unendlichkeit' },
      description: { en: 'Transcend 2048 and create a 4096 tile', de: 'Überschreite 2048 und bilde eine 4096-Kachel' },
      icon: 'trophy',
      secret: true,
    },
    {
      id: '2048_undo_master',
      title: { en: 'Time Traveler', de: 'Zeitreisender' },
      description: {
        en: 'Use undo to step back and rethink a move',
        de: 'Nutze Rückgängig, um einen Zug zu korrigieren',
      },
      icon: 'undo',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
