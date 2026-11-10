// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.archlab',
  name: { en: 'Number & CPU Lab', de: 'Zahlendarstellung & CPU-Lab' },
  description: {
    en: 'Interactive IEEE-754 floating-point inspector, integer formats, base conversions, and Nexus-8 toy CPU simulator',
    de: 'Interaktiver IEEE 754 Gleitkomma-Inspektor, Ganzzahl-Formate, Basisumrechnungen und Nexus-8 CPU-Simulator',
  },
  version: '1.0.0',
  icon: 'cpu',
  category: 'study',
  keywords: [
    'cpu',
    'assembly',
    'architecture',
    'ieee754',
    'float',
    'binary',
    'hex',
    'twos complement',
    'rechnerarchitektur',
    'informatik',
    'microarchitecture',
  ],
  window: { width: 1100, height: 740, minWidth: 640, minHeight: 460 },
  permissions: ['clipboard', 'vfs', 'intents'],
  commands: [
    {
      id: 'archlab.open',
      title: { en: 'Open Number & CPU Lab', de: 'Rechnerarchitektur-Lab öffnen' },
      icon: 'cpu',
    },
  ],
  terminal: [
    {
      name: 'archlab',
      description: {
        en: 'Inspect number formats or run Nexus-8 CPU programs',
        de: 'Zahlenformate untersuchen oder Nexus-8 CPU-Programme ausführen',
      },
      usage: 'archlab [num <val> | ieee <float> | cpu <preset>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
