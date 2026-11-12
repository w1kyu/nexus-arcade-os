// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.screenrecorder',
  name: { en: 'Screen Recorder', de: 'Bildschirmaufnahme' },
  description: {
    en: 'Capture your screen, browser tabs or window with optional microphone audio and WebM export',
    de: 'Bildschirm, Fenster oder Browser-Tabs aufnehmen mit Mikrofon-Ton und WebM-Export',
  },
  version: '1.0.0',
  icon: 'monitor',
  category: 'media',
  keywords: ['screen', 'recorder', 'capture', 'video', 'display', 'aufnahme', 'bildschirm', 'stream'],
  window: { width: 880, height: 580, minWidth: 480, minHeight: 360 },
  permissions: ['vfs', 'notifications'],
  commands: [
    {
      id: 'screenrecorder.toggle',
      title: { en: 'Start / Stop Screen Recording', de: 'Bildschirmaufnahme starten / stoppen' },
      icon: 'monitor',
    },
  ],
  terminal: [
    {
      name: 'screenrecord',
      description: { en: 'Launch screen recorder', de: 'Bildschirmaufnahme starten' },
      usage: 'screenrecord',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
