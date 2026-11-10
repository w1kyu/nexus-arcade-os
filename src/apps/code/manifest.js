// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.code',
  name: { en: 'Nexus Code', de: 'Nexus Code' },
  description: {
    en: 'Multi-file code editor with project workspace, live web preview, search and local history',
    de: 'Mehrdatei-Code-Editor mit Projektarbeitsbereich, Live-Web-Vorschau, Suche und lokalem Verlauf',
  },
  version: '1.0.0',
  icon: 'code',
  category: 'dev',
  keywords: ['code', 'editor', 'ide', 'develop', 'workspace', 'project', 'vscode', 'html', 'javascript', 'css'],
  window: { width: 1040, height: 720, minWidth: 640, minHeight: 440 },
  permissions: ['vfs', 'clipboard', 'intents', 'notifications', 'system'],
  commands: [
    {
      id: 'code.open',
      title: { en: 'Open Nexus Code', de: 'Nexus Code öffnen' },
      icon: 'code',
    },
    {
      id: 'code.newProject',
      title: { en: 'New Web Project', de: 'Neues Web-Projekt' },
      icon: 'file-plus',
    },
  ],
  terminal: [
    {
      name: 'code',
      description: {
        en: 'Open folder or file in Nexus Code',
        de: 'Ordner oder Datei in Nexus Code öffnen',
      },
      usage: 'code [path]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
