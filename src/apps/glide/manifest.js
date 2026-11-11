// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.glide',
  name: { en: 'Neon Glide', de: 'Neon Glide' },
  description: {
    en: 'One-button flight with inertia physics, procedurally generated neon obstacles, and ghost replay',
    de: 'Ein-Tasten-Flugspiel mit Trägheitsphysik, prozedural generierten Neon-Hindernissen und Geist-Wiederholung',
  },
  version: '1.0.0',
  icon: 'navigation',
  category: 'games',
  keywords: ['glide', 'flyer', 'flappy', 'arcade', 'neon', 'synthwave', 'onebutton'],
  window: { width: 840, height: 680, minWidth: 480, minHeight: 460 },
  commands: [{ id: 'glide.open', title: { en: 'Open Neon Glide', de: 'Neon Glide öffnen' }, icon: 'navigation' }],
  terminal: [
    {
      name: 'glide',
      description: { en: 'Launch Neon Glide game', de: 'Neon Glide Spiel starten' },
      usage: 'glide',
    },
  ],
  achievements: [
    {
      id: 'glide_pass_10',
      title: { en: 'Neon Aviator', de: 'Neon-Flieger' },
      description: { en: 'Glide through 10 neon obstacle gates', de: 'Gleite durch 10 Neon-Hindernistore' },
      icon: 'star',
    },
    {
      id: 'glide_pass_50',
      title: { en: 'Vapor Wave Rider', de: 'Vaporwave-Reiter' },
      description: { en: 'Glide through 50 neon obstacle gates', de: 'Gleite durch 50 Neon-Hindernistore' },
      icon: 'trophy',
    },
    {
      id: 'glide_beat_ghost',
      title: { en: 'Ghost Buster', de: 'Geisterjäger' },
      description: {
        en: 'Out-glide your previous personal best ghost replay',
        de: 'Übertreffe die Geist-Wiederholung deiner persönlichen Bestleistung',
      },
      icon: 'sparkles',
    },
    {
      id: 'glide_score_2k',
      title: { en: 'Horizon Breaker', de: 'Horizont-Brecher' },
      description: { en: 'Score over 2,000 points in a single run', de: 'Erziele über 2.000 Punkte in einem Lauf' },
      icon: 'zap',
      goal: 2000,
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
