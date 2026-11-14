// @ts-check
// Profile & Achievements: central XP/level tracker, cross-app milestones, stats, and Nexus Wrapped.
import { h, icon } from '../../ui/dom.js';
import './styles.css';

export const commands = {
  /** @param {import('../../kernel/types').HeadlessContext} ctx */
  'profile.open': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.profile' }),
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export function mount(container, ctx) {
  let tab = /** @type {'achievements' | 'stats' | 'wrapped'} */ ('achievements');
  let filter = /** @type {'all' | 'unlocked' | 'locked' | 'system'} */ ('all');

  /** @param {import('../../kernel/types').L10n | string | null | undefined} val */
  const loc = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val[ctx.i18n.locale] ?? val.en ?? '';
  };

  /** @param {string} appId */
  const appLabel = (appId) => {
    if (appId === 'system') return ctx.i18n.t('appSystem');
    return ctx.system?.apps.name(appId) || appId;
  };

  async function render() {
    const { t } = ctx.i18n;
    const info = ctx.system?.info();
    const profileName = info?.profile?.name ?? 'Nexus';
    const levelInfo = ctx.achievements?.level?.() ?? { level: 1, xp: 0, current: 0, needed: 100 };
    const allAchievements = (await ctx.achievements?.listAll?.().catch(() => [])) ?? [];
    const allStats = ctx.achievements?.allStats?.() ?? {};
    const vfsWalk = /** @type {any[]} */ (await /** @type {any} */ (ctx.fs).walk(ctx.fs.home).catch(() => []));
    const fileCount = vfsWalk.filter((n) => n.type === 'file').length;
    const unlockedTotal = allAchievements.filter((a) => !!a.unlockedAt).length;
    const pct = Math.min(100, Math.round((levelInfo.current / Math.max(1, levelInfo.needed)) * 100));

    const hero = h(
      'section',
      { class: 'nx-profile-hero', 'aria-label': t('title') },
      h('div', { class: 'nx-profile-avatar-badge' }, icon('award', { size: 30 })),
      h(
        'div',
        { class: 'nx-profile-hero-meta' },
        h('h1', { text: profileName }),
        h('p', {
          class: 'nx-profile-hero-sub',
          text: `${t('levelBadge', { level: levelInfo.level })} · ${t('unlockedCount', { unlocked: unlockedTotal, total: allAchievements.length })}`,
        }),
      ),
      h(
        'div',
        { class: 'nx-profile-xp-block' },
        h(
          'div',
          { class: 'nx-profile-xp-top' },
          h('span', { text: t('totalXp', { xp: levelInfo.xp }) }),
          h('span', { text: t('nextLevel', { current: levelInfo.current, needed: levelInfo.needed }) }),
        ),
        h(
          'div',
          {
            class: 'nx-profile-bar',
            role: 'progressbar',
            'aria-label': t('totalXp', { xp: levelInfo.xp }),
            'aria-valuenow': pct,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
          },
          h('div', { style: { width: `${pct}%` } }),
        ),
      ),
    );

    const tabsBar = h(
      'div',
      { class: 'nx-profile-tabs', role: 'tablist', 'aria-label': t('title') },
      .../** @type {const} */ (['achievements', 'stats', 'wrapped']).map((id) =>
        h('button', {
          type: 'button',
          role: 'tab',
          'aria-selected': String(tab === id),
          class: `nx-btn${tab === id ? ' is-primary' : ' is-ghost'}`,
          dataset: { testid: `profile-tab-${id}` },
          text: t(`tabs.${id}`),
          onclick: () => {
            tab = id;
            void render();
          },
        }),
      ),
    );

    const content = h('div', { role: 'tabpanel' });

    if (tab === 'achievements') {
      const filtersBar = h(
        'div',
        { class: 'nx-profile-filters' },
        .../** @type {const} */ (['all', 'unlocked', 'locked', 'system']).map((f) =>
          h('button', {
            type: 'button',
            class: `nx-btn${filter === f ? ' is-primary' : ''}`,
            'aria-pressed': String(filter === f),
            text: t(`filters.${f}`),
            onclick: () => {
              filter = f;
              void render();
            },
          }),
        ),
      );

      const visible = allAchievements.filter((a) => {
        if (filter === 'unlocked') return !!a.unlockedAt;
        if (filter === 'locked') return !a.unlockedAt;
        if (filter === 'system') return a.app === 'system';
        return true;
      });

      const grid = h(
        'div',
        { class: 'nx-profile-grid', dataset: { testid: 'profile-achievements-grid' } },
        ...(visible.length
          ? visible.map((a) => {
              const unlocked = !!a.unlockedAt;
              const titleText = a.title ? loc(a.title) : t('secretTitle');
              const descText = a.description ? loc(a.description) : t('secretDesc');
              const goalPct = a.goal ? Math.min(100, Math.round((a.progress / a.goal) * 100)) : unlocked ? 100 : 0;
              return h(
                'article',
                { class: `nx-profile-card ${unlocked ? 'is-unlocked' : 'is-locked'}` },
                h('div', { class: 'nx-profile-ach-icon' }, icon(a.icon || 'trophy', { size: 20 })),
                h(
                  'div',
                  { class: 'nx-profile-ach-body' },
                  h('div', { class: 'nx-profile-ach-app', text: appLabel(a.app) }),
                  h('div', { class: 'nx-profile-ach-title', text: titleText }),
                  h('div', { class: 'nx-profile-ach-desc', text: descText }),
                  a.goal && !unlocked
                    ? h('div', {
                        class: 'nx-profile-ach-date',
                        text: t('progressLabel', { progress: Math.min(a.progress, a.goal), goal: a.goal }),
                      })
                    : null,
                  a.goal ? h('div', { class: 'nx-profile-bar' }, h('div', { style: { width: `${goalPct}%` } })) : null,
                  unlocked && a.unlockedAt
                    ? h('div', {
                        class: 'nx-profile-ach-date',
                        text: t('unlockedOn', { date: ctx.i18n.date(new Date(a.unlockedAt), { dateStyle: 'medium' }) }),
                      })
                    : null,
                ),
              );
            })
          : [h('p', { class: 'nx-profile-hero-sub', text: t('emptyAchievements') })]),
      );

      content.append(h('div', { style: { display: 'grid', gap: 'var(--space-3)' } }, filtersBar, grid));
    } else if (tab === 'stats') {
      const entries = Object.entries(allStats);
      content.append(
        h(
          'div',
          { style: { display: 'grid', gap: 'var(--space-3)' } },
          h(
            'div',
            { class: 'nx-profile-wrapped-cards' },
            h(
              'div',
              { class: 'nx-profile-stat-box' },
              h('div', { class: 'nx-profile-stat-val', text: String(fileCount) }),
              h('div', { class: 'nx-profile-stat-label', text: t('stats.filesCount', { count: fileCount }) }),
            ),
            h(
              'div',
              { class: 'nx-profile-stat-box' },
              h('div', { class: 'nx-profile-stat-val', text: String(entries.length) }),
              h('div', { class: 'nx-profile-stat-label', text: t('stats.appsTracked', { count: entries.length }) }),
            ),
          ),
          entries.length
            ? h(
                'div',
                { class: 'nx-profile-grid' },
                ...entries.map(([appId, counters]) =>
                  h(
                    'div',
                    { class: 'nx-profile-card' },
                    h('div', { class: 'nx-profile-ach-icon' }, icon('activity', { size: 18 })),
                    h(
                      'div',
                      { class: 'nx-profile-ach-body' },
                      h('div', { class: 'nx-profile-ach-title', text: appLabel(appId) }),
                      ...Object.entries(counters).map(([k, v]) =>
                        h('div', { class: 'nx-profile-ach-desc', text: `${k}: ${v}` }),
                      ),
                    ),
                  ),
                ),
              )
            : h('p', { class: 'nx-profile-hero-sub', text: t('stats.empty') }),
        ),
      );
    } else {
      const year = new Date().getFullYear();
      const appsLaunched = Number(allStats.system?.appsLaunched ?? 0);
      content.append(
        h(
          'section',
          { class: 'nx-profile-wrapped', dataset: { testid: 'nexus-wrapped' } },
          h(
            'div',
            {},
            h('h2', { style: { margin: 0 }, text: t('wrapped.headline', { year }) }),
            h('p', { class: 'nx-profile-hero-sub', text: t('wrapped.subhead', { profile: profileName }) }),
          ),
          h(
            'div',
            { class: 'nx-profile-wrapped-cards' },
            h(
              'div',
              { class: 'nx-profile-stat-box' },
              h('div', { class: 'nx-profile-stat-val', text: t('levelBadge', { level: levelInfo.level }) }),
              h('div', { class: 'nx-profile-stat-label', text: t('wrapped.cardLevel') }),
            ),
            h(
              'div',
              { class: 'nx-profile-stat-box' },
              h('div', { class: 'nx-profile-stat-val', text: String(unlockedTotal) }),
              h('div', { class: 'nx-profile-stat-label', text: t('wrapped.cardAchievements') }),
            ),
            h(
              'div',
              { class: 'nx-profile-stat-box' },
              h('div', { class: 'nx-profile-stat-val', text: String(appsLaunched) }),
              h('div', { class: 'nx-profile-stat-label', text: t('wrapped.cardApps') }),
            ),
            h(
              'div',
              { class: 'nx-profile-stat-box' },
              h('div', { class: 'nx-profile-stat-val', text: String(fileCount) }),
              h('div', { class: 'nx-profile-stat-label', text: t('wrapped.cardFiles') }),
            ),
          ),
          h(
            'div',
            {},
            h(
              'button',
              {
                type: 'button',
                class: 'nx-btn is-primary',
                onclick: () => {
                  const report = [
                    `${t('wrapped.headline', { year })} — ${profileName}`,
                    `${t('wrapped.cardLevel')}: ${levelInfo.level} (${levelInfo.xp} XP)`,
                    `${t('wrapped.cardAchievements')}: ${unlockedTotal} / ${allAchievements.length}`,
                    `${t('wrapped.cardApps')}: ${appsLaunched}`,
                    `${t('wrapped.cardFiles')}: ${fileCount}`,
                  ].join('\n');
                  ctx.fs.downloadBlob(new Blob([report], { type: 'text/plain' }), `nexus-wrapped-${year}.txt`);
                },
              },
              icon('download', { size: 16 }),
              t('wrapped.exportBtn'),
            ),
          ),
        ),
      );
    }

    container.replaceChildren(h('div', { class: 'nx-profile-app' }, hero, tabsBar, content));
  }

  ctx.events.on('achievement:unlocked', () => void render());
  ctx.events.on('achievement:progress', () => void render());
  ctx.events.on('xp:changed', () => void render());
  ctx.i18n.onChange(() => void render());
  void render();

  return {};
}
