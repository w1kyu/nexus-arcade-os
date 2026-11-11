// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.pong',
  name: { en: 'Neon Pong', de: 'Neon Pong' },
  description: {
    en: 'High-velocity cyber table tennis with spin dynamics, power-ups, and AI or 2-player modes',
    de: 'Cyber-Tischtennis mit Spin-Physik, Power-ups sowie KI- und 2-Spieler-Modus',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['pong', 'arcade', 'retro', 'table tennis', '2player', 'sports'],
  window: { width: 840, height: 600, minWidth: 480, minHeight: 400 },
  permissions: ['intents'],
  commands: [
    {
      id: 'pong.open',
      title: { en: 'Open Neon Pong', de: 'Neon Pong öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'pong',
      description: {
        en: 'Launch Neon Pong arcade game',
        de: 'Neon Pong Arcade-Spiel starten',
      },
      usage: 'pong',
    },
  ],
  achievements: [
    {
      id: 'pong_win_match',
      title: { en: 'Court Champion', de: 'Platz-Champion' },
      description: { en: 'Win a first-to-11 Pong match', de: 'Gewinne ein Pong-Match bis 11' },
      icon: 'trophy',
    },
    {
      id: 'pong_beat_master',
      title: { en: 'Master Slayer', de: 'Meister-Bezwinger' },
      description: { en: 'Defeat Master AI difficulty', de: 'Besiege die KI auf Meister-Schwierigkeit' },
      icon: 'star',
    },
    {
      id: 'pong_rally_20',
      title: { en: 'Endless Volley', de: 'Endloser Ballwechsel' },
      description: {
        en: 'Achieve a rally streak of 20 or more hits',
        de: 'Erreiche einen Ballwechsel von mindestens 20 Schlägen',
      },
      icon: 'sparkles',
    },
    {
      id: 'pong_powerup_master',
      title: { en: 'Power Surge', de: 'Kraftschub' },
      description: { en: 'Activate a Neon Pong power-up capsule', de: 'Aktiviere eine Neon Pong Power-up-Kapsel' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
