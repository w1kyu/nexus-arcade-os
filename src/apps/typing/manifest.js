// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.typing',
  name: { en: 'Typing Trainer', de: 'Typing Trainer' },
  description: {
    en: 'Professional touch typing trainer with WPM benchmarks, visual keyboard finger hints, and code mode',
    de: 'Professioneller Tipptrainer mit WPM-Benchmarks, visuellen Fingerhinweisen und Code-Modus',
  },
  version: '1.0.0',
  icon: 'keyboard',
  category: 'games',
  keywords: ['typing', 'keyboard', 'trainer', 'speed', 'wpm', 'code'],
  window: { width: 840, height: 700, minWidth: 500, minHeight: 520 },
  permissions: ['intents'],
  commands: [
    {
      id: 'typing.open',
      title: { en: 'Open Typing Trainer', de: 'Typing Trainer öffnen' },
      icon: 'keyboard',
    },
  ],
  terminal: [
    {
      name: 'typing',
      description: {
        en: 'Launch Typing Trainer arcade tool',
        de: 'Typing Trainer Arcade-Tool starten',
      },
      usage: 'typing',
    },
  ],
  achievements: [
    {
      id: 'typing_60_wpm',
      title: { en: 'Speedy Fingers', de: 'Schnelle Finger' },
      description: { en: 'Reach 60 Words Per Minute', de: 'Erreiche 60 Wörter pro Minute' },
      icon: 'star',
    },
    {
      id: 'typing_100_wpm',
      title: { en: 'Hypersonic Typist', de: 'Hyperschall-Schreiber' },
      description: { en: 'Achieve triple-digit speed of 100+ WPM', de: 'Erreiche dreistellige 100+ WPM' },
      icon: 'trophy',
    },
    {
      id: 'typing_accuracy_98',
      title: { en: 'Precision Typist', de: 'Präzisionstipper' },
      description: {
        en: 'Complete a session with 98% or higher accuracy',
        de: 'Schließe eine Sitzung mit mind. 98% Genauigkeit ab',
      },
      icon: 'sparkles',
    },
    {
      id: 'typing_code_master',
      title: { en: 'Hacker Flow', de: 'Hacker-Flow' },
      description: {
        en: 'Complete a Code Typing session with 95%+ accuracy',
        de: 'Schließe eine Code-Sitzung mit mind. 95% Genauigkeit ab',
      },
      icon: 'trophy',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
