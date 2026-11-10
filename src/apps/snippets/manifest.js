// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.snippets',
  name: { en: 'Snippet Manager', de: 'Snippet-Manager' },
  description: {
    en: 'Organize, search, and copy code snippets with syntax highlighting and IDE insertion',
    de: 'Code-Snippets organisieren, durchsuchen und kopieren mit Syntax-Highlighting und IDE-Einfügen',
  },
  version: '1.0.0',
  icon: 'file-code',
  category: 'dev',
  keywords: ['snippets', 'code', 'snippet', 'gist', 'templates', 'syntax', 'paste', 'developer', 'schnipsel'],
  window: { width: 960, height: 640, minWidth: 540, minHeight: 380 },
  permissions: ['clipboard', 'vfs', 'intents'],
  storage: {
    version: 1,
    collections: {
      snippets: { indexes: { title: 'string', language: 'string', folder: 'string' } },
    },
  },
  commands: [
    { id: 'snippets.open', title: { en: 'Open Snippet Manager', de: 'Snippet-Manager öffnen' }, icon: 'file-code' },
    { id: 'snippets.new', title: { en: 'New Code Snippet', de: 'Neues Code-Snippet' }, icon: 'file-plus' },
  ],
  terminal: [
    {
      name: 'snippet',
      description: { en: 'Search or print a code snippet', de: 'Ein Code-Snippet suchen oder ausgeben' },
      usage: 'snippet [name]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
