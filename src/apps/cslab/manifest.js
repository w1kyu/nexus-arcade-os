// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.cslab',
  name: { en: 'CS Lab Hub', de: 'Informatik-Labor' },
  description: {
    en: 'Unified portal and learning workspace for algorithms, data structures, automata, digital circuits, and computer architecture',
    de: 'Zentrales Lernportal für Algorithmen, Datenstrukturen, Automaten, Logikschaltungen und Rechnerarchitektur',
  },
  version: '1.0.0',
  icon: 'layers',
  category: 'study',
  keywords: [
    'cslab',
    'computer science',
    'informatik',
    'study',
    'algorithms',
    'data structures',
    'automata',
    'turing',
    'circuits',
    'architecture',
    'sorting',
    'pathfinding',
    'graphs',
  ],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'cslab.open',
      title: { en: 'Open CS Lab Hub', de: 'Informatik-Labor öffnen' },
      icon: 'layers',
    },
  ],
  terminal: [
    {
      name: 'cslab',
      description: {
        en: 'List or launch CS Lab educational tools',
        de: 'Informatik-Tools auflisten oder starten',
      },
      usage: 'cslab [list | open <appId>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
