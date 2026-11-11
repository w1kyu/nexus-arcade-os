// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.solitaire',
  name: { en: 'Solitaire Collection', de: 'Solitaire-Sammlung' },
  description: {
    en: 'Klondike, Spider, and FreeCell solitaire with infinite undo, solvable deals, and auto-complete',
    de: 'Klondike, Spider und FreeCell Solitaire mit unbegrenztem Rückgängigmachen, lösbaren Spielen und Auto-Vervollständigung',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['solitaire', 'patience', 'klondike', 'freecell', 'spider', 'cards'],
  window: { width: 920, height: 740, minWidth: 540, minHeight: 500 },
  commands: [{ id: 'solitaire.open', title: { en: 'Open Solitaire', de: 'Solitaire öffnen' }, icon: 'gamepad' }],
  terminal: [
    {
      name: 'solitaire',
      description: { en: 'Launch Solitaire Collection', de: 'Solitaire-Sammlung starten' },
      usage: 'solitaire',
    },
  ],
  achievements: [
    {
      id: 'solitaire_first_win',
      title: { en: 'Card Sharp', de: 'Kartenvirtuose' },
      description: { en: 'Clear any solitaire deal', de: 'Löse ein beliebiges Solitaire-Spiel' },
      icon: 'star',
    },
    {
      id: 'solitaire_freecell_win',
      title: { en: 'FreeCell Strategist', de: 'FreeCell-Stratege' },
      description: { en: 'Win a game of FreeCell', de: 'Gewinne ein FreeCell-Spiel' },
      icon: 'trophy',
    },
    {
      id: 'solitaire_spider_win',
      title: { en: 'Web Weaver', de: 'Netzweber' },
      description: { en: 'Clear a Spider solitaire deal', de: 'Gewinne ein Spider Solitaire-Spiel' },
      icon: 'sparkles',
    },
    {
      id: 'solitaire_fast_win',
      title: { en: 'Swift Patience', de: 'Schnelle Geduld' },
      description: { en: 'Win a deal in under 3 minutes', de: 'Gewinne ein Spiel in unter 3 Minuten' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
