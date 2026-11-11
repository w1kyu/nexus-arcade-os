// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.minesweeper',
  name: { en: 'Minesweeper', de: 'Minesweeper' },
  description: {
    en: 'Tactical mine clearance with safe first click opening, chording, and custom grid sizes',
    de: 'Taktische Minenräumung mit sicherem ersten Klick, Akkord-Klicks und flexiblen Rastergrößen',
  },
  version: '1.0.0',
  icon: 'target',
  category: 'games',
  keywords: ['minesweeper', 'puzzle', 'mines', 'logic', 'retro'],
  window: { width: 620, height: 600, minWidth: 400, minHeight: 440 },
  permissions: ['intents'],
  commands: [
    {
      id: 'minesweeper.open',
      title: { en: 'Open Minesweeper', de: 'Minesweeper öffnen' },
      icon: 'target',
    },
  ],
  terminal: [
    {
      name: 'minesweeper',
      description: {
        en: 'Launch Minesweeper arcade game',
        de: 'Minesweeper Arcade-Spiel starten',
      },
      usage: 'minesweeper',
    },
  ],
  achievements: [
    {
      id: 'minesweeper_win_beginner',
      title: { en: 'Recruit Sweeper', de: 'Minen-Rekrut' },
      description: { en: 'Clear a Beginner minefield', de: 'Räume ein Anfänger-Minenfeld' },
      icon: 'star',
    },
    {
      id: 'minesweeper_win_intermediate',
      title: { en: 'Field Officer', de: 'Feld-Offizier' },
      description: { en: 'Clear an Intermediate minefield', de: 'Räume ein Fortgeschrittenen-Minenfeld' },
      icon: 'trophy',
    },
    {
      id: 'minesweeper_win_expert',
      title: { en: 'Bomb Technician', de: 'Bombenentschärfer' },
      description: { en: 'Conquer the 99-mine Expert field', de: 'Meistere das 99-Minen Expertenfeld' },
      icon: 'trophy',
    },
    {
      id: 'minesweeper_chord_clear',
      title: { en: 'Harmonic Sweep', de: 'Harmonischer Schwung' },
      description: { en: 'Execute a successful chord reveal', de: 'Führe ein erfolgreiches Akkord-Aufdecken aus' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
