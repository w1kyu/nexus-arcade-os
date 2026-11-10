// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.calculator',
  name: { en: 'Calculator', de: 'Rechner' },
  description: {
    en: 'Standard, Scientific, Programmer (8/16/32/64-bit, clickable bits), Graphing, Matrix, and Statistics calculator',
    de: 'Standard-, Wissenschafts-, Programmierer- (8/16/32/64-Bit, Klick-Bits), Funktionsgraph-, Matrix- und Statistik-Rechner',
  },
  version: '1.0.0',
  icon: 'cpu',
  category: 'productivity',
  keywords: ['calc', 'calculator', 'rechner', 'math', 'mathe', 'programmer', 'graph', 'matrix', 'statistics'],
  window: { width: 840, height: 680, minWidth: 480, minHeight: 460, singleInstance: false },
  permissions: ['clipboard'],
  storage: {
    version: 1,
    collections: {
      history: {
        indexes: {},
      },
    },
  },
  commands: [
    {
      id: 'calculator.open',
      title: { en: 'Open Calculator', de: 'Rechner öffnen' },
      icon: 'cpu',
    },
  ],
  terminal: [
    {
      name: 'calc',
      description: {
        en: 'Evaluate a mathematical expression',
        de: 'Einen mathematischen Ausdruck auswerten',
      },
      usage: 'calc <expression>',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
