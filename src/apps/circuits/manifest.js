// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.circuits',
  name: { en: 'Logic Circuit & Boolean Lab', de: 'Logikgatter & Boolesche Algebra' },
  description: {
    en: 'Build logic circuits, get their truth tables and simplify them',
    de: 'Logikschaltungen bauen, Wahrheitstabellen erzeugen und Schaltungen vereinfachen',
  },
  version: '1.0.0',
  icon: 'cpu',
  category: 'study',
  keywords: [
    'circuit',
    'logic',
    'gate',
    'boolean',
    'truth table',
    'karnaugh',
    'kv map',
    'quine mccluskey',
    'adder',
    'flipflop',
    'digital',
    'informatik',
  ],
  window: { width: 1080, height: 720, minWidth: 640, minHeight: 460 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'circuits.open',
      title: { en: 'Open Logic Circuit & Boolean Lab', de: 'Logikgatter-Lab öffnen' },
      icon: 'cpu',
    },
  ],
  terminal: [
    {
      name: 'circuits',
      description: {
        en: 'Evaluate boolean expression or simulate circuit preset',
        de: 'Booleschen Ausdruck auswerten oder Schaltung simulieren',
      },
      usage: 'circuits [eval <expr> | preset <name>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
