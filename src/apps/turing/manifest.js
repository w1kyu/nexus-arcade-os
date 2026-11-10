// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.turing',
  name: { en: 'Turing Machine Simulator', de: 'Turing-Maschinen-Simulator' },
  description: {
    en: 'Single-tape Turing Machine visualizer with state table, head movement, and busy beaver machines',
    de: 'Visualisierer für 1-Band-Turing-Maschinen mit Zustandstabelle, Bandkopf-Animation und Fleißigen Bibern',
  },
  version: '1.0.0',
  icon: 'terminal',
  category: 'study',
  keywords: ['turing', 'machine', 'tape', 'theoretical', 'automata', 'busy beaver', 'computation', 'informatik'],
  window: { width: 1040, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'turing.open',
      title: { en: 'Open Turing Machine Simulator', de: 'Turing-Simulator öffnen' },
      icon: 'terminal',
    },
  ],
  terminal: [
    {
      name: 'turing',
      description: {
        en: 'Run Turing Machine preset on input string',
        de: 'Turing-Maschine auf Eingabe ausführen',
      },
      usage: 'turing [inc|palindrome|add|bb2] [input]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
