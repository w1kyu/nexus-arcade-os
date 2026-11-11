// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.memory',
  name: { en: 'Memory Master', de: 'Memory Master' },
  description: {
    en: 'Card matching trainer with 3D flip animations, combo chains, and CS themes',
    de: 'Karten-Merkspiel mit 3D-Umdrehanimationen, Komboketten und Informatik-Themen',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['memory', 'cards', 'brain', 'puzzle', 'matching'],
  window: { width: 720, height: 760, minWidth: 480, minHeight: 480 },
  permissions: ['intents'],
  commands: [
    {
      id: 'memory.open',
      title: { en: 'Open Memory Master', de: 'Memory Master öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'memory',
      description: {
        en: 'Launch Memory Master card game',
        de: 'Memory Master Kartenspiel starten',
      },
      usage: 'memory',
    },
  ],
  achievements: [
    {
      id: 'memory_first_match',
      title: { en: 'Synapse Fire', de: 'Synapsen-Impuls' },
      description: { en: 'Find your first matching card pair', de: 'Finde dein erstes passendes Kartenpaar' },
      icon: 'star',
    },
    {
      id: 'memory_combo_3',
      title: { en: 'Flow State', de: 'Flow-Zustand' },
      description: { en: 'Reach a 3x match combo streak', de: 'Erreiche eine 3-fache Trefferkombination' },
      icon: 'trophy',
    },
    {
      id: 'memory_3_stars',
      title: { en: 'Three-Star Prodigy', de: 'Drei-Sterne-Genie' },
      description: {
        en: 'Earn a 3-star rating on any grid size',
        de: 'Erhalte eine 3-Sterne-Bewertung auf beliebiger Gittergröße',
      },
      icon: 'star',
    },
    {
      id: 'memory_grid_8x8',
      title: { en: 'Grand Master', de: 'Großmeister' },
      description: {
        en: 'Complete a full 8x8 card grid (32 pairs)',
        de: 'Schließe ein vollständiges 8x8-Gitter ab (32 Paare)',
      },
      icon: 'trophy',
    },
    {
      id: 'memory_speedrun',
      title: { en: 'Photographic Reflex', de: 'Fotografischer Reflex' },
      description: { en: 'Clear a 4x4 grid in under 30 seconds', de: 'Löse ein 4x4-Gitter in unter 30 Sekunden' },
      icon: 'star',
      secret: true,
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
