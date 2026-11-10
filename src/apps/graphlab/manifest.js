// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.graphlab',
  name: { en: 'Graph Editor & Algorithms', de: 'Graphen-Editor & Algorithmen' },
  description: {
    en: 'Interactive graph visualizer, editor, and algorithm simulator with BFS, DFS, Dijkstra, and MST',
    de: 'Interaktiver Graphen-Visualisierer, Editor und Algorithmen-Simulator mit BFS, DFS, Dijkstra und MST',
  },
  version: '1.0.0',
  icon: 'share',
  category: 'study',
  keywords: [
    'graph',
    'dijkstra',
    'bfs',
    'dfs',
    'mst',
    'kruskal',
    'prim',
    'topological',
    'network',
    'tree',
    'informatik',
  ],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'graphlab.open',
      title: { en: 'Open Graph Editor & Algorithms', de: 'Graphen-Labor öffnen' },
      icon: 'share',
    },
  ],
  terminal: [
    {
      name: 'graph',
      description: {
        en: 'Inspect graph algorithms or open graph lab',
        de: 'Graphen-Algorithmen untersuchen oder Labor öffnen',
      },
      usage: 'graph [bfs|dfs|dijkstra|mst]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
