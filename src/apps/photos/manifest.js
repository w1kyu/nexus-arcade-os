// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.photos',
  name: { en: 'Nexus Photos', de: 'Nexus Fotos' },
  description: {
    en: 'Local photo gallery, EXIF metadata inspector, lightbox viewer and photo editor with privacy redaction',
    de: 'Lokale Fotogalerie, EXIF-Metadaten-Inspektor, Lightbox-Betrachter und Foto-Editor mit Zensurpinsel',
  },
  version: '1.0.0',
  icon: 'image',
  category: 'media',
  keywords: ['photos', 'gallery', 'exif', 'viewer', 'image', 'crop', 'filters', 'rotate', 'fotos', 'bilder'],
  window: { width: 1080, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['vfs', 'notifications', 'intents'],
  storage: {
    version: 1,
    collections: {
      photos: { indexes: {} },
    },
  },
  handles: [
    {
      action: 'open',
      types: [
        'image/jpeg',
        '.jpg',
        '.jpeg',
        'image/png',
        '.png',
        'image/webp',
        '.webp',
        'image/gif',
        '.gif',
        'image/svg+xml',
        '.svg',
        'image/bmp',
        '.bmp',
      ],
    },
  ],
  commands: [{ id: 'photos.slideshow', title: { en: 'Start Slideshow', de: 'Diashow starten' }, icon: 'play' }],
  terminal: [
    {
      name: 'photos',
      description: { en: 'Open photos gallery or inspect image EXIF', de: 'Fotogalerie öffnen oder Bild-EXIF prüfen' },
      usage: 'photos [path/to/image.jpg]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
