// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.clipboard',
  name: { en: 'Clipboard', de: 'Zwischenablage' },
  description: {
    en: 'Clipboard history, pinned clips, and text snippets with variable templates',
    de: 'Zwischenablage-Verlauf, angeheftete Einträge und Textbausteine mit Vorlagenvariablen',
  },
  version: '1.0.0',
  icon: 'clipboard',
  category: 'productivity',
  keywords: [
    'clipboard',
    'history',
    'snippets',
    'copy',
    'paste',
    'pins',
    'zwischenablage',
    'verlauf',
    'textbausteine',
    'kopieren',
  ],
  window: { width: 480, height: 620, minWidth: 360, minHeight: 420 },
  permissions: ['clipboard', 'notifications'],
  storage: {
    version: 1,
    collections: {
      pinned: {
        indexes: {
          at: 'at',
        },
      },
      snippets: {
        indexes: {
          title: 'title',
        },
      },
    },
  },
  commands: [
    {
      id: 'clipboard.clear',
      title: { en: 'Clear Clipboard History', de: 'Zwischenablage leeren' },
      icon: 'trash',
    },
    {
      id: 'clipboard.copyLatest',
      title: { en: 'Copy Most Recent Clip', de: 'Neuesten Eintrag kopieren' },
      icon: 'clipboard',
    },
  ],
  terminal: [
    {
      name: 'clipboard',
      description: {
        en: 'Inspect clipboard history and snippets',
        de: 'Zwischenablage-Verlauf und Textbausteine einsehen',
      },
      usage: 'clipboard [list | clear | copy <id> | snippet <title>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
