// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.griddefense',
  name: { en: 'Grid Defense', de: 'Grid Defense' },
  description: {
    en: 'Tactical cyber tower defense with 10+ maps, 6 upgradable tower types, and boss creep waves',
    de: 'Taktisches Cyber-Tower-Defense mit 10+ Karten, 6 aufrüstbaren Türmen und Boss-Wellen',
  },
  version: '1.0.0',
  icon: 'shield',
  category: 'games',
  keywords: ['grid defense', 'tower defense', 'strategy', 'arcade', 'waves', 'creeps'],
  window: { width: 920, height: 680, minWidth: 640, minHeight: 480 },
  commands: [{ id: 'griddefense.open', title: { en: 'Open Grid Defense', de: 'Grid Defense öffnen' }, icon: 'shield' }],
  terminal: [
    {
      name: 'griddefense',
      description: { en: 'Launch Grid Defense game', de: 'Grid Defense starten' },
      usage: 'griddefense',
    },
  ],
  achievements: [
    {
      id: 'griddefense_first_wave',
      title: { en: 'First Line Held', de: 'Erste Linie gehalten' },
      description: { en: 'Successfully defeat Wave 1', de: 'Welle 1 erfolgreich abgewehrt' },
      icon: 'star',
    },
    {
      id: 'griddefense_boss_slayer',
      title: { en: 'Titan Fallen', de: 'Titan gefallen' },
      description: { en: 'Defeat a Colossus boss creep', de: 'Besiege einen Koloss-Boss' },
      icon: 'trophy',
    },
    {
      id: 'griddefense_flawless',
      title: { en: 'Impenetrable Grid', de: 'Undurchdringliches Raster' },
      description: { en: 'Clear all 20 waves with 20 lives remaining', de: 'Schließe alle 20 Wellen mit 20 Leben ab' },
      icon: 'zap',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
