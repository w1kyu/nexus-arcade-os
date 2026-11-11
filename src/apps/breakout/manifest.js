// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.breakout',
  name: { en: 'Breakout Nexus', de: 'Breakout Nexus' },
  description: {
    en: 'Continuous collision ball physics, 30 handcrafted levels, and integrated level editor',
    de: 'Kontinuierliche Ballphysik, 30 handgefertigte Level und integrierter Level-Editor',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['breakout', 'brick', 'ball', 'arcade', 'retro', 'editor'],
  window: { width: 720, height: 780, minWidth: 480, minHeight: 480 },
  permissions: ['vfs', 'intents'],
  commands: [
    {
      id: 'breakout.open',
      title: { en: 'Open Breakout Nexus', de: 'Breakout Nexus öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'breakout',
      description: {
        en: 'Launch Breakout Nexus arcade game',
        de: 'Breakout Nexus Arcade-Spiel starten',
      },
      usage: 'breakout',
    },
  ],
  achievements: [
    {
      id: 'breakout_first_block',
      title: { en: 'Brick Breaker', de: 'Steinbrecher' },
      description: { en: 'Destroy your first block in Breakout', de: 'Zerstöre deinen ersten Block in Breakout' },
      icon: 'star',
    },
    {
      id: 'breakout_level_5',
      title: { en: 'Rising Challenger', de: 'Aufstrebender Herausforderer' },
      description: { en: 'Complete 5 levels in Breakout campaign', de: 'Schließe 5 Level der Breakout-Kampagne ab' },
      icon: 'trophy',
      goal: 5,
    },
    {
      id: 'breakout_level_30',
      title: { en: 'Grand Champion', de: 'Großmeister' },
      description: {
        en: 'Conquer all 30 handcrafted Breakout levels',
        de: 'Meistere alle 30 handgefertigten Breakout-Level',
      },
      icon: 'trophy',
      goal: 30,
    },
    {
      id: 'breakout_score_5000',
      title: { en: 'High Roller', de: 'High Roller' },
      description: { en: 'Score over 5,000 points in Breakout', de: 'Erziele über 5.000 Punkte in Breakout' },
      icon: 'trophy',
      goal: 5000,
    },
    {
      id: 'breakout_multiball_master',
      title: { en: 'Multi-Ball Mayhem', de: 'Multiball-Chaos' },
      description: {
        en: 'Control 5 or more active balls at once',
        de: 'Kontrolliere 5 oder mehr aktive Bälle gleichzeitig',
      },
      icon: 'star',
      secret: true,
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
