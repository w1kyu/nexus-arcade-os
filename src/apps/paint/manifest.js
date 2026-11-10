/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.paint',
  name: { en: 'Nexus Paint', de: 'Nexus Malen' },
  description: {
    en: 'Layered raster painting studio with brushes, flood fill, adjustments and multi-format export',
    de: 'Ebenenbasierte Mal- und Bildbearbeitungs-App mit Pinseln, Füllwerkzeug und Bildfiltern',
  },
  version: '1.0.0',
  icon: 'palette',
  category: 'media',
  keywords: ['paint', 'drawing', 'layers', 'raster', 'image', 'photo', 'sketch', 'malen', 'zeichnen', 'bild'],
  window: { width: 1120, height: 760, minWidth: 680, minHeight: 480 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: [
        'application/vnd.nexus.paint',
        '.npaint',
        'image/png',
        '.png',
        'image/jpeg',
        '.jpg',
        '.jpeg',
        'image/webp',
        '.webp',
      ],
    },
  ],
  commands: [
    { id: 'paint.new', title: { en: 'New painting', de: 'Neues Bild' }, icon: 'palette', shortcut: 'Mod+Alt+P' },
  ],
  terminal: [
    {
      name: 'paint',
      description: { en: 'Open or create layered raster paintings', de: 'Bilder öffnen oder erstellen' },
      usage: 'paint [file.npaint | file.png | file.jpg]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
