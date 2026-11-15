// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.video',
  name: { en: 'Video Player', de: 'Videoplayer' },
  description: {
    en: 'Play your videos with subtitles, loops and frame-by-frame stepping',
    de: 'Eigene Videos mit Untertiteln, Schleifen und Einzelbildschritten abspielen',
  },
  version: '1.0.0',
  icon: 'file-video',
  category: 'media',
  keywords: ['video', 'player', 'movie', 'mp4', 'webm', 'subtitles', 'srt', 'vtt', 'film', 'kino'],
  window: { width: 960, height: 600, minWidth: 480, minHeight: 340 },
  permissions: ['vfs', 'notifications', 'intents'],
  storage: {
    version: 1,
    collections: {
      playback: { indexes: {} },
    },
  },
  handles: [
    {
      action: 'open',
      types: ['video/mp4', '.mp4', 'video/webm', '.webm', 'video/ogg', '.ogv', 'video/quicktime', '.mov', '.mkv'],
    },
  ],
  commands: [
    { id: 'video.toggle', title: { en: 'Play / Pause Video', de: 'Video abspielen / pausieren' }, icon: 'play' },
    {
      id: 'video.screenshot',
      title: { en: 'Take Video Screenshot', de: 'Video-Screenshot erstellen' },
      icon: 'camera',
    },
  ],
  terminal: [
    {
      name: 'video',
      description: { en: 'Play video file from VFS', de: 'Videodatei aus VFS abspielen' },
      usage: 'video [file.mp4 | file.webm]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
