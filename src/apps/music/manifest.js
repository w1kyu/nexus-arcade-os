// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.music',
  name: { en: 'Nexus Music', de: 'Nexus Musik' },
  description: {
    en: 'Local music player with library, ID3v2/Vorbis/MP4 metadata, 10-band EQ, 5 visualizer modes and Media Session integration',
    de: 'Lokaler Musikplayer mit Mediathek, ID3v2/Vorbis/MP4-Metadaten, 10-Band-Equalizer, 5 Visualizer-Modi und Media-Session-Steuerung',
  },
  version: '1.0.0',
  icon: 'music',
  category: 'media',
  keywords: ['music', 'audio', 'player', 'songs', 'mp3', 'flac', 'visualizer', 'equalizer', 'playlist', 'musik'],
  window: { width: 1080, height: 720, minWidth: 640, minHeight: 460, singleInstance: true },
  permissions: ['vfs', 'notifications', 'intents'],
  storage: {
    version: 1,
    collections: {
      playlists: { indexes: {} },
      library: { indexes: {} },
    },
  },
  handles: [
    {
      action: 'open',
      types: [
        'audio/mpeg',
        '.mp3',
        'audio/ogg',
        '.ogg',
        'audio/flac',
        '.flac',
        'audio/wav',
        '.wav',
        'audio/mp4',
        '.m4a',
        'audio/x-m4a',
        '.aac',
      ],
    },
  ],
  commands: [
    {
      id: 'music.toggle',
      title: { en: 'Play / Pause', de: 'Wiedergabe / Pause' },
      icon: 'play',
      shortcut: 'MediaPlayPause',
    },
    {
      id: 'music.next',
      title: { en: 'Next track', de: 'Nächster Titel' },
      icon: 'skip-forward',
      shortcut: 'MediaTrackNext',
    },
    {
      id: 'music.prev',
      title: { en: 'Previous track', de: 'Vorheriger Titel' },
      icon: 'skip-back',
      shortcut: 'MediaTrackPrevious',
    },
  ],
  terminal: [
    {
      name: 'music',
      description: {
        en: 'Control audio playback or scan music folder',
        de: 'Musikwiedergabe steuern oder Mediathek scannen',
      },
      usage: 'music [play | pause | next | prev | scan]',
    },
  ],
  widgets: [
    {
      id: 'miniplayer',
      title: { en: 'Mini Player', de: 'Mini-Player' },
      icon: 'music',
      size: [2, 2],
      minSize: [2, 1],
      load: () => import('./widget.js'),
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
