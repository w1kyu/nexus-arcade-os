// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.colorlab',
  name: { en: 'Color Laboratory', de: 'Farblabor' },
  description: {
    en: 'Color converter, palette generator, WCAG contrast checker, color blindness simulator and gradient builder',
    de: 'Farbkonverter, Palettengenerator, WCAG-Kontrastrechner, Farbfehlsichtigkeits-Simulator und Verlaufs-Editor',
  },
  version: '1.0.0',
  icon: 'palette',
  category: 'dev',
  keywords: [
    'color',
    'colour',
    'palette',
    'contrast',
    'wcag',
    'hex',
    'rgb',
    'hsl',
    'oklch',
    'cmyk',
    'gradient',
    'farben',
    'farblabor',
  ],
  window: { width: 980, height: 680, minWidth: 540, minHeight: 420 },
  permissions: ['clipboard', 'vfs', 'intents', 'system'],
  commands: [
    {
      id: 'colorlab.open',
      title: { en: 'Open Color Laboratory', de: 'Farblabor öffnen' },
      icon: 'palette',
    },
  ],
  terminal: [
    {
      name: 'color',
      description: {
        en: 'Inspect color conversions or open color lab',
        de: 'Farbwerte konvertieren oder Farblabor öffnen',
      },
      usage: 'color [hex|rgb|name]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
