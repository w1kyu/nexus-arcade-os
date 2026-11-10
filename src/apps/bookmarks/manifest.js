// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.bookmarks',
  name: { en: 'Bookmarks', de: 'Lesezeichen' },
  description: {
    en: 'Organize bookmark collections, tags, reading list with read/unread tracking, and browser HTML import/export',
    de: 'Lesezeichen-Sammlungen, Tags, Leseliste mit Gelesen-Status und Browser-HTML Import/Export',
  },
  version: '1.0.0',
  icon: 'bookmark',
  category: 'productivity',
  keywords: ['bookmarks', 'lesezeichen', 'favorites', 'reading', 'readlater', 'links', 'html'],
  window: { width: 920, height: 640, minWidth: 500, minHeight: 400, singleInstance: false },
  permissions: ['clipboard'],
  storage: {
    version: 1,
    collections: {
      bookmarks: {
        indexes: {
          collection: 'collection',
          url: 'url',
        },
      },
    },
  },
  commands: [
    {
      id: 'bookmarks.new',
      title: { en: 'New Bookmark', de: 'Neues Lesezeichen' },
      icon: 'bookmark',
    },
  ],
  terminal: [
    {
      name: 'bookmarks',
      description: {
        en: 'Inspect bookmarks and reading list',
        de: 'Lesezeichen und Leseliste einsehen',
      },
      usage: 'bookmarks [list | reading | add <url> <title>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
