/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.pixelart',
  name: { en: 'Pixel Art Studio', de: 'Pixel-Art-Studio' },
  description: {
    en: 'Retro sprite editor and animation studio with onion skinning, retro palettes and GIF export',
    de: 'Retro-Sprite-Editor und Animationsstudio mit Zwiebelhaut-Vorschau, Retro-Farbpaletten und GIF-Export',
  },
  version: '1.0.0',
  icon: 'sparkles',
  category: 'media',
  keywords: ['pixel', 'art', 'sprite', 'animation', 'gif', 'retro', 'pico8', 'gameboy', '8bit', 'pixelart'],
  window: { width: 1080, height: 720, minWidth: 640, minHeight: 460 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.pixelart', '.npixel', 'image/gif', '.gif'],
    },
  ],
  commands: [
    {
      id: 'pixelart.new',
      title: { en: 'New Pixel Art', de: 'Neue Pixel-Grafik' },
      icon: 'sparkles',
      shortcut: 'Mod+Alt+X',
    },
  ],
  terminal: [
    {
      name: 'pixelart',
      description: { en: 'Open or create pixel art animations', de: 'Pixel-Grafiken öffnen oder erstellen' },
      usage: 'pixelart [file.npixel]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
