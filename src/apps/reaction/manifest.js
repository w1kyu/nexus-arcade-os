// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.reaction',
  name: { en: 'Reaction Trainer', de: 'Reaktionstrainer' },
  description: {
    en: 'Benchmark reaction time, aim precision, and cognitive memory spans',
    de: 'Benchmarke Reaktionszeit, Zielgenauigkeit und kognitive Gedächtnisspannen',
  },
  version: '1.0.0',
  icon: 'gamepad',
  category: 'games',
  keywords: ['reaction', 'reflex', 'aim', 'speed', 'memory', 'benchmark', 'human'],
  window: { width: 740, height: 680, minWidth: 480, minHeight: 440 },
  permissions: ['intents'],
  commands: [
    {
      id: 'reaction.open',
      title: { en: 'Open Reaction Trainer', de: 'Reaktionstrainer öffnen' },
      icon: 'gamepad',
    },
  ],
  terminal: [
    {
      name: 'reaction',
      description: {
        en: 'Launch Reaction Trainer benchmark tests',
        de: 'Reaktionstrainer Benchmark-Tests starten',
      },
      usage: 'reaction',
    },
  ],
  achievements: [
    {
      id: 'reaction_first_test',
      title: { en: 'Reflex Checked', de: 'Reflex geprüft' },
      description: {
        en: 'Complete your first reaction or memory benchmark test',
        de: 'Schließe deinen ersten Reaktions- oder Gedächtnistest ab',
      },
      icon: 'star',
    },
    {
      id: 'reaction_sub_200',
      title: { en: 'Lightning Synapse', de: 'Blitzschnelle Synapse' },
      description: {
        en: 'Achieve an average reaction time under 200 ms',
        de: 'Erziele eine durchschnittliche Reaktionszeit unter 200 ms',
      },
      icon: 'trophy',
      secret: true,
    },
    {
      id: 'reaction_sequence_10',
      title: { en: 'Pattern Master', de: 'Muster-Meister' },
      description: {
        en: 'Reach level 10 or higher in Sequence Memory',
        de: 'Erreiche Level 10 oder höher im Sequenz-Gedächtnis',
      },
      icon: 'trophy',
      goal: 10,
    },
    {
      id: 'reaction_number_8',
      title: { en: 'Digit Vault', de: 'Zahlensafe' },
      description: { en: 'Memorize and recall an 8-digit number', de: 'Merke dir eine 8-stellige Zahl' },
      icon: 'trophy',
      goal: 8,
    },
    {
      id: 'reaction_aim_master',
      title: { en: 'Deadshot Precision', de: 'Präzisionsschütze' },
      description: {
        en: 'Achieve 95% or higher accuracy in Aim Trainer',
        de: 'Erreiche 95% oder höhere Genauigkeit im Ziel-Trainer',
      },
      icon: 'star',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  load: () => import('./index.js'),
};
