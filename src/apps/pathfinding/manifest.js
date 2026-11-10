// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.pathfinding',
  name: { en: 'Pathfinding & Maze Lab', de: 'Pfadfindungs- & Labyrinth-Labor' },
  description: {
    en: 'Interactive pathfinding algorithm simulator and maze generator with weighted grids',
    de: 'Interaktiver Simulator für Wegfindungsalgorithmen und Labyrinth-Generator mit gewichteten Gittern',
  },
  version: '1.0.0',
  icon: 'target',
  category: 'study',
  keywords: ['pathfinding', 'maze', 'bfs', 'dfs', 'dijkstra', 'astar', 'grid', 'algorithm', 'graph', 'informatik'],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'pathfinding.open',
      title: { en: 'Open Pathfinding & Maze Lab', de: 'Pfadfindungs-Labor öffnen' },
      icon: 'target',
    },
  ],
  terminal: [
    {
      name: 'pathfind',
      description: {
        en: 'Run pathfinding or open pathfinding lab',
        de: 'Pfadfindung ausführen oder Labor öffnen',
      },
      usage: 'pathfind [bfs|dfs|dijkstra|astar]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
