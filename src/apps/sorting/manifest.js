// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.sorting',
  name: { en: 'Sorting Visualizer', de: 'Sortier-Visualisierer' },
  description: {
    en: 'Interactive sorting algorithm visualizer with sound, race mode, and complexity analysis',
    de: 'Interaktiver Visualisierer für Sortieralgorithmen mit Ton, Wettrennen und Komplexitätsanalyse',
  },
  version: '1.0.0',
  icon: 'sort',
  category: 'study',
  keywords: [
    'sort',
    'sorting',
    'algorithm',
    'bubble',
    'quick',
    'merge',
    'heap',
    'radix',
    'visualizer',
    'informatik',
    'cs',
  ],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'sorting.open',
      title: { en: 'Open Sorting Visualizer', de: 'Sortier-Visualisierer öffnen' },
      icon: 'sort',
    },
  ],
  terminal: [
    {
      name: 'sort',
      description: {
        en: 'Sort numbers or launch sorting visualizer',
        de: 'Zahlen sortieren oder Sortier-Visualisierer starten',
      },
      usage: 'sort [algorithm] [numbers...]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
