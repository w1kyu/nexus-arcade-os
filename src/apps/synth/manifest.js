// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.synth',
  name: { en: 'Synthesizer', de: 'Synthesizer' },
  description: {
    en: 'Play and shape sounds on a synthesizer with your keyboard or MIDI',
    de: 'Klänge mit einem Synthesizer spielen und formen, per Tastatur oder MIDI',
  },
  version: '1.0.0',
  icon: 'activity',
  category: 'media',
  keywords: ['synth', 'synthesizer', 'piano', 'keyboard', 'midi', 'arpeggiator', 'audio', 'music', 'sound'],
  window: { width: 940, height: 640, minWidth: 640, minHeight: 480 },
  permissions: ['vfs', 'notifications'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.synth', '.nsynth'],
    },
  ],
  commands: [
    {
      id: 'synth.allNotesOff',
      title: { en: 'Panic (Silence Synth)', de: 'Panik (Synth stummschalten)' },
      icon: 'activity',
    },
  ],
  terminal: [
    {
      name: 'synth',
      description: { en: 'Launch Synthesizer', de: 'Synthesizer starten' },
      usage: 'synth [preset.nsynth]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
