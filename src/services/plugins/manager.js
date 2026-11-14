// @ts-check
// Plugin lifecycle manager: installs plugins from .nexus-plugin (zip/JSON), VFS folders, or
// single .js files; persists them in the profile's `system:plugins` KV store; wires manifests
// into registry, commands, widgets, terminal, themes and permissions; supports dev-mode reload.
import { parsePluginBlob, parsePluginFromVfs, PluginPackageError } from './package.js';
import { createPluginRpcHandler, mountSandboxedPluginFrame, runSandboxedHeadless } from './sandbox.js';

/**
 * @typedef {object} PluginSource
 * @property {'file' | 'vfs'} kind
 * @property {string} [name]
 * @property {string} [path]
 * @property {boolean} [devMode]
 */

/**
 * @typedef {object} PluginRecord
 * @property {string} id
 * @property {Record<string, any>} manifestData
 * @property {string} code
 * @property {string} css
 * @property {Record<string, string>} widgetCodes
 * @property {any[]} themes
 * @property {string | null} help
 * @property {string | null} changelog
 * @property {{ en: Record<string, unknown>, de: Record<string, unknown> } | null} messages
 * @property {PluginSource} source
 * @property {number} installedAt
 * @property {number} updatedAt
 */

/**
 * @param {object} deps
 * @param {{ get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<unknown>, delete(k: string): Promise<unknown>, entries(): Promise<Record<string, unknown>> }} deps.kv
 * @param {(scope: string) => any} deps.pluginKv
 * @param {import('../../kernel/registry.js').Registry} deps.registry
 * @param {import('../../kernel/lifecycle.js').Lifecycle} deps.lifecycle
 * @param {import('../permissions/permissions.js').Permissions} deps.permissions
 * @param {import('../vfs/vfs.js').Vfs} deps.vfs
 * @param {import('../notifications/notifications.js').Notifications} deps.notifications
 * @param {import('../clipboard/clipboard.js').ClipboardService} deps.clipboard
 * @param {import('../../kernel/intents.js').Intents} deps.intents
 * @param {import('../scheduler/scheduler.js').Scheduler} deps.scheduler
 * @param {import('../ai/ai.js').AiService} deps.ai
 * @param {import('../commands/commands.js').Commands} deps.commands
 * @param {import('../commands/shortcuts.js').Shortcuts} deps.shortcuts
 * @param {import('../settings/settings.js').Settings} deps.settings
 * @param {import('../i18n/i18n.js').I18nService} deps.i18n
 * @param {import('../theme/engine.js').ThemeService} deps.theme
 * @param {{ alert(m: string): Promise<void>, confirm(m: string): Promise<boolean>, prompt(m: string, v?: string): Promise<string | null> }} deps.dialogs
 * @param {import('../../kernel/bus.js').EventBus} deps.bus
 * @param {import('../../kernel/logger.js').Logger} deps.log
 * @param {(text: import('../../kernel/types').L10n | string) => string} deps.localize
 * @param {() => boolean} [deps.isSafeMode]
 */
export function createPluginManager(deps) {
  const {
    kv,
    pluginKv,
    registry,
    lifecycle,
    permissions,
    vfs,
    notifications,
    clipboard,
    intents,
    scheduler,
    ai,
    commands,
    shortcuts,
    settings,
    i18n,
    theme,
    dialogs,
    bus,
    log,
    localize,
    isSafeMode = () => false,
  } = deps;

  /** @type {Map<string, PluginRecord>} */
  const records = new Map();
  /** @type {Map<string, () => void>} */
  const cleanups = new Map();
  /** @type {Map<string, () => void>} */
  const watchers = new Map();

  /** @param {string} pluginId */
  const scopedKv = (pluginId) => pluginKv(`plugin:${pluginId}`);

  /** @param {PluginRecord} record @param {any} [extras] */
  function rpcFor(record, extras = {}) {
    return createPluginRpcHandler({
      pluginId: record.id,
      permissions,
      kv: scopedKv(record.id),
      vfs,
      notifications,
      clipboard,
      intents,
      scheduler,
      ai,
      commands,
      dialogs,
      theme,
      ...extras,
    });
  }

  /** @param {PluginRecord} record @returns {import('../../kernel/types').AppManifest} */
  function buildManifest(record) {
    const m = structuredClone(record.manifestData);
    const pluginId = record.id;

    /** @type {import('../../kernel/types').AppManifest} */
    const manifest = /** @type {any} */ ({
      ...m,
      help: record.help ? async () => /** @type {string} */ (record.help) : undefined,
      changelog: record.changelog ? async () => /** @type {string} */ (record.changelog) : undefined,
      messages: record.messages
        ? {
            en: async () => ({ default: record.messages?.en ?? {} }),
            de: async () => ({ default: record.messages?.de ?? {} }),
          }
        : undefined,
      widgets: Array.isArray(m.widgets)
        ? m.widgets.map((/** @type {any} */ w) => ({
            ...w,
            load: async () => ({
              /** @param {HTMLElement} container @param {import('../../kernel/types').WidgetContext} wctx */
              mount(container, wctx) {
                const live = records.get(pluginId) ?? record;
                const widgetCode = live.widgetCodes?.[w.id] ?? live.code;
                const handle = mountSandboxedPluginFrame({
                  container,
                  mode: 'widget',
                  pluginId,
                  title: localize(w.title),
                  version: live.manifestData.version,
                  instanceId: wctx.widget.id,
                  code: widgetCode,
                  css: live.css,
                  hostCtx: /** @type {any} */ (wctx),
                  rpcHandler: rpcFor(live, {
                    widgetHandle: {
                      get: (/** @type {string} */ k) => wctx.widget.config.get(k),
                      set: (/** @type {string} */ k, /** @type {unknown} */ v) => wctx.widget.config.set(k, v),
                      size: () => wctx.widget.size(),
                    },
                  }),
                });
                const offResize = wctx.widget.onResize((size) => handle.pushWidgetResize(size));
                return {
                  unmount() {
                    offResize();
                    handle.unmount();
                  },
                };
              },
            }),
          }))
        : undefined,
      load: async () => {
        const live = records.get(pluginId) ?? record;
        /** @type {Record<string, any>} */
        const commandHandlers = {};
        for (const decl of live.manifestData.commands ?? []) {
          commandHandlers[decl.id] = async (/** @type {any} */ _ctx, /** @type {any} */ args) =>
            runSandboxedHeadless({
              pluginId,
              version: live.manifestData.version,
              code: live.code,
              locale: i18n.locale,
              themeName: theme.current,
              scheme: /** @type {'dark' | 'light'} */ (theme.scheme),
              rpcHandler: rpcFor(live),
              call: { kind: 'command', id: decl.id, args },
            });
        }

        /** @type {Record<string, any>} */
        const terminalHandlers = {};
        for (const decl of live.manifestData.terminal ?? []) {
          terminalHandlers[decl.name] = async (/** @type {any} */ _ctx, /** @type {any} */ io) =>
            runSandboxedHeadless({
              pluginId,
              version: live.manifestData.version,
              code: live.code,
              locale: i18n.locale,
              themeName: theme.current,
              scheme: /** @type {'dark' | 'light'} */ (theme.scheme),
              rpcHandler: rpcFor(live, {
                onTermOut: (/** @type {string} */ text) => io.out(text),
                onTermErr: (/** @type {string} */ text) => io.err(text),
              }),
              call: {
                kind: 'terminal',
                name: decl.name,
                args: io.args ?? [],
                stdin: io.stdin ?? null,
                cwd: io.cwd ?? vfs.home,
                env: io.env ?? {},
              },
              signal: io.signal,
            });
        }

        return {
          /** @param {HTMLElement} container @param {import('../../kernel/types').AppContext} ctx @param {Record<string, unknown>} [args] */
          mount(container, ctx, args) {
            const current = records.get(pluginId) ?? record;
            const title = localize(current.manifestData.name);
            const handle = mountSandboxedPluginFrame({
              container,
              mode: 'app',
              pluginId,
              title,
              version: current.manifestData.version,
              instanceId: ctx.app.instanceId,
              code: current.code,
              css: current.css,
              launchArgs: args,
              hostCtx: ctx,
              rpcHandler: rpcFor(current, { windowHandle: ctx.window }),
              onReload: current.source.kind === 'vfs' ? () => void reload(pluginId) : undefined,
            });
            return {
              unmount: () => handle.unmount(),
            };
          },
          commands: commandHandlers,
          terminal: terminalHandlers,
        };
      },
    });
    return manifest;
  }

  /** @param {string} id */
  function teardownRegistration(id) {
    cleanups.get(id)?.();
    cleanups.delete(id);
    if (registry.has(id)) registry.unregister(id);
  }

  /** @param {PluginRecord} record */
  function activate(record) {
    teardownRegistration(record.id);
    const manifest = buildManifest(record);
    /** @type {(() => void)[]} */
    const disposers = [];

    if (manifest.settings?.length) {
      try {
        settings.register(record.id, manifest.settings);
      } catch {
        // already registered on reload
      }
    }
    if (manifest.messages) {
      i18n.register(record.id, manifest.messages);
    }

    registry.register(manifest);

    for (const decl of manifest.commands ?? []) {
      const unsub = commands.register({
        id: decl.id,
        title: decl.title,
        icon: decl.icon,
        category: manifest.name,
        when: decl.when,
        source: record.id,
        run: async (args) => {
          const mod = await registry.load(record.id);
          const handler = mod.commands?.[decl.id];
          if (!handler) throw new Error(`Plugin ${record.id} missing handler for ${decl.id}`);
          return handler(/** @type {any} */ ({}), args);
        },
      });
      disposers.push(unsub);
      if (decl.shortcut) shortcuts.setDefault(decl.id, decl.shortcut);
    }

    if (record.themes?.length && typeof (/** @type {any} */ (theme).registerThemes) === 'function') {
      const unregTheme = /** @type {any} */ (theme).registerThemes(record.id, record.themes);
      if (typeof unregTheme === 'function') disposers.push(unregTheme);
    }

    cleanups.set(record.id, () => {
      for (const fn of disposers) {
        try {
          fn();
        } catch {
          // ignore
        }
      }
    });
  }

  /** @param {string} id @param {PluginSource} source */
  function setupDevWatch(id, source) {
    watchers.get(id)?.();
    watchers.delete(id);
    if (source.kind !== 'vfs' || !source.devMode || !source.path) return;
    let timer = /** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined);
    const unwatch = vfs.watch(
      source.path,
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void reload(id, { silent: false }).catch((err) => log.warn(`Plugin dev-mode reload failed for "${id}"`, err));
        }, 250);
      },
      { recursive: true },
    );
    watchers.set(id, () => {
      clearTimeout(timer);
      unwatch();
    });
  }

  /**
   * Commits a parsed package into IndexedDB and activates it.
   * @param {Awaited<ReturnType<typeof parsePluginBlob>>} pkg
   * @param {PluginSource} source
   */
  async function commitPackage(pkg, source) {
    const id = pkg.manifestData.id;
    const prev = records.get(id);
    // Built-in apps cannot be overwritten by a plugin.
    if (!prev && registry.has(id)) {
      throw new PluginPackageError(`Cannot overwrite built-in app "${id}".`);
    }

    for (const inst of lifecycle.list()) {
      if (inst.appId === id) await lifecycle.close(inst.id, { force: true });
    }

    /** @type {PluginRecord} */
    const record = {
      id,
      manifestData: pkg.manifestData,
      code: pkg.code,
      css: pkg.css,
      widgetCodes: pkg.widgetCodes,
      themes: pkg.themes,
      help: pkg.help,
      changelog: pkg.changelog,
      messages: pkg.messages,
      source,
      installedAt: prev?.installedAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    records.set(id, record);
    await kv.set(id, record);
    activate(record);
    setupDevWatch(id, source);
    bus.emit('plugins:changed', { action: prev ? 'updated' : 'installed', id });
    return describe(record);
  }

  /** @param {PluginRecord} r */
  function describe(r) {
    return {
      id: r.id,
      name: r.manifestData.name,
      version: r.manifestData.version,
      permissions: r.manifestData.permissions ?? [],
      source: r.source,
      devMode: Boolean(r.source.kind === 'vfs' && r.source.devMode),
      installedAt: r.installedAt,
      updatedAt: r.updatedAt,
      themes: r.themes.map((t) => ({ id: t.id, name: t.name })),
    };
  }

  /** @param {string} id @param {{ silent?: boolean }} [opts] */
  async function reload(id, { silent = false } = {}) {
    const existing = records.get(id);
    if (!existing) throw new Error(`Plugin "${id}" is not installed`);
    if (existing.source.kind !== 'vfs' || !existing.source.path) {
      throw new Error(`Plugin "${id}" was not installed from a VFS path`);
    }
    const pkg = await parsePluginFromVfs(vfs, existing.source.path);
    if (pkg.manifestData.id !== id) {
      throw new PluginPackageError(`Manifest id changed from "${id}" to "${pkg.manifestData.id}" during reload.`);
    }
    const info = await commitPackage(pkg, existing.source);
    if (!silent) {
      await notifications.notify({
        title: `${localize(pkg.manifestData.name)} reloaded`,
        body: `v${pkg.manifestData.version} (dev mode)`,
        timeoutMs: 2500,
      });
    }
    return info;
  }

  return {
    async loadAll() {
      if (isSafeMode()) {
        log.warn('Safe mode active: skipping community plugins.');
        return;
      }
      const saved = await kv.entries();
      for (const [id, raw] of Object.entries(saved)) {
        if (!raw || typeof raw !== 'object') continue;
        const rec = /** @type {PluginRecord} */ (raw);
        if (!rec.manifestData?.id) continue;
        records.set(id, rec);
        try {
          activate(rec);
          setupDevWatch(rec.id, rec.source);
        } catch (err) {
          log.error(`Failed to restore plugin "${id}"`, err);
        }
      }
    },

    /** @param {Blob} file @param {string} [filename] */
    async installFromFile(file, filename) {
      const pkg = await parsePluginBlob(file, filename);
      return commitPackage(pkg, { kind: 'file', name: filename ?? /** @type {any} */ (file).name ?? 'plugin' });
    },

    /** @param {string} path @param {{ devMode?: boolean }} [options] */
    async installFromVfs(path, { devMode = false } = {}) {
      const pkg = await parsePluginFromVfs(vfs, path);
      return commitPackage(pkg, { kind: 'vfs', path, devMode });
    },

    reload,

    /** @param {string} id @param {boolean} devMode */
    async setDevMode(id, devMode) {
      const rec = records.get(id);
      if (!rec || rec.source.kind !== 'vfs') return;
      rec.source = { ...rec.source, devMode };
      await kv.set(id, rec);
      setupDevWatch(id, rec.source);
      bus.emit('plugins:changed', { action: 'updated', id });
    },

    /** @param {string} id @param {{ wipeData?: boolean }} [options] */
    async uninstall(id, { wipeData = false } = {}) {
      if (!records.has(id)) return;
      for (const inst of lifecycle.list()) {
        if (inst.appId === id) await lifecycle.close(inst.id, { force: true });
      }
      watchers.get(id)?.();
      watchers.delete(id);
      teardownRegistration(id);
      records.delete(id);
      await kv.delete(id);
      await permissions.clearApp(id);
      if (wipeData) {
        await scopedKv(id).clear();
        await settings.resetScope(id);
      }
      bus.emit('plugins:changed', { action: 'uninstalled', id });
    },

    has: (/** @type {string} */ id) => records.has(id),
    list: () => [...records.values()].map(describe),
    get: (/** @type {string} */ id) => {
      const r = records.get(id);
      return r ? describe(r) : null;
    },

    dispose() {
      for (const fn of watchers.values()) fn();
      watchers.clear();
      for (const fn of cleanups.values()) fn();
      cleanups.clear();
    },
  };
}

/** @typedef {ReturnType<typeof createPluginManager>} PluginManager */
