/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.write',
  name: { en: 'Nexus Write', de: 'Nexus Dokumente' },
  description: {
    en: 'Professional document processor with page layout, rich text, outline, templates and print export',
    de: 'Professionelle Textverarbeitung mit Seitenlayout, Rich-Text, Gliederung, Vorlagen und Druckexport',
  },
  version: '1.0.0',
  icon: 'file-text',
  category: 'office',
  keywords: ['write', 'documents', 'word', 'docs', 'text', 'editor', 'dokumente', 'schreiben', 'brief'],
  window: { width: 1060, height: 740, minWidth: 640, minHeight: 450 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.doc', '.ndoc', 'text/markdown', '.md', 'text/html', '.html', 'text/plain', '.txt'],
    },
  ],
  commands: [
    { id: 'write.new', title: { en: 'New document', de: 'Neues Dokument' }, icon: 'file-text', shortcut: 'Mod+Alt+W' },
  ],
  terminal: [
    {
      name: 'write',
      description: { en: 'Open or create documents', de: 'Dokumente öffnen oder erstellen' },
      usage: 'write [file.ndoc | file.md | file.html]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
