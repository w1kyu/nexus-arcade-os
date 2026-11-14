// @ts-check
// OS-wide achievements & cross-app milestone tracking.

/** @type {import('./types').AchievementDecl[]} */
export const OS_ACHIEVEMENTS = [
  {
    id: 'explorer',
    title: { en: 'Desktop Explorer', de: 'Desktop-Entdecker' },
    description: { en: 'Open 5 different apps in Nexus.', de: 'Öffne 5 verschiedene Apps in Nexus.' },
    icon: 'apps',
    goal: 5,
  },
  {
    id: 'all_apps',
    title: { en: 'Power User', de: 'Power-Nutzer' },
    description: { en: 'Try 15 different apps across Nexus.', de: 'Probiere 15 verschiedene Apps in Nexus aus.' },
    icon: 'rocket',
    goal: 15,
  },
  {
    id: 'theme_artist',
    title: { en: 'Style Architect', de: 'Stil-Architekt' },
    description: {
      en: 'Customize your OS theme, accent color, or custom theme.',
      de: 'Passe dein Systemdesign, deine Akzentfarbe oder ein eigenes Design an.',
    },
    icon: 'palette',
  },
  {
    id: 'backup_guardian',
    title: { en: 'Data Guardian', de: 'Daten-Hüter' },
    description: {
      en: 'Export a profile backup to keep your data safe.',
      de: 'Exportiere eine Profilsicherung, um deine Daten zu schützen.',
    },
    icon: 'shield',
  },
  {
    id: 'widget_curator',
    title: { en: 'Desktop Curator', de: 'Desktop-Kurator' },
    description: {
      en: 'Customize your desktop workspace or widgets.',
      de: 'Passe deine Arbeitsfläche oder Widgets an.',
    },
    icon: 'layout-quarters',
  },
  {
    id: 'focus_initiate',
    title: { en: 'Deep Focus', de: 'Tiefer Fokus' },
    description: {
      en: 'Start a focus session or notification quiet mode.',
      de: 'Starte eine Fokuszeit oder den Nicht-stören-Modus.',
    },
    icon: 'target',
  },
  {
    id: 'konami_secret',
    title: { en: 'Up, Up, Down, Down…', de: 'Oben, Oben, Unten, Unten …' },
    description: {
      en: 'Entered the classic secret code on the Nexus desktop.',
      de: 'Den klassischen Geheimcode auf dem Nexus-Desktop eingegeben.',
    },
    icon: 'sparkles',
    secret: true,
  },
];

/**
 * Connects OS-wide achievement declarations and automatic event triggers.
 * @param {object} deps
 * @param {import('./bus.js').EventBus} deps.bus
 * @param {import('../services/achievements/achievements.js').Achievements} deps.achievements
 * @param {{ get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<unknown> }} deps.kv
 */
export function connectOsAchievements({ bus, achievements, kv }) {
  achievements.register('system', OS_ACHIEVEMENTS);
  let disposed = false;

  const safe = (/** @type {Promise<unknown>} */ p) => p.catch(() => {});

  let launchQueue = Promise.resolve();

  const unsubs = [
    bus.on('app:launched', ({ appId }) => {
      if (!appId || disposed) return;
      launchQueue = launchQueue.then(async () => {
        if (disposed) return;
        try {
          const raw = await kv.get('openedApps').catch(() => null);
          if (disposed) return;
          const list = Array.isArray(raw) ? [...new Set([...raw, appId])] : [appId];
          await safe(kv.set('openedApps', list));
          if (disposed) return;
          await safe(achievements.stat('system', 'appsLaunched', 1));
          if (disposed) return;
          await safe(achievements.progress('system', 'explorer', list.length));
          if (disposed) return;
          await safe(achievements.progress('system', 'all_apps', list.length));
        } catch {
          // Ignore shutdown races when the profile database closes right after launch.
        }
      });
    }),
    bus.on('settings:changed', ({ scope, key }) => {
      if (disposed || scope !== 'system') return;
      if (key === 'theme' || key === 'customTheme' || key === 'accent') {
        void safe(achievements.unlock('system', 'theme_artist'));
      }
      if (key === 'doNotDisturb') {
        void safe(achievements.unlock('system', 'focus_initiate'));
      }
    }),
    bus.on('storage:changed', ({ scope, key }) => {
      if (disposed) return;
      if (scope === 'system:backup' && key === 'lastAt') {
        void safe(achievements.unlock('system', 'backup_guardian'));
      }
      if (scope === 'system:shell' && key === 'session') {
        void safe(achievements.unlock('system', 'widget_curator'));
      }
    }),
    bus.on('easter-egg:konami', () => {
      if (disposed) return;
      void safe(achievements.unlock('system', 'konami_secret'));
    }),
  ];

  return () => {
    disposed = true;
    for (const u of unsubs) u();
  };
}
