/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.sheets',
  name: { en: 'Nexus Sheets', de: 'Nexus Tabellen' },
  description: {
    en: 'Professional spreadsheet with formula engine, 40+ functions, virtual scrolling, charts and CSV/TSV support',
    de: 'Professionelle Tabellenkalkulation mit Formel-Engine, über 40 Funktionen, virtuellem Scrollen, Diagrammen und CSV/TSV-Unterstützung',
  },
  version: '1.0.0',
  icon: 'table',
  category: 'office',
  keywords: ['spreadsheet', 'sheets', 'excel', 'csv', 'table', 'formulas', 'charts', 'tabelle', 'formeln'],
  window: { width: 1040, height: 680, minWidth: 640, minHeight: 400 },
  permissions: ['vfs', 'intents', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.sheet', '.nsheet', 'text/csv', '.csv', 'text/tab-separated-values', '.tsv'],
    },
  ],
  commands: [
    { id: 'sheets.new', title: { en: 'New spreadsheet', de: 'Neue Tabelle' }, icon: 'table', shortcut: 'Mod+Alt+S' },
  ],
  terminal: [
    {
      name: 'sheets',
      description: { en: 'Open or create spreadsheets', de: 'Tabellen öffnen oder erstellen' },
      usage: 'sheets [file.nsheet | file.csv]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
