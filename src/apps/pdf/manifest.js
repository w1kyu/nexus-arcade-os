/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.pdf',
  name: { en: 'PDF Tools', de: 'PDF-Werkzeuge' },
  description: {
    en: 'View PDF files and combine scanned documents or photos into multi-page PDFs',
    de: 'PDF-Dateien anzeigen und gescannte Dokumente oder Fotos zu mehrseitigen PDFs kombinieren',
  },
  version: '1.0.0',
  icon: 'file-text',
  category: 'office',
  keywords: ['pdf', 'document', 'scanner', 'combine', 'reader', 'viewer', 'merge', 'print'],
  window: { width: 1080, height: 740, minWidth: 640, minHeight: 460 },
  permissions: ['vfs', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/pdf', '.pdf', 'image/png', '.png', 'image/jpeg', '.jpg', '.jpeg', 'image/webp', '.webp'],
    },
  ],
  commands: [
    {
      id: 'pdf.open',
      title: { en: 'Open PDF', de: 'PDF öffnen' },
      icon: 'file-text',
      shortcut: 'Mod+Alt+D',
    },
  ],
  terminal: [
    {
      name: 'pdf',
      description: { en: 'Open or combine documents into PDF', de: 'Dokumente anzeigen oder zu PDF zusammenfügen' },
      usage: 'pdf [file.pdf | image1.jpg ...]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
