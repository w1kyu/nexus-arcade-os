// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.drifter',
  name: { en: 'Void Drifter', de: 'Void Drifter' },
  description: {
    en: 'Vector neon space combat with inertia physics, splitting asteroids, and UFO enemies',
    de: 'Vektor-Neon-Weltraumkampf mit Trägheitsphysik, spaltenden Asteroiden und UFO-Gegnern',
  },
  version: '1.0.0',
  icon: 'rocket',
  category: 'games',
  keywords: ['drifter', 'asteroids', 'arcade', 'vector', 'space', 'shooter'],
  window: { width: 840, height: 680, minWidth: 500, minHeight: 480 },
  permissions: ['intents'],
  commands: [
    {
      id: 'drifter.open',
      title: { en: 'Open Void Drifter', de: 'Void Drifter öffnen' },
      icon: 'rocket',
    },
  ],
  terminal: [
    {
      name: 'drifter',
      description: {
        en: 'Launch Void Drifter vector arcade game',
        de: 'Void Drifter Vektor-Arcade-Spiel starten',
      },
      usage: 'drifter',
    },
  ],
  achievements: [
    {
      id: 'drifter_wave_5',
      title: { en: 'Deep Space Ace', de: 'Tiefenraum-Ass' },
      description: { en: 'Survive and reach Wave 5', de: 'Überlebe und erreiche Welle 5' },
      icon: 'trophy',
    },
    {
      id: 'drifter_score_10k',
      title: { en: 'Void Annihilator', de: 'Void-Vernichter' },
      description: { en: 'Score over 10,000 points in a single run', de: 'Erziele über 10.000 Punkte in einem Lauf' },
      icon: 'star',
      goal: 10000,
    },
    {
      id: 'drifter_powerup',
      title: { en: 'Overcharged', de: 'Überladen' },
      description: { en: 'Collect your first power-up capsule', de: 'Sammle deine erste Power-up-Kapsel' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
