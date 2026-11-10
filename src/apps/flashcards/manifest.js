// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.flashcards',
  name: { en: 'Flashcards', de: 'Karteikarten' },
  description: {
    en: 'Decks and subdecks, Markdown & KaTeX math, cloze deletion, FSRS spaced repetition, and Anki .apkg import',
    de: 'Stapel & Unterstapel, Markdown & KaTeX-Formeln, Lückentexte, FSRS-Spaced-Repetition und Anki-.apkg-Import',
  },
  version: '1.0.0',
  icon: 'cards',
  category: 'study',
  keywords: ['flashcards', 'anki', 'fsrs', 'spaced-repetition', 'study', 'karteikarten', 'lernen', 'cloze'],
  window: { width: 1040, height: 700, minWidth: 540, minHeight: 400, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler', 'clipboard'],
  handles: [
    { action: 'open', types: ['.apkg', '.csv'] },
    { action: 'share', types: ['text/plain'] },
  ],
  storage: {
    version: 1,
    collections: {
      decks: {
        indexes: {
          name: 'name',
        },
      },
      cards: {
        indexes: {
          deckId: 'deckId',
        },
      },
      reviews: {
        indexes: {
          cardId: 'cardId',
          date: 'date',
        },
      },
    },
  },
  settings: [
    {
      key: 'dailyNewLimit',
      label: { en: 'Daily new cards limit', de: 'Tägliches Limit für neue Karten' },
      type: 'number',
      min: 5,
      max: 100,
      default: 20,
    },
    {
      key: 'dailyReviewLimit',
      label: { en: 'Daily review limit', de: 'Tägliches Wiederholungslimit' },
      type: 'number',
      min: 10,
      max: 500,
      default: 100,
    },
  ],
  commands: [
    {
      id: 'flashcards.study',
      title: { en: 'Study flashcards', de: 'Karteikarten lernen' },
      icon: 'cards',
      shortcut: 'Mod+Alt+D',
    },
  ],
  terminal: [
    {
      name: 'flashcards',
      description: {
        en: 'Show flashcards study counts or start a review session',
        de: 'Karteikarten-Zähler anzeigen oder Lerneinheit starten',
      },
      usage: 'flashcards [study | stats | decks]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
