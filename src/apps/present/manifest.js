/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.present',
  name: { en: 'Nexus Present', de: 'Nexus Präsentationen' },
  description: {
    en: 'Markdown slide deck editor and presenter with speaker notes, themes and HTML export',
    de: 'Markdown-Präsentationsprogramm mit Referentenansicht, Folien-Themes und HTML-Export',
  },
  version: '1.0.0',
  icon: 'presentation',
  category: 'office',
  keywords: ['presentation', 'slides', 'presenter', 'keynote', 'deck', 'markdown', 'talk', 'folien', 'vortrag'],
  window: { width: 1140, height: 760, minWidth: 680, minHeight: 480 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.present', '.npresent', 'text/markdown', '.md'],
    },
  ],
  commands: [
    {
      id: 'present.new',
      title: { en: 'New presentation', de: 'Neue Präsentation' },
      icon: 'presentation',
      shortcut: 'Mod+Alt+S',
    },
  ],
  terminal: [
    {
      name: 'present',
      description: { en: 'Open or present markdown slide decks', de: 'Folien-Präsentationen öffnen oder vorführen' },
      usage: 'present [file.md | file.npresent]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
