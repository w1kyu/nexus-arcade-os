// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.quiz',
  name: { en: 'Quiz Arena', de: 'Quiz-Arena' },
  description: {
    en: 'Trivia arena featuring CS fundamentals, logic puzzles, timers, streaks, and custom quiz packs',
    de: 'Trivia-Arena mit Informatik-Grundlagen, Logikrätseln, Zeitleiste, Serien und eigenen Quiz-Paketen',
  },
  version: '1.0.0',
  icon: 'help-circle',
  category: 'games',
  keywords: ['quiz', 'trivia', 'cs', 'arena', 'timer', 'streak', 'learning'],
  window: { width: 720, height: 680, minWidth: 460, minHeight: 460 },
  commands: [{ id: 'quiz.open', title: { en: 'Open Quiz Arena', de: 'Quiz-Arena öffnen' }, icon: 'help-circle' }],
  terminal: [
    {
      name: 'quiz',
      description: { en: 'Launch Quiz Arena game', de: 'Quiz-Arena starten' },
      usage: 'quiz',
    },
  ],
  achievements: [
    {
      id: 'quiz_streak_5',
      title: { en: 'Quiz Wiz', de: 'Quiz-Ass' },
      description: { en: 'Answer 5 questions correctly in a row', de: 'Beantworte 5 Fragen hintereinander richtig' },
      icon: 'zap',
    },
    {
      id: 'quiz_first_clear',
      title: { en: 'Arena Champion', de: 'Arena-Champion' },
      description: { en: 'Complete a full quiz session', de: 'Schließe eine komplette Quiz-Runde ab' },
      icon: 'trophy',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
