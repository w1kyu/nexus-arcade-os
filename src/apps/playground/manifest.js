// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.playground',
  name: { en: 'Code Playground', de: 'Code-Playground' },
  description: {
    en: 'Interactive HTML, CSS and JavaScript sandbox with live preview, captured console and starter templates',
    de: 'Interaktive HTML-, CSS- und JavaScript-Sandbox mit Live-Vorschau, Konsole und Vorlagen',
  },
  version: '1.0.0',
  icon: 'play',
  category: 'dev',
  keywords: ['playground', 'codepen', 'jsfiddle', 'html', 'css', 'javascript', 'live', 'preview', 'sandbox', 'editor'],
  window: { width: 1120, height: 740, minWidth: 640, minHeight: 460 },
  permissions: ['vfs', 'clipboard', 'intents', 'ai'],
  commands: [
    { id: 'playground.open', title: { en: 'Open Code Playground', de: 'Code-Playground öffnen' }, icon: 'play' },
    {
      id: 'playground.new',
      title: { en: 'New Playground Project', de: 'Neues Playground-Projekt' },
      icon: 'file-plus',
    },
  ],
  terminal: [
    {
      name: 'playground',
      description: { en: 'Open code playground or run a project', de: 'Code-Playground öffnen oder Projekt starten' },
      usage: 'playground [template|project]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
