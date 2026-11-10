// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.diff',
  name: { en: 'Diff Viewer', de: 'Diff-Betrachter' },
  description: {
    en: 'Compare text or files side-by-side and inline with unified diff export',
    de: 'Texte oder Dateien nebeneinander und zeilenweise vergleichen mit Patch-Export',
  },
  version: '1.0.0',
  icon: 'layout-split',
  category: 'dev',
  keywords: ['diff', 'compare', 'patch', 'unified', 'merge', 'changes', 'vergleich', 'unterschiede'],
  window: { width: 920, height: 600, minWidth: 480, minHeight: 360 },
  permissions: ['vfs', 'clipboard', 'intents'],
  commands: [
    {
      id: 'diff.open',
      title: { en: 'Open Diff Viewer', de: 'Diff-Betrachter öffnen' },
      icon: 'layout-split',
    },
  ],
  terminal: [
    {
      name: 'diff',
      description: { en: 'Compare two files or texts', de: 'Zwei Dateien oder Texte vergleichen' },
      usage: 'diff [file1] [file2]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
