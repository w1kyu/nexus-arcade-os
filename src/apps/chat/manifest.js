// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.chat',
  name: { en: 'Nexus Chat', de: 'Nexus Chat' },
  description: {
    en: 'Conversational AI with local and remote models, tools, and code assistant',
    de: 'Konversationelle KI mit lokalen und Remote-Modellen, Tools und Code-Assistent',
  },
  version: '1.0.0',
  icon: 'chat',
  category: 'ai',
  keywords: ['ai', 'chat', 'llm', 'gpt', 'ollama', 'claude', 'assistant', 'ki', 'rag', 'models'],
  window: { width: 920, height: 680, minWidth: 480, minHeight: 380 },
  permissions: ['ai', 'vfs', 'notifications', 'clipboard', 'network'],
  storage: {
    version: 1,
    collections: {
      conversations: { indexes: ['folder', 'updatedAt', 'pinned'] },
      messages: { indexes: ['conversationId', 'createdAt'] },
      personas: { indexes: ['name'] },
      templates: { indexes: ['category'] },
    },
  },
  commands: [
    {
      id: 'chat.open',
      title: { en: 'Open AI Chat', de: 'KI-Chat öffnen' },
      icon: 'chat',
      shortcut: 'Mod+Alt+A',
    },
    {
      id: 'chat.new',
      title: { en: 'New AI Chat', de: 'Neuer KI-Chat' },
      icon: 'sparkles',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
