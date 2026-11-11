// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.life',
  name: { en: 'Game of Life', de: 'Spiel des Lebens' },
  description: {
    en: 'Cellular automata sandbox with pattern library, multiple rule sets, and interactive drawing',
    de: 'Zellulärer Automaten-Sandbox mit Musterbibliothek, Regelsätzen und interaktivem Zeichnen',
  },
  version: '1.0.0',
  icon: 'cpu',
  category: 'games',
  keywords: ['game of life', 'cellular automata', 'conway', 'simulation', 'patterns', 'highlife'],
  window: { width: 840, height: 680, minWidth: 500, minHeight: 440 },
  commands: [{ id: 'life.open', title: { en: 'Open Game of Life', de: 'Spiel des Lebens öffnen' }, icon: 'cpu' }],
  terminal: [
    {
      name: 'life',
      description: { en: 'Launch Game of Life sandbox', de: 'Spiel des Lebens starten' },
      usage: 'life',
    },
  ],
  achievements: [
    {
      id: 'life_pop_500',
      title: { en: 'Megacity', de: 'Megastadt' },
      description: {
        en: 'Grow a population of 500+ live cells',
        de: 'Erreiche eine Population von 500+ lebenden Zellen',
      },
      icon: 'star',
    },
    {
      id: 'life_gen_100',
      title: { en: 'Centenarian', de: 'Hundertjähriger' },
      description: {
        en: 'Simulate 100 generations in a single run',
        de: 'Simuliere 100 Generationen in einem Durchlauf',
      },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
