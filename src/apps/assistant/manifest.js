// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.assistant',
  name: { en: 'Nexus Assistant', de: 'Nexus Assistent' },
  description: {
    en: 'Ask AI to rewrite, summarize or explain text from any app',
    de: 'Text aus jeder App von der KI umschreiben, zusammenfassen oder erklären lassen',
  },
  version: '1.0.0',
  icon: 'sparkles',
  category: 'ai',
  keywords: ['ai', 'assistant', 'writing', 'coding', 'explain', 'summarize', 'translate', 'refactor', 'fix'],
  window: { width: 480, height: 520, minWidth: 360, minHeight: 300 },
  permissions: ['ai', 'clipboard', 'notifications'],
  commands: [
    {
      id: 'assistant.open',
      title: { en: 'Open AI Assistant', de: 'KI-Assistent öffnen' },
      icon: 'sparkles',
      shortcut: 'Mod+Alt+Space',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
