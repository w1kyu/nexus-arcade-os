import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createEventBus } from '../../src/kernel/bus.js';
import { createLogger } from '../../src/kernel/logger.js';
import { createRegistry } from '../../src/kernel/registry.js';
import { createPermissions } from '../../src/services/permissions/permissions.js';
import { createPluginManager } from '../../src/services/plugins/manager.js';
import { normalizePluginManifest, parsePluginBlob, PluginPackageError } from '../../src/services/plugins/package.js';
import { createPluginRpcHandler } from '../../src/services/plugins/sandbox.js';

function memoryKv() {
  const map = new Map();
  return {
    get: async (k) => map.get(k),
    set: async (k, v) => {
      map.set(k, v);
    },
    delete: async (k) => {
      map.delete(k);
    },
    clear: async () => {
      map.clear();
    },
    entries: async () => Object.fromEntries(map),
  };
}

describe('plugin package parser', () => {
  it('parses single-file @nexus-plugin JS (example markdown-wordcloud.js)', async () => {
    const src = readFileSync(resolve(import.meta.dirname, '../../examples/plugins/markdown-wordcloud.js'), 'utf8');
    const parsed = await parsePluginBlob(new Blob([src], { type: 'text/javascript' }), 'markdown-wordcloud.js');
    expect(parsed.manifestData.id).toBe('plugin.markdown-wordcloud');
    expect(parsed.manifestData.permissions).toEqual(['vfs', 'notifications']);
    expect(parsed.manifestData.terminal?.[0]?.name).toBe('wordcloud');
    expect(parsed.code).toContain('mount(');
  });

  it('parses .nexus-plugin zip archives including widgets, help, and themes', async () => {
    const dir = resolve(import.meta.dirname, '../../examples/plugins/pomodoro-stats');
    const manifestJson = readFileSync(resolve(dir, 'manifest.json'), 'utf8');
    const mainJs = readFileSync(resolve(dir, 'main.js'), 'utf8');
    const helpMd = readFileSync(resolve(dir, 'help.md'), 'utf8');
    const archive = zipSync({
      'pomodoro-stats/manifest.json': strToU8(manifestJson),
      'pomodoro-stats/main.js': strToU8(mainJs),
      'pomodoro-stats/help.md': strToU8(helpMd),
    });
    const parsed = await parsePluginBlob(new Blob([archive]), 'pomodoro-stats.nexus-plugin');
    expect(parsed.manifestData.id).toBe('plugin.pomodoro-stats');
    expect(parsed.manifestData.widgets?.length).toBe(1);
    expect(parsed.themes?.length).toBe(1);
    expect(parsed.help).toContain('Focus Stats');
  });

  it('rejects zip path traversal and privileged system permission', async () => {
    const traversal = zipSync({
      '../evil.js': strToU8('console.log(1)'),
      'manifest.json': strToU8(JSON.stringify({ id: 'bad.plugin', name: 'Bad', version: '1.0.0', main: 'main.js' })),
    });
    await expect(parsePluginBlob(new Blob([traversal]), 'bad.nexus-plugin')).rejects.toThrow(/unsafe path/i);

    expect(() =>
      normalizePluginManifest({
        id: 'evil.sys',
        name: 'Evil',
        version: '1.0.0',
        permissions: ['system'],
      }),
    ).toThrow(PluginPackageError);
  });
});

describe('plugin sandbox permissions & lifecycle', () => {
  it('enforces first-use permissions and revocation over RPC', async () => {
    const kv = memoryKv();
    const bus = createEventBus();
    let registered = { builtIn: false, declared: ['vfs', 'notifications'] };
    let allowVfs = true;
    const ask = vi.fn(async (_app, perm) => perm === 'vfs' && allowVfs);
    const permissions = createPermissions({
      store: kv,
      bus,
      appInfo: () => registered,
      ask,
    });
    await permissions.load();

    const pluginKv = memoryKv();
    const notify = vi.fn(async () => ({ id: 'n1', close() {} }));
    const readText = vi.fn(async () => 'hello world');

    const rpc = createPluginRpcHandler({
      pluginId: 'community.demo',
      permissions,
      kv: pluginKv,
      vfs: /** @type {any} */ ({
        home: '/home/user',
        readText,
        writeFile: vi.fn(),
        list: vi.fn(),
        exists: vi.fn(),
        stat: vi.fn(),
        mkdir: vi.fn(),
      }),
      notifications: /** @type {any} */ ({ notify }),
      clipboard: /** @type {any} */ ({ readText: vi.fn(), writeText: vi.fn() }),
      intents: /** @type {any} */ ({ open: vi.fn(), share: vi.fn() }),
      scheduler: /** @type {any} */ ({ schedule: vi.fn(), cancel: vi.fn(), list: vi.fn() }),
      ai: /** @type {any} */ ({ isAvailable: () => false }),
      commands: /** @type {any} */ ({ execute: vi.fn() }),
      dialogs: /** @type {any} */ ({ alert: vi.fn(), confirm: vi.fn(), prompt: vi.fn() }),
      theme: /** @type {any} */ ({ current: 'neon-night', scheme: 'dark', token: () => '#fff' }),
    });

    // Scoped KV always allowed without prompt
    await rpc('kv.set', ['score', 42]);
    expect(await rpc('kv.get', ['score'])).toBe(42);
    expect(ask).not.toHaveBeenCalled();

    // VFS prompts once -> allowed -> cached
    expect(await rpc('vfs.readText', ['/home/user/a.txt'])).toBe('hello world');
    expect(await rpc('vfs.readText', ['/home/user/a.txt'])).toBe('hello world');
    expect(ask).toHaveBeenCalledTimes(1);

    // Revoking VFS resets grant so it prompts again and respects user denial
    await permissions.revoke('community.demo', 'vfs');
    expect(permissions.status('community.demo', 'vfs')).toBe('ask');
    allowVfs = false;
    await expect(rpc('vfs.readText', ['/home/user/a.txt'])).rejects.toThrow(/permission/i);
    expect(ask).toHaveBeenCalledTimes(2);

    // Undeclared clipboard permission denied automatically
    await expect(rpc('clipboard.readText', [])).rejects.toThrow(/permission/i);
  });

  it('installs, registers theme/commands/widgets, isolates per-plugin KV, and uninstalls', async () => {
    const bus = createEventBus();
    const log = createLogger().child('plugins');
    const registry = createRegistry({ bus, log });
    const kv = memoryKv();
    const perPlugin = new Map();
    const pluginKv = (scope) => {
      if (!perPlugin.has(scope)) perPlugin.set(scope, memoryKv());
      return perPlugin.get(scope);
    };
    const registeredThemes = [];
    const removedThemes = [];
    const commands = new Map();
    const manager = createPluginManager({
      kv,
      pluginKv,
      registry,
      lifecycle: /** @type {any} */ ({ list: () => [], close: async () => {} }),
      permissions: /** @type {any} */ ({
        status: () => 'denied',
        ensure: async () => false,
        revokeAll: async () => {},
        clearApp: async () => {},
      }),
      vfs: /** @type {any} */ ({ home: '/home/u', watch: () => () => {} }),
      notifications: /** @type {any} */ ({}),
      clipboard: /** @type {any} */ ({}),
      intents: /** @type {any} */ ({}),
      scheduler: /** @type {any} */ ({}),
      ai: /** @type {any} */ ({}),
      commands: /** @type {any} */ ({
        register: (c) => {
          commands.set(c.id, c);
          return () => commands.delete(c.id);
        },
        execute: async () => {},
      }),
      shortcuts: /** @type {any} */ ({ setDefault: () => {} }),
      settings: /** @type {any} */ ({ register: () => {}, resetScope: async () => {} }),
      i18n: /** @type {any} */ ({ register: () => {} }),
      theme: /** @type {any} */ ({
        current: 'neon-night',
        scheme: 'dark',
        registerThemes: (ownerId, themes) => {
          registeredThemes.push(...themes);
          return () => {
            for (const t of themes) removedThemes.push(`${ownerId}:${t.id}`);
          };
        },
      }),
      dialogs: /** @type {any} */ ({}),
      bus,
      log,
      localize: (v) => (typeof v === 'string' ? v : v.en),
    });

    const dir = resolve(import.meta.dirname, '../../examples/plugins/pomodoro-stats');
    const archive = zipSync({
      'manifest.json': strToU8(readFileSync(resolve(dir, 'manifest.json'), 'utf8')),
      'main.js': strToU8(readFileSync(resolve(dir, 'main.js'), 'utf8')),
    });

    const installed = await manager.installFromFile(new Blob([archive]), 'pomodoro-stats.nexus-plugin');
    expect(installed.id).toBe('plugin.pomodoro-stats');
    expect(registry.has('plugin.pomodoro-stats')).toBe(true);
    expect(registeredThemes.map((t) => t.id)).toContain('plugin:plugin.pomodoro-stats:amber-focus');

    await pluginKv('plugin:plugin.pomodoro-stats').set('k', 'secret');
    await manager.uninstall('plugin.pomodoro-stats', { wipeData: true });
    expect(registry.has('plugin.pomodoro-stats')).toBe(false);
    expect(removedThemes).toContain('plugin.pomodoro-stats:plugin:plugin.pomodoro-stats:amber-focus');
    expect(await pluginKv('plugin:plugin.pomodoro-stats').get('k')).toBeUndefined();
  });
});
