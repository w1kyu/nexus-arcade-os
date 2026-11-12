// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.beatlab',
  name: { en: 'Beat Lab', de: 'Beat Lab' },
  description: {
    en: '16-step synthesized drum machine with lookahead scheduling, swing, kit presets and WAV audio export',
    de: 'Synthetischer 16-Step-Drumcomputer mit Lookahead-Timing, Swing, Drum-Kits und WAV-Audioexport',
  },
  version: '1.0.0',
  icon: 'disc',
  category: 'media',
  keywords: ['beat', 'drums', 'sequencer', 'synthesizer', 'audio', '808', '909', 'music', 'rhythm', 'schlagzeug'],
  window: { width: 980, height: 580, minWidth: 640, minHeight: 420 },
  permissions: ['vfs', 'notifications'],
  handles: [
    {
      action: 'open',
      types: ['application/vnd.nexus.beat', '.nbeat'],
    },
  ],
  commands: [{ id: 'beatlab.toggle', title: { en: 'Play / Stop Beat', de: 'Beat starten / stoppen' }, icon: 'play' }],
  terminal: [
    {
      name: 'beatlab',
      description: { en: 'Launch Beat Lab drum machine', de: 'Beat Lab Drumcomputer starten' },
      usage: 'beatlab [file.nbeat]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
