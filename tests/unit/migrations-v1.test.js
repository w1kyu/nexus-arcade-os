import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createLogger } from '../../src/kernel/logger.js';
import { createPluginManager } from '../../src/services/plugins/manager.js';
import { createSettings, SETTINGS_STORE_SCHEMA } from '../../src/services/settings/settings.js';
import { SYSTEM_SETTINGS } from '../../src/services/settings/system-settings.js';
import { createIdbEngine } from '../../src/services/storage/engine-idb.js';
import { getDataVersion, META_STORE_SCHEMA, runMigrations } from '../../src/services/storage/migrations.js';
import { parseCustomThemeJson } from '../../src/services/theme/engine.js';
import { createVfs, VFS_STORE_SCHEMA } from '../../src/services/vfs/vfs.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'fixtures', name), 'utf8'));
}

describe('data safety: historical version snapshots -> v1.0.0 migrations', () => {
  it('migrates Phase 1 (v0.1) settings, invalid bounds, VFS, and versioned app records cleanly', async () => {
    const snap = loadFixture('snapshot-v01.json');
    const engine = createIdbEngine();
    const STORE = 'app:nexus.notes/notes';
    const db = await engine.open('migrate-v01', {
      ...META_STORE_SCHEMA,
      ...SETTINGS_STORE_SCHEMA,
      ...VFS_STORE_SCHEMA,
      [STORE]: { keyPath: 'id' },
    });

    for (const s of snap.legacySettings) {
      await db.put('settings', s);
    }
    for (const n of snap.legacyNotes) {
      await db.put(STORE, n);
    }

    // Settings coerce out-of-range v0.1 values into valid v1.0 bounds while keeping valid selections
    const bus = createEventBus();
    const log = createLogger().child('settings');
    const settings = createSettings({ db, bus, log });
    settings.register('system', SYSTEM_SETTINGS);
    await settings.load();

    expect(settings.get('system', 'language')).toBe('en');
    expect(settings.get('system', 'theme')).toBe('neon-night');
    // fontScale was 99 -> coerced to max allowed (1.5) without throwing
    expect(settings.get('system', 'fontScale')).toBe(1.5);
    // New v1.0 settings fall back cleanly to defaults
    expect(settings.get('system', 'titlebarStyle')).toBe('windows');
    expect(settings.get('system', 'dailyTips')).toBe(true);

    // Schema migration from version 0 -> v2 keeps existing note data intact
    const migRes = await runMigrations({
      db,
      scope: 'nexus.notes',
      target: 2,
      stores: [STORE],
      migrations: [
        {
          to: 1,
          run: async (tx) => {
            for (const row of await tx.getAll(STORE)) {
              await tx.put(STORE, { ...row, tags: row.tags ?? [] });
            }
          },
        },
        {
          to: 2,
          run: async (tx) => {
            for (const { body, ...rest } of await tx.getAll(STORE)) {
              await tx.put(STORE, { ...rest, text: rest.text ?? body ?? '' });
            }
          },
        },
      ],
    });
    expect(migRes.status).toBe('ok');
    expect(await getDataVersion(db, 'nexus.notes')).toBe(2);
    expect(await db.get(STORE, 'legacy-n1')).toEqual({
      id: 'legacy-n1',
      tags: [],
      text: 'Phase 1 early note body',
    });
  });

  it('migrates Phase 6 (v0.6) profiles, partial custom themes, and initialises plugin manager empty cleanly', async () => {
    const snap = loadFixture('snapshot-v06.json');
    const engine = createIdbEngine();
    const db = await engine.open('migrate-v06', {
      ...META_STORE_SCHEMA,
      ...SETTINGS_STORE_SCHEMA,
      ...VFS_STORE_SCHEMA,
    });

    for (const s of snap.legacySettings) {
      await db.put('settings', s);
    }

    const bus = createEventBus();
    const log = createLogger().child('settings');
    const settings = createSettings({ db, bus, log });
    settings.register('system', SYSTEM_SETTINGS);
    await settings.load();

    // Unknown future keys are harmlessly ignored; known settings persist
    expect(settings.get('system', 'theme')).toBe('synthwave');
    expect(settings.get('system', 'titlebarStyle')).toBe('macos');

    // Partial custom theme fills missing v1.0 tokens safely
    const normalized = parseCustomThemeJson(JSON.stringify(snap.legacyCustomTheme));
    expect(normalized?.name.en).toBe('Legacy Neon');
    expect(normalized?.colors.bg).toBe('#05060d');
    expect(normalized?.colors.surface1).toBeTruthy();

    // VFS and PluginManager initialize safely over pre-plugin profiles
    const vfs = createVfs({ db, bus, user: snap.profile.username });
    await vfs.init();
    expect(await vfs.exists('/home/creative/Documents')).toBe(true);

    const mem = new Map();
    const pm = createPluginManager({
      vfs,
      kv: {
        get: async (k) => mem.get(k),
        set: async (k, v) => {
          mem.set(k, v);
        },
        delete: async (k) => {
          mem.delete(k);
        },
        entries: async () => Object.fromEntries(mem),
      },
      permissions: /** @type {any} */ ({ revokeAll: async () => {}, clearApp: async () => {} }),
      bus,
      log,
    });
    await pm.loadAll();
    expect(pm.list()).toEqual([]);
  });
});
