// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.snake',
  name: { en: 'Snake Evolution', de: 'Snake Evolution' },
  description: {
    en: 'Next-gen cyber snake with smooth motion, power-ups, and quantum maps',
    de: 'Cyber-Snake der nächsten Generation mit flüssiger Bewegung, Power-ups und Quantenkarten',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['snake', 'arcade', 'retro', 'game', 'cyber'],
  window: { width: 720, height: 740, minWidth: 480, minHeight: 480 },
  permissions: ['intents'],
  commands: [
    {
      id: 'snake.open',
      title: { en: 'Open Snake Evolution', de: 'Snake Evolution öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'snake',
      description: {
        en: 'Launch Snake Evolution arcade game',
        de: 'Snake Evolution Arcade-Spiel starten',
      },
      usage: 'snake',
    },
  ],
  achievements: [
    {
      id: 'snake_first_food',
      title: { en: 'First Byte', de: 'Erster Bissen' },
      description: {
        en: 'Eat your first food particle in Snake Evolution',
        de: 'Iss dein erstes Futterteilchen in Snake Evolution',
      },
      icon: 'star',
    },
    {
      id: 'snake_length_25',
      title: { en: 'Growing Serpent', de: 'Wachsende Schlange' },
      description: { en: 'Reach a snake length of 25 segments', de: 'Erreiche eine Schlangenlänge von 25 Segmenten' },
      icon: 'trophy',
      goal: 25,
    },
    {
      id: 'snake_length_50',
      title: { en: 'Ouroboros', de: 'Ouroboros' },
      description: { en: 'Reach a snake length of 50 segments', de: 'Erreiche eine Schlangenlänge von 50 Segmenten' },
      icon: 'trophy',
      goal: 50,
    },
    {
      id: 'snake_score_1000',
      title: { en: 'Cyber Viper', de: 'Cyber-Viper' },
      description: {
        en: 'Score over 1,000 points in a single session',
        de: 'Erziele über 1.000 Punkte in einer Sitzung',
      },
      icon: 'trophy',
      goal: 1000,
    },
    {
      id: 'snake_no_powerups',
      title: { en: 'Purist', de: 'Purist' },
      description: { en: 'Score 500+ points without using any power-ups', de: 'Erziele 500+ Punkte ohne Power-ups' },
      icon: 'star',
      secret: true,
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
