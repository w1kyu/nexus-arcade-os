// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.datastructures',
  name: { en: 'Data Structures Visualizer', de: 'Datenstrukturen-Visualisierer' },
  description: {
    en: 'Interactive visualizer for arrays, stacks, queues, BST, AVL trees, heaps, and hash tables',
    de: 'Interaktiver Visualisierer für Arrays, Stapel, Schlangen, BST, AVL-Bäume, Heaps und Hashtabellen',
  },
  version: '1.0.0',
  icon: 'layers',
  category: 'study',
  keywords: ['data structures', 'array', 'stack', 'queue', 'tree', 'avl', 'bst', 'heap', 'hash', 'trie', 'informatik'],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'datastructures.open',
      title: { en: 'Open Data Structures Visualizer', de: 'Datenstrukturen-Labor öffnen' },
      icon: 'layers',
    },
  ],
  terminal: [
    {
      name: 'ds',
      description: {
        en: 'Inspect data structures or open visualizer',
        de: 'Datenstrukturen untersuchen oder Visualisierer öffnen',
      },
      usage: 'ds [tree|avl|heap|array|hash]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
