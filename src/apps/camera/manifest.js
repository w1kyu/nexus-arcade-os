// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.camera',
  name: { en: 'Camera', de: 'Kamera' },
  description: {
    en: 'Photo booth and video recorder with countdown timer, burst mode, live shader filters and QR code scanner',
    de: 'Foto-Automat und Video-Aufnahme mit Selbstauslöser, Serienbildern, Live-Filtern und QR-Code-Scanner',
  },
  version: '1.0.0',
  icon: 'camera',
  category: 'media',
  keywords: ['camera', 'photo', 'video', 'booth', 'selfie', 'filters', 'webcam', 'qr', 'kamera'],
  window: { width: 920, height: 640, minWidth: 480, minHeight: 380 },
  permissions: ['vfs', 'notifications'],
  commands: [{ id: 'camera.capture', title: { en: 'Take Photo', de: 'Foto aufnehmen' }, icon: 'camera' }],
  terminal: [
    {
      name: 'camera',
      description: { en: 'Launch camera / photo booth', de: 'Kamera / Foto-Automat starten' },
      usage: 'camera',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
