/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.notes',
  name: { en: 'Nexus Notes', de: 'Nexus Notizen' },
  description: {
    en: 'Markdown knowledge base with live preview, wiki links, backlinks, KaTeX math and per-note encryption',
    de: 'Markdown-Wissensdatenbank mit Live-Vorschau, Wiki-Links, Backlinks, KaTeX-Mathematik und Verschlüsselung',
  },
  version: '1.0.0',
  icon: 'note',
  category: 'productivity',
  keywords: ['notes', 'markdown', 'knowledge', 'wiki', 'journal', 'notizen', 'wissen'],
  window: { width: 1040, height: 680, minWidth: 520, minHeight: 360, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'clipboard'],
  handles: [
    { action: 'open', types: ['text/markdown', '.md', '.markdown'] },
    { action: 'share', types: ['text/plain', 'text/markdown'] },
  ],
  settings: [
    {
      key: 'autosaveMs',
      type: 'number',
      default: 800,
      min: 200,
      max: 10000,
      step: 100,
      label: { en: 'Autosave delay (ms)', de: 'Automatisch speichern nach (ms)' },
    },
    {
      key: 'autoLockMinutes',
      type: 'number',
      default: 5,
      min: 1,
      max: 120,
      step: 1,
      label: { en: 'Auto-lock encrypted notes (minutes)', de: 'Verschlüsselte Notizen sperren nach (Minuten)' },
    },
    {
      key: 'defaultMode',
      type: 'enum',
      default: 'split',
      label: { en: 'Default editor mode', de: 'Standard-Editormodus' },
      options: [
        { value: 'edit', label: { en: 'Edit', de: 'Bearbeiten' } },
        { value: 'split', label: { en: 'Split', de: 'Geteilt' } },
        { value: 'preview', label: { en: 'Preview', de: 'Vorschau' } },
      ],
    },
  ],
  commands: [
    { id: 'notes.new', title: { en: 'New note', de: 'Neue Notiz' }, icon: 'note', shortcut: 'Mod+Alt+M' },
    { id: 'notes.daily', title: { en: "Today's daily note", de: 'Heutige Tagesnotiz' }, icon: 'calendar' },
  ],
  terminal: [
    {
      name: 'notes',
      description: { en: 'List, search or create notes', de: 'Notizen auflisten, suchen oder erstellen' },
      usage: 'notes [list | new <title> | search <query>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
