import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createLogger } from '../../src/kernel/logger.js';
import { connectOsAchievements } from '../../src/kernel/os-achievements.js';
import { ACHIEVEMENTS_STORE_SCHEMA, createAchievements } from '../../src/services/achievements/achievements.js';
import { populateDemoWorkspace } from '../../src/services/profiles/demo.js';
import { createSettings, SETTINGS_STORE_SCHEMA } from '../../src/services/settings/settings.js';
import { SYSTEM_SETTINGS } from '../../src/services/settings/system-settings.js';
import { createIdbEngine } from '../../src/services/storage/engine-idb.js';
import { META_STORE_SCHEMA } from '../../src/services/storage/migrations.js';
import { createTipsService } from '../../src/services/tips/tips.js';
import { createVfs, VFS_STORE_SCHEMA } from '../../src/services/vfs/vfs.js';
import { extractLatestChangelog } from '../../src/shell/whats-new.js';

function memKv() {
  const m = new Map();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => {
      m.set(k, v);
    },
  };
}

describe('OS-wide achievements, tips, demo workspace & changelog extraction', () => {
  it('unlocks explorer, theme_artist, backup_guardian, focus_initiate, and konami_secret via bus events', async () => {
    const db = await createIdbEngine().open('os-ach-db', {
      ...META_STORE_SCHEMA,
      ...ACHIEVEMENTS_STORE_SCHEMA,
    });
    const bus = createEventBus();
    const log = createLogger();
    const achievements = createAchievements({ db, bus, log, store: memKv() });
    await achievements.load();

    const disconnect = connectOsAchievements({ bus, achievements, kv: memKv() });

    // Launch 5 unique apps (and duplicate one to ensure unique counting)
    for (const appId of ['nexus.notes', 'nexus.files', 'nexus.notes', 'nexus.terminal', 'nexus.arcade', 'nexus.help']) {
      bus.emit('app:launched', { appId });
    }
    bus.emit('settings:changed', { scope: 'system', key: 'theme', value: 'synthwave' });
    bus.emit('settings:changed', { scope: 'system', key: 'doNotDisturb', value: true });
    bus.emit('storage:changed', { scope: 'system:backup', key: 'lastAt' });
    bus.emit('easter-egg:konami', { at: Date.now() });

    await new Promise((r) => setTimeout(r, 40));

    const systemList = await achievements.list('system');
    const unlockedIds = new Set(systemList.filter((a) => a.unlockedAt).map((a) => a.id));
    expect(unlockedIds.has('explorer')).toBe(true);
    expect(unlockedIds.has('theme_artist')).toBe(true);
    expect(unlockedIds.has('focus_initiate')).toBe(true);
    expect(unlockedIds.has('backup_guardian')).toBe(true);
    expect(unlockedIds.has('konami_secret')).toBe(true);
    expect(unlockedIds.has('all_apps')).toBe(false);

    const allStats = achievements.allStats();
    expect(allStats.system.appsLaunched).toBe(6);

    disconnect();
  });

  it('tips service respects dailyTips setting, new profile grace window, and 24h cooldown', async () => {
    const db = await createIdbEngine().open('tips-db', { ...META_STORE_SCHEMA, ...SETTINGS_STORE_SCHEMA });
    const bus = createEventBus();
    const log = createLogger();
    const settings = createSettings({ db, bus, log });
    settings.register('system', SYSTEM_SETTINGS);
    await settings.load();

    let currentNow = 1_000_000;
    const onAction = vi.fn();
    const notify = vi.fn(async () => ({ onAction }));
    const executeCommand = vi.fn(async () => {});

    const tips = createTipsService({
      kv: memKv(),
      settings,
      notifications: /** @type {any} */ ({ notify }),
      executeCommand,
      text: (k) => k,
      now: () => currentNow,
      profileCreatedAt: 990_000, // 10s ago -> inside 60s grace window
    });

    expect(await tips.maybeShowTip()).toBeNull();
    expect(notify).not.toHaveBeenCalled();

    // Past 60s grace window
    currentNow = 1_200_000;
    const first = await tips.maybeShowTip();
    expect(first).toBe('palette');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);

    // Within 24h cooldown -> suppressed
    currentNow += 60 * 60 * 1000;
    expect(await tips.maybeShowTip()).toBeNull();

    // Past 24h -> next unseen tip shown
    currentNow += 24 * 60 * 60 * 1000;
    const second = await tips.maybeShowTip();
    expect(second).toBe('snap');
    expect(notify).toHaveBeenCalledTimes(2);

    // Disabled via setting -> suppressed unless forced
    await settings.set('system', 'dailyTips', false);
    currentNow += 48 * 60 * 60 * 1000;
    expect(await tips.maybeShowTip()).toBeNull();
    expect(await tips.maybeShowTip({ force: true })).toBe('workspaces');
  });

  it('populateDemoWorkspace creates sample notes, spreadsheets, and code without overwriting edits', async () => {
    const db = await createIdbEngine().open('demo-db', { ...META_STORE_SCHEMA, ...VFS_STORE_SCHEMA });
    const vfs = createVfs({ db, bus: createEventBus(), user: 'demo' });
    await vfs.init();
    const kv = memKv();

    const created = await populateDemoWorkspace(vfs, { kv });
    expect(created).toBe(5);
    expect(await vfs.exists('/home/demo/Documents/Welcome Demo.md')).toBe(true);
    expect(await vfs.exists('/home/demo/Documents/Budget 2026.csv')).toBe(true);
    expect(await vfs.exists('/home/demo/Code/fibonacci.js')).toBe(true);

    // Does not overwrite existing user edit
    await vfs.writeFile('/home/demo/Documents/Welcome Demo.md', 'custom edit');
    await populateDemoWorkspace(vfs);
    expect(await vfs.readText('/home/demo/Documents/Welcome Demo.md')).toBe('custom edit');
  });

  it('extractLatestChangelog returns top release section cleanly', () => {
    const md = `# Changelog\n\n## [1.0.0] - 2026-11-13\n- First release feature\n\n## [0.12.0] - 2026-11-12\n- Older change`;
    const latest = extractLatestChangelog(md);
    expect(latest).toContain('[1.0.0]');
    expect(latest).toContain('First release feature');
    expect(latest).not.toContain('Older change');
  });
});
