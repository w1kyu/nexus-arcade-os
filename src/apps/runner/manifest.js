// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.runner',
  name: { en: 'Pixel Runner', de: 'Pixel Runner' },
  description: {
    en: 'Precision neon platformer with 20 levels, tight physics, collectibles, and level editor',
    de: 'Präzisions-Plattformer mit 20 Leveln, agiler Physik, Sammelobjekten und Level-Editor',
  },
  version: '1.0.0',
  icon: 'navigation',
  category: 'games',
  keywords: ['pixel runner', 'platformer', 'jump', 'speedrun', 'coyote', 'editor'],
  window: { width: 800, height: 600, minWidth: 540, minHeight: 460 },
  commands: [{ id: 'runner.open', title: { en: 'Open Pixel Runner', de: 'Pixel Runner öffnen' }, icon: 'navigation' }],
  terminal: [
    {
      name: 'runner',
      description: { en: 'Launch Pixel Runner', de: 'Pixel Runner starten' },
      usage: 'runner',
    },
  ],
  achievements: [
    {
      id: 'runner_first_clear',
      title: { en: 'First Leap', de: 'Erster Sprung' },
      description: { en: 'Clear Level 1 in Pixel Runner', de: 'Schließe Level 1 in Pixel Runner ab' },
      icon: 'star',
    },
    {
      id: 'runner_ten_levels',
      title: { en: 'Acrobatic Momentum', de: 'Akrobatischer Schwung' },
      description: { en: 'Clear 10 levels in Pixel Runner', de: 'Schließe 10 Level in Pixel Runner ab' },
      icon: 'trophy',
    },
    {
      id: 'runner_all_coins',
      title: { en: 'Coin Hoarder', de: 'Münzsammler' },
      description: { en: 'Collect all coins in any level', de: 'Sammle alle Münzen in einem beliebigen Level' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
