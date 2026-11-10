/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.whiteboard',
  name: { en: 'Nexus Whiteboard', de: 'Nexus Whiteboard' },
  description: {
    en: 'Infinite canvas with freehand drawing, shapes, sticky notes, connectors and export',
    de: 'Unendliche Leinwand mit Freihandzeichnung, Formen, Haftnotizen, Verbindern und Export',
  },
  version: '1.0.0',
  icon: 'layers',
  category: 'office',
  keywords: ['whiteboard', 'canvas', 'sketch', 'draw', 'diagram', 'sticky', 'notes', 'zeichnen', 'diagramm'],
  window: { width: 1100, height: 750, minWidth: 640, minHeight: 450 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.board', '.nboard', 'image/svg+xml', '.svg'],
    },
  ],
  commands: [
    {
      id: 'whiteboard.new',
      title: { en: 'New whiteboard', de: 'Neues Whiteboard' },
      icon: 'layers',
      shortcut: 'Mod+Alt+B',
    },
  ],
  terminal: [
    {
      name: 'whiteboard',
      description: { en: 'Open or create whiteboards', de: 'Whiteboards öffnen oder erstellen' },
      usage: 'whiteboard [file.nboard]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
