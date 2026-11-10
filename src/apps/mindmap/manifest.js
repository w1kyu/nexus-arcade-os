/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.mindmap',
  name: { en: 'Nexus Mind Map', de: 'Nexus Mindmap' },
  description: {
    en: 'Visual mind mapping and brainstorming with automatic layouts, keyboard navigation and Markdown export',
    de: 'Visuelle Ideen- und Wissensstrukturierung mit automatischen Layouts und Tastatursteuerung',
  },
  version: '1.0.0',
  icon: 'share',
  category: 'office',
  keywords: ['mindmap', 'brainstorm', 'nodes', 'tree', 'diagram', 'ideas', 'notizen', 'gedanken', 'struktur'],
  window: { width: 1080, height: 720, minWidth: 640, minHeight: 450 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.map', '.nmap', 'text/markdown', '.md'],
    },
  ],
  commands: [
    { id: 'mindmap.new', title: { en: 'New mind map', de: 'Neue Mindmap' }, icon: 'share', shortcut: 'Mod+Alt+M' },
  ],
  terminal: [
    {
      name: 'mindmap',
      description: { en: 'Open or create mind maps', de: 'Mindmaps öffnen oder erstellen' },
      usage: 'mindmap [file.nmap | file.md]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
