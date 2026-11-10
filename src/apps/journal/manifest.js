// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.journal',
  name: { en: 'Journal', de: 'Tagebuch' },
  description: {
    en: 'Daily personal journal with mood tracking, VFS photos, "On this day", writing prompts, and AES-GCM password encryption',
    de: 'Tägliches Journal mit Stimmungstracker, VFS-Fotos, "An diesem Tag", Schreibimpulsen und AES-GCM Passwort-Verschlüsselung',
  },
  version: '1.0.0',
  icon: 'book',
  category: 'productivity',
  keywords: ['journal', 'diary', 'tagebuch', 'mood', 'stimmung', 'daily', 'notes', 'encryption'],
  window: { width: 1040, height: 700, minWidth: 600, minHeight: 450, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'clipboard', 'system'],
  storage: {
    version: 1,
    collections: {
      entries: {
        indexes: {
          date: 'date',
          mood: 'mood',
        },
      },
      config: {
        indexes: {},
      },
    },
  },
  commands: [
    {
      id: 'journal.new',
      title: { en: 'New journal entry', de: 'Neuer Tagebucheintrag' },
      icon: 'book',
    },
    {
      id: 'journal.lock',
      title: { en: 'Lock journal', de: 'Tagebuch sperren' },
      icon: 'lock',
    },
  ],
  terminal: [
    {
      name: 'journal',
      description: {
        en: 'Write or inspect journal entries',
        de: 'Tagebucheinträge ansehen oder verfassen',
      },
      usage: 'journal [today | list | mood <1-5> | onthisday]',
    },
  ],
  widgets: [
    {
      id: 'journal-widget',
      title: { en: 'Daily Journal & Mood', de: 'Tagebuch & Stimmung' },
      icon: 'book',
      size: [2, 2],
      minSize: [2, 1],
      load: () => import('./widget.js'),
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
