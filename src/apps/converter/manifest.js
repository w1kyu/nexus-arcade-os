// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.converter',
  name: { en: 'Unit Converter', de: 'Einheitenumrechner' },
  description: {
    en: 'Convert units, data sizes, number bases and more as you type',
    de: 'Einheiten, Datengrößen, Zahlensysteme und mehr direkt beim Tippen umrechnen',
  },
  version: '1.0.0',
  icon: 'refresh-cw',
  category: 'productivity',
  keywords: ['convert', 'converter', 'units', 'einheiten', 'umrechner', 'metric', 'imperial', 'datasize', 'roman'],
  window: { width: 720, height: 560, minWidth: 440, minHeight: 380, singleInstance: false },
  permissions: ['clipboard'],
  storage: {
    version: 1,
    collections: {
      favorites: {
        indexes: {},
      },
    },
  },
  commands: [
    {
      id: 'converter.open',
      title: { en: 'Open Unit Converter', de: 'Einheitenumrechner öffnen' },
      icon: 'refresh-cw',
    },
  ],
  terminal: [
    {
      name: 'convert',
      description: {
        en: 'Convert values between units',
        de: 'Werte zwischen Einheiten umrechnen',
      },
      usage: 'convert <value> <from> to <to> (e.g. convert 100 km/h to mph)',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
