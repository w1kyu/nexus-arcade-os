// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.invaders',
  name: { en: 'Grid Invaders', de: 'Grid Invaders' },
  description: {
    en: 'Vector fixed-shooter with descending alien formations, bunker shields, and boss waves',
    de: 'Vektor-Shooter mit herabsinkenden Alien-Formationen, Bunkerschilden und Boss-Wellen',
  },
  version: '1.0.0',
  icon: 'zap',
  category: 'games',
  keywords: ['invaders', 'space', 'shooter', 'arcade', 'retro', 'aliens'],
  window: { width: 840, height: 680, minWidth: 500, minHeight: 480 },
  commands: [{ id: 'invaders.open', title: { en: 'Open Grid Invaders', de: 'Grid Invaders öffnen' }, icon: 'zap' }],
  terminal: [
    {
      name: 'invaders',
      description: { en: 'Launch Grid Invaders game', de: 'Grid Invaders Spiel starten' },
      usage: 'invaders',
    },
  ],
  achievements: [
    {
      id: 'invaders_wave_5',
      title: { en: 'Invasion Defense', de: 'Invasions-Abwehr' },
      description: { en: 'Reach Wave 5 in Grid Invaders', de: 'Erreiche Welle 5 in Grid Invaders' },
      icon: 'star',
    },
    {
      id: 'invaders_boss_slayer',
      title: { en: 'Mothership Down', de: 'Mutterschiff zerstört' },
      description: { en: 'Defeat a massive Boss wave', de: 'Besiege eine gewaltige Boss-Welle' },
      icon: 'trophy',
    },
    {
      id: 'invaders_shield_keeper',
      title: { en: 'Aegis Unbroken', de: 'Ungebrochene Ägis' },
      description: {
        en: 'Clear a wave with all bunker shields intact',
        de: 'Beende eine Welle mit allen Bunkern intakt',
      },
      icon: 'sparkles',
    },
    {
      id: 'invaders_score_10k',
      title: { en: 'Alien Exterminator', de: 'Alien-Vernichter' },
      description: { en: 'Score 10,000 points in a single run', de: 'Erziele 10.000 Punkte in einem Lauf' },
      icon: 'target',
      goal: 10000,
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
