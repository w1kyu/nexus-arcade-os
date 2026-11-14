// @ts-check
// Feature discovery tips notifications: max one per day, respects `dailyTips` setting,
// and never fires in the first 60 seconds of a brand-new profile.

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_PROFILE_GRACE_MS = 60 * 1000;

export const TIPS = [
  { id: 'palette', cmd: 'shell.palette' },
  { id: 'snap', cmd: 'shell.tour' },
  { id: 'workspaces', cmd: 'shell.overview' },
  { id: 'themeEditor', cmd: 'settings.open', args: { page: 'themeEditor' } },
  { id: 'backup', cmd: 'settings.open', args: { page: 'backup' } },
  { id: 'plugins', cmd: 'shell.launchApp', args: { appId: 'nexus.appcenter' } },
  { id: 'widgets', cmd: 'shell.widgets.add' },
  { id: 'profile', cmd: 'shell.launchApp', args: { appId: 'nexus.profile' } },
];

/**
 * @param {object} deps
 * @param {{ get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<unknown> }} deps.kv
 * @param {import('../settings/settings.js').Settings} deps.settings
 * @param {import('../notifications/notifications.js').Notifications} deps.notifications
 * @param {(id: string, args?: unknown) => Promise<unknown>} deps.executeCommand
 * @param {(key: string, vars?: Record<string, unknown>) => string} deps.text
 * @param {() => number} [deps.now]
 * @param {number} [deps.profileCreatedAt]
 */
export function createTipsService({
  kv,
  settings,
  notifications,
  executeCommand,
  text,
  now = Date.now,
  profileCreatedAt = 0,
}) {
  async function maybeShowTip({ force = false } = {}) {
    if (!force && !settings.get('system', 'dailyTips')) return null;
    const tNow = now();
    if (!force && profileCreatedAt && tNow - profileCreatedAt < NEW_PROFILE_GRACE_MS) {
      return null;
    }

    const lastShownAt = Number((await kv.get('lastShownAt')) ?? 0);
    if (!force && lastShownAt > 0 && tNow - lastShownAt < DAY_MS) {
      return null;
    }

    const rawSeen = await kv.get('seenIds');
    const seen = Array.isArray(rawSeen) ? rawSeen : [];
    const next = TIPS.find((tip) => !seen.includes(tip.id)) ?? TIPS[seen.length % TIPS.length];

    await kv.set('lastShownAt', tNow);
    await kv.set('seenIds', [...new Set([...seen, next.id])]);

    const handle = await notifications.notify({
      title: text(`tips.${next.id}.title`),
      body: text(`tips.${next.id}.body`),
      timeoutMs: 8000,
      actions: [{ id: 'try', label: text('tips.tryAction') }],
    });
    handle?.onAction?.(() => void executeCommand(next.cmd, next.args));
    return next.id;
  }

  return { maybeShowTip };
}
