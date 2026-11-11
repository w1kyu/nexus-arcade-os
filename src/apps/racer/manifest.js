// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.racer',
  name: { en: 'Neon Racer', de: 'Neon Racer' },
  description: {
    en: 'Top-down neon racing with tracks, AI opponents, lap times, and ghost replay',
    de: 'Top-Down-Neon-Rennspiel mit Rennstrecken, KI-Gegnern, Rundenzeiten und Geist-Replay',
  },
  version: '1.0.0',
  icon: 'navigation',
  category: 'games',
  keywords: ['neon racer', 'racing', 'car', 'drift', 'ghost', 'arcade'],
  window: { width: 840, height: 660, minWidth: 540, minHeight: 460 },
  commands: [{ id: 'racer.open', title: { en: 'Open Neon Racer', de: 'Neon Racer öffnen' }, icon: 'navigation' }],
  terminal: [
    {
      name: 'racer',
      description: { en: 'Launch Neon Racer', de: 'Neon Racer starten' },
      usage: 'racer',
    },
  ],
  achievements: [
    {
      id: 'racer_first_win',
      title: { en: 'Pole Position', de: 'Pole Position' },
      description: { en: 'Finish 1st in a race against AI opponents', de: 'Gewinne ein Rennen gegen die KI-Gegner' },
      icon: 'trophy',
    },
    {
      id: 'racer_sub_30',
      title: { en: 'Speed Demon', de: 'Geschwindigkeitsdämon' },
      description: { en: 'Complete a lap in under 30 seconds', de: 'Beende eine Runde in unter 30 Sekunden' },
      icon: 'zap',
    },
    {
      id: 'racer_drift_master',
      title: { en: 'Tokyo Neon', de: 'Tokyo Neon' },
      description: { en: 'Accumulate 5 seconds of total drift time', de: 'Sammle 5 Sekunden Driftzeit' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
