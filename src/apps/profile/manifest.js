/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.profile',
  name: { en: 'Profile & Achievements', de: 'Profil & Erfolge' },
  description: {
    en: 'Level, XP progress, cross-app achievements, activity breakdown, and Nexus Wrapped summary',
    de: 'Stufe, EP-Fortschritt, app-übergreifende Erfolge, Aktivitätsstatistik und Nexus-Rückblick',
  },
  version: '1.0.0',
  icon: 'award',
  category: 'system',
  keywords: ['profile', 'xp', 'level', 'achievements', 'badges', 'wrapped', 'stats', 'profil', 'erfolge'],
  window: { width: 900, height: 640, minWidth: 420, minHeight: 380, singleInstance: true },
  permissions: ['system'],
  commands: [
    {
      id: 'profile.open',
      title: { en: 'Open Profile & Achievements', de: 'Profil & Erfolge öffnen' },
      icon: 'award',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  load: () => import('./index.js'),
};
