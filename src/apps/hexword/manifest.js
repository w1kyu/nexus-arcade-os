// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.hexword',
  name: { en: 'Hexword', de: 'Hexword' },
  description: {
    en: 'Guess the five-letter word in six tries, in English or German',
    de: 'Das Wort mit fünf Buchstaben in sechs Versuchen erraten, auf Deutsch oder Englisch',
  },
  version: '1.0.0',
  icon: 'edit',
  category: 'games',
  keywords: ['hexword', 'wordle', 'word', 'puzzle', 'letters', 'vocabulary', 'daily'],
  window: { width: 540, height: 720, minWidth: 360, minHeight: 480 },
  commands: [{ id: 'hexword.open', title: { en: 'Open Hexword', de: 'Hexword öffnen' }, icon: 'edit' }],
  terminal: [
    {
      name: 'hexword',
      description: { en: 'Launch Hexword puzzle game', de: 'Hexword Worträtsel starten' },
      usage: 'hexword',
    },
  ],
  achievements: [
    {
      id: 'hexword_first_win',
      title: { en: 'Word Master', de: 'Wortgewandt' },
      description: { en: 'Solve a 5-letter word puzzle', de: 'Löse ein 5-Buchstaben-Worträtsel' },
      icon: 'star',
    },
    {
      id: 'hexword_streak_3',
      title: { en: 'Linguistic Flow', de: 'Linguistischer Lauf' },
      description: { en: 'Win 3 word puzzles in a row', de: 'Gewinne 3 Worträtsel in Folge' },
      icon: 'sparkles',
    },
    {
      id: 'hexword_hard_mode',
      title: { en: 'Iron Lexicon', de: 'Eisernes Lexikon' },
      description: { en: 'Win a puzzle in Hard Mode', de: 'Löse ein Rätsel im schweren Modus' },
      icon: 'trophy',
    },
    {
      id: 'hexword_genius',
      title: { en: 'Clairvoyant', de: 'Hellsichtig' },
      description: { en: 'Solve a word in 2 guesses or fewer', de: 'Errate das Wort in höchstens 2 Versuchen' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
