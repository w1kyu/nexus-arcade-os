// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.httpclient',
  name: { en: 'HTTP Client', de: 'HTTP-Client' },
  description: {
    en: 'REST API client with environment variables, response viewer, curl generator and offline diagnostics',
    de: 'REST-API-Client mit Umgebungsvariablen, Antwort-Inspektor, curl-Generator und Offline-Diagnose',
  },
  version: '1.0.0',
  icon: 'globe',
  category: 'dev',
  keywords: ['http', 'client', 'api', 'rest', 'fetch', 'curl', 'postman', 'insomnia', 'network', 'request', 'json'],
  window: { width: 1060, height: 720, minWidth: 600, minHeight: 440 },
  permissions: ['network', 'vfs', 'clipboard', 'intents'],
  storage: {
    version: 1,
    collections: {
      collections: { indexes: { name: 'string' } },
      environments: { indexes: { name: 'string' } },
      history: { indexes: { timestamp: 'number' } },
    },
  },
  commands: [
    { id: 'httpclient.open', title: { en: 'Open HTTP Client', de: 'HTTP-Client öffnen' }, icon: 'globe' },
    { id: 'httpclient.new', title: { en: 'New HTTP Request', de: 'Neue HTTP-Anfrage' }, icon: 'file-plus' },
  ],
  terminal: [
    {
      name: 'curl',
      description: { en: 'Send HTTP request via browser fetch', de: 'HTTP-Anfrage über Browser-Fetch senden' },
      usage: 'curl [-X METHOD] [url]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
