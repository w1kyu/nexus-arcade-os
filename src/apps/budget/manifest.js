// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.budget',
  name: { en: 'Budget', de: 'Finanzen' },
  description: {
    en: 'Personal accounts, transactions, category budgets, reports, CSV bank import/export, and expense splitting',
    de: 'Persönliche Konten, Transaktionen, Kategorie-Budgets, Auswertungen, CSV-Bankimport und Ausgaben-Teilung',
  },
  version: '1.0.0',
  icon: 'wallet',
  category: 'productivity',
  keywords: ['budget', 'money', 'finanzen', 'geld', 'expenses', 'income', 'accounts', 'csv', 'splitting'],
  window: { width: 1100, height: 720, minWidth: 640, minHeight: 460, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'clipboard'],
  storage: {
    version: 1,
    collections: {
      accounts: {
        indexes: {
          name: 'name',
        },
      },
      transactions: {
        indexes: {
          accountId: 'accountId',
          date: 'date',
          category: 'category',
        },
      },
      budgets: {
        indexes: {
          category: 'category',
        },
      },
      goals: {
        indexes: {
          name: 'name',
        },
      },
    },
  },
  commands: [
    {
      id: 'budget.newTransaction',
      title: { en: 'New transaction', de: 'Neue Transaktion' },
      icon: 'plus',
    },
    {
      id: 'budget.split',
      title: { en: 'Split expenses', de: 'Ausgaben teilen' },
      icon: 'users',
    },
  ],
  terminal: [
    {
      name: 'budget',
      description: {
        en: 'Inspect account balances and monthly summary',
        de: 'Kontostände und Monatsübersicht prüfen',
      },
      usage: 'budget [balance | summary | add <amount> <category>]',
    },
  ],
  widgets: [
    {
      id: 'budget-widget',
      title: { en: 'Budget & Balance', de: 'Finanzübersicht' },
      icon: 'wallet',
      size: [2, 2],
      minSize: [2, 1],
      load: () => import('./widget.js'),
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
