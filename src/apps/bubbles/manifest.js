// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.bubbles',
  name: { en: 'Bubble Shooter', de: 'Bubble Shooter' },
  description: {
    en: 'Aim and bank-shot trajectory bubble shooter with hexagonal color clusters and cascades',
    de: 'Bubble-Shooter mit Bandenschuss-Physik, hexagonalen Farb-Clustern und Kaskaden',
  },
  version: '1.0.0',
  icon: 'target',
  category: 'games',
  keywords: ['bubble', 'shooter', 'aim', 'bounce', 'bankshot', 'arcade'],
  window: { width: 560, height: 680, minWidth: 400, minHeight: 480 },
  commands: [{ id: 'bubbles.open', title: { en: 'Open Bubble Shooter', de: 'Bubble Shooter öffnen' }, icon: 'target' }],
  terminal: [
    {
      name: 'bubbles',
      description: { en: 'Launch Bubble Shooter', de: 'Bubble Shooter starten' },
      usage: 'bubbles',
    },
  ],
  achievements: [
    {
      id: 'bubbles_first_win',
      title: { en: 'Ceiling Cleaner', de: 'Deckensäuberer' },
      description: { en: 'Clear all bubbles in Level 1', de: 'Räume alle Blasen in Level 1 ab' },
      icon: 'star',
    },
    {
      id: 'bubbles_cascade_drop',
      title: { en: 'Avalanche', de: 'Lawine' },
      description: {
        en: 'Drop 10+ floating bubbles with a single shot',
        de: 'Bringe 10+ schwebende Blasen mit einem Schuss zum Absturz',
      },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
