// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.vault',
  name: { en: 'Password Vault', de: 'Passwort-Tresor' },
  description: {
    en: 'Master password AES-GCM encrypted vault, password & passphrase generator, RFC 6238 TOTP authenticator, and local health check',
    de: 'AES-GCM verschlüsselter Passwort-Manager, Passwort- und Passphrasen-Generator, RFC 6238 TOTP Authentifikator und lokale Sicherheitsprüfung',
  },
  version: '1.0.0',
  icon: 'shield',
  category: 'productivity',
  keywords: [
    'password',
    'vault',
    'passwort',
    'tresor',
    'totp',
    '2fa',
    'security',
    'authenticator',
    'generator',
    'encryption',
  ],
  window: { width: 960, height: 680, minWidth: 540, minHeight: 440, singleInstance: true },
  permissions: ['clipboard', 'notifications'],
  storage: {
    version: 1,
    collections: {
      credentials: {
        indexes: {
          title: 'title',
        },
      },
      config: {
        indexes: {},
      },
    },
  },
  commands: [
    {
      id: 'vault.generate',
      title: { en: 'Generate Password', de: 'Passwort generieren' },
      icon: 'key',
    },
    {
      id: 'vault.lock',
      title: { en: 'Lock Vault', de: 'Tresor sperren' },
      icon: 'lock',
    },
  ],
  terminal: [
    {
      name: 'vault',
      description: {
        en: 'Inspect vault or generate TOTP',
        de: 'Tresor einsehen oder TOTP generieren',
      },
      usage: 'vault [status | totp <title> | generate [length]]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
