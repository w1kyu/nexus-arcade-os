// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.automata',
  name: { en: 'Automata Lab', de: 'Automaten-Labor' },
  description: {
    en: 'Interactive DFA/NFA editor, word simulator, subset construction, and Thompson regex converter',
    de: 'Interaktiver DFA/NFA-Editor, Wort-Simulator, Potenzmengenkonstruktion und Thompson-Regex-Konverter',
  },
  version: '1.0.0',
  icon: 'refresh',
  category: 'study',
  keywords: ['automata', 'dfa', 'nfa', 'regex', 'thompson', 'theoretical', 'cs', 'simulation', 'informatik'],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'automata.open',
      title: { en: 'Open Automata Lab', de: 'Automaten-Labor öffnen' },
      icon: 'refresh',
    },
  ],
  terminal: [
    {
      name: 'automata',
      description: {
        en: 'Simulate words on automata or launch automata lab',
        de: 'Wörter auf Automaten simulieren oder Labor öffnen',
      },
      usage: 'automata [div3|endsab|even] [word]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
