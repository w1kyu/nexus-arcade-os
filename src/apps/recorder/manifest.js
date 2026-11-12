// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.recorder',
  name: { en: 'Voice Recorder', de: 'Sprachmemos' },
  description: {
    en: 'Audio recording studio with live waveform, bookmarks, speed playback and audio trimming',
    de: 'Audio-Aufnahmestudio mit Live-Wellenform, Lesezeichen, Geschwindigkeitsregelung und Schnitt',
  },
  version: '1.0.0',
  icon: 'file-audio',
  category: 'media',
  keywords: ['recorder', 'voice', 'audio', 'mic', 'microphone', 'aufnahme', 'memos', 'diktiergerät'],
  window: { width: 900, height: 560, minWidth: 500, minHeight: 360 },
  permissions: ['vfs', 'notifications'],
  commands: [
    {
      id: 'recorder.toggle',
      title: { en: 'Record / Stop Audio', de: 'Audioaufnahme starten / stoppen' },
      icon: 'file-audio',
    },
  ],
  terminal: [
    {
      name: 'record',
      description: { en: 'Start voice recorder', de: 'Sprachmemo-Aufnahme starten' },
      usage: 'record',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
