// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.blockfall',
  name: { en: 'Blockfall', de: 'Blockfall' },
  description: {
    en: 'Super Rotation falling-blocks puzzle with ghost projection, hold piece, and 4 game modes',
    de: 'Blockstapel-Puzzlespiel mit Super Rotation, Schatten-Vorschau, Haltespeicher und 4 Spielmodi',
  },
  version: '1.0.0',
  icon: 'select-box',
  category: 'games',
  keywords: ['blockfall', 'tetris', 'blocks', 'arcade', 'puzzle', 'srs'],
  window: { width: 680, height: 720, minWidth: 480, minHeight: 520 },
  permissions: ['intents'],
  commands: [
    {
      id: 'blockfall.open',
      title: { en: 'Open Blockfall', de: 'Blockfall öffnen' },
      icon: 'select-box',
    },
  ],
  terminal: [
    {
      name: 'blockfall',
      description: {
        en: 'Launch Blockfall arcade puzzle game',
        de: 'Blockfall Arcade-Puzzlespiel starten',
      },
      usage: 'blockfall',
    },
  ],
  achievements: [
    {
      id: 'blockfall_quad_clear',
      title: { en: 'Tetra Cleanse', de: 'Vierer-Treffer' },
      description: { en: 'Clear 4 lines at once in a single drop', de: 'Räume 4 Reihen auf einmal mit einem Stein ab' },
      icon: 'trophy',
    },
    {
      id: 'blockfall_sprint_40',
      title: { en: 'Speed Demon', de: 'Geschwindigkeitsdämon' },
      description: { en: 'Clear 40 lines in Sprint mode', de: 'Räume 40 Reihen im Sprint-Modus ab' },
      icon: 'star',
    },
    {
      id: 'blockfall_tspin',
      title: { en: 'Quantum Twist', de: 'Quantendrehung' },
      description: { en: 'Successfully execute a T-Spin move', de: 'Führe erfolgreich eine T-Spin-Drehung aus' },
      icon: 'sparkles',
    },
    {
      id: 'blockfall_score_50k',
      title: { en: 'Grandmaster', de: 'Großmeister' },
      description: { en: 'Reach 50,000 points in Marathon mode', de: 'Erreiche 50.000 Punkte im Marathon-Modus' },
      icon: 'trophy',
      goal: 50000,
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
