// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.battleships',
  name: { en: 'Battleships', de: 'Schiffe versenken' },
  description: {
    en: 'Naval grid warfare against probability-density AI with fleet placement editor',
    de: 'Seekriegsführung gegen Wahrscheinlichkeits-KI mit Flotten-Platzierungseditor',
  },
  version: '1.0.0',
  icon: 'target',
  category: 'games',
  keywords: ['battleships', 'naval', 'strategy', 'grid', 'radar', 'fleet', 'warfare'],
  window: { width: 880, height: 680, minWidth: 480, minHeight: 520 },
  commands: [
    { id: 'battleships.open', title: { en: 'Open Battleships', de: 'Schiffe versenken öffnen' }, icon: 'target' },
  ],
  terminal: [
    {
      name: 'battleships',
      description: { en: 'Launch Battleships game', de: 'Schiffe versenken starten' },
      usage: 'battleships',
    },
  ],
  achievements: [
    {
      id: 'battleships_first_win',
      title: { en: 'Naval Supremacy', de: 'Seeherrschaft' },
      description: { en: 'Sink the entire enemy fleet', de: 'Versenke die gesamte feindliche Flotte' },
      icon: 'trophy',
    },
    {
      id: 'battleships_flawless',
      title: { en: 'Flawless Armada', de: 'Makellose Armada' },
      description: { en: 'Win without losing a single ship', de: 'Gewinne ohne ein einziges Schiff zu verlieren' },
      icon: 'sparkles',
    },
    {
      id: 'battleships_sniper',
      title: { en: 'Precision Gunner', de: 'Präzisions-Schütze' },
      description: {
        en: 'Win a battle with 60% or higher accuracy',
        de: 'Gewinne ein Gefecht mit mindestens 60% Trefferquote',
      },
      icon: 'target',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
