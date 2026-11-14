// @ts-check
// Sandboxed plugin runtime & permission-checked RPC bridge.
// Every plugin runs inside an `<iframe sandbox="allow-scripts">` (opaque `null` origin, no
// allow-same-origin) and communicates solely over `postMessage` verified by `event.source`
// and per-instance `channelId`.
import { h, icon, replace } from '../../ui/dom.js';

export class PluginPermissionError extends Error {
  /** @param {string} pluginId @param {import('../../kernel/types').Permission} permission */
  constructor(pluginId, permission) {
    super(`Plugin "${pluginId}" does not have "${permission}" permission.`);
    this.name = 'PluginPermissionError';
  }
}

/**
 * Escapes `</script` and `</style` so embedded plugin code/CSS cannot break out of inline tags.
 * @param {string} code
 */
function escapeScriptTag(code) {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

/** @param {string} css */
function escapeStyleTag(css) {
  return css.replace(/<\/(style)/gi, '<\\/$1');
}

/**
 * Rewrites simple top-level ES exports so a plugin module can run inside an inline `<script type="module">`
 * without needing `blob:` script-src or `eval`/`new Function`, while preserving standard ES module syntax.
 * @param {string} code
 */
export function preparePluginModuleCode(code) {
  let out = code
    .replace(/\bexport\s+default\s+/g, 'const __defaultExport = ')
    .replace(/\bexport\s+(async\s+function|function|class|const|let|var)\s+/g, '$1 ');

  // Handle `export { a, b as c };` if present.
  /** @type {string[]} */
  const namedExports = [];
  out = out.replace(/\bexport\s*\{([^}]+)\}\s*;?/g, (_m, list) => {
    for (const part of list.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [local, alias] = trimmed.split(/\s+as\s+/).map((/** @type {string} */ s) => s.trim());
      if (local) namedExports.push(`${JSON.stringify(alias || local)}: ${local}`);
    }
    return '';
  });

  const footer = `
;(() => {
  const __d = typeof __defaultExport !== 'undefined' ? __defaultExport : undefined;
  const __named = { ${namedExports.join(', ')} };
  const __mod = {
    mount: typeof mount !== 'undefined' ? mount : (__named.mount ?? __d?.mount),
    commands: typeof commands !== 'undefined' ? commands : (__named.commands ?? __d?.commands),
    terminal: typeof terminal !== 'undefined' ? terminal : (__named.terminal ?? __d?.terminal),
    default: __d,
  };
  window.__nexusRegisterPlugin?.(__mod);
})();`;

  return escapeScriptTag(`${out}\n${footer}`);
}

/**
 * Builds the permission-checked RPC dispatcher on the host side.
 * Pure & decoupled from `<iframe>` so unit tests can exercise all security boundaries directly.
 *
 * @param {object} deps
 * @param {string} deps.pluginId
 * @param {import('../permissions/permissions.js').Permissions} deps.permissions
 * @param {{ get(k: string, f?: unknown): Promise<unknown>, set(k: string, v: unknown): Promise<unknown>, delete(k: string): Promise<unknown>, keys(): Promise<string[]>, entries(): Promise<Record<string, unknown>>, clear(): Promise<unknown> }} deps.kv
 * @param {import('../vfs/vfs.js').Vfs} deps.vfs
 * @param {import('../notifications/notifications.js').Notifications} deps.notifications
 * @param {import('../clipboard/clipboard.js').ClipboardService} deps.clipboard
 * @param {import('../../kernel/intents.js').Intents} deps.intents
 * @param {import('../scheduler/scheduler.js').Scheduler} deps.scheduler
 * @param {import('../ai/ai.js').AiService} deps.ai
 * @param {import('../commands/commands.js').Commands} deps.commands
 * @param {{ alert(m: string): Promise<void>, confirm(m: string): Promise<boolean>, prompt(m: string, v?: string): Promise<string | null> }} deps.dialogs
 * @param {import('../theme/engine.js').ThemeService} deps.theme
 * @param {any} [deps.windowHandle]
 * @param {{ get(k: string): unknown, set(k: string, v: unknown): void, size(): [number, number] }} [deps.widgetHandle]
 * @param {(text: string) => void} [deps.onTermOut]
 * @param {(text: string) => void} [deps.onTermErr]
 */
export function createPluginRpcHandler(deps) {
  const { pluginId, permissions, kv, vfs, notifications, clipboard, intents, scheduler, ai, commands, dialogs, theme } =
    deps;

  /** @param {import('../../kernel/types').Permission} perm */
  async function requirePerm(perm) {
    if (perm === 'system') throw new PluginPermissionError(pluginId, perm);
    const ok = await permissions.request(pluginId, perm);
    if (!ok) throw new PluginPermissionError(pluginId, perm);
  }

  /** @param {string} p */
  function safePath(p) {
    if (typeof p !== 'string' || !p.trim()) throw new Error('Invalid VFS path');
    return p;
  }

  /** @type {Record<string, (...args: any[]) => Promise<unknown> | unknown>} */
  const methods = {
    // Scoped KV storage: always permitted and strictly isolated to plugin:<pluginId>.
    'kv.get': (key, fallback) => kv.get(String(key), fallback),
    'kv.set': (key, value) => kv.set(String(key), value),
    'kv.delete': (key) => kv.delete(String(key)),
    'kv.keys': () => kv.keys(),
    'kv.entries': () => kv.entries(),
    'kv.clear': () => kv.clear(),

    // VFS (permission: 'vfs', never system-privileged)
    'vfs.home': async () => {
      await requirePerm('vfs');
      return vfs.home;
    },
    'vfs.stat': async (path) => {
      await requirePerm('vfs');
      return vfs.stat(safePath(path));
    },
    'vfs.exists': async (path) => {
      await requirePerm('vfs');
      return vfs.exists(safePath(path));
    },
    'vfs.list': async (path) => {
      await requirePerm('vfs');
      return vfs.list(safePath(path), { hidden: false });
    },
    'vfs.readText': async (path) => {
      await requirePerm('vfs');
      return vfs.readText(safePath(path));
    },
    'vfs.writeFile': async (path, data, options) => {
      await requirePerm('vfs');
      const opts = options && typeof options === 'object' ? { ...options, system: false } : { system: false };
      return vfs.writeFile(safePath(path), data, opts);
    },
    'vfs.mkdir': async (path, options) => {
      await requirePerm('vfs');
      return vfs.mkdir(safePath(path), options);
    },
    'vfs.trash': async (path) => {
      await requirePerm('vfs');
      return vfs.trash(safePath(path));
    },
    'vfs.walk': async (path) => {
      await requirePerm('vfs');
      return vfs.walk(safePath(path));
    },

    // Notifications (permission: 'notifications')
    'notify.show': async (init) => {
      await requirePerm('notifications');
      const title = String(init?.title ?? '').slice(0, 140);
      const body = init?.body ? String(init.body).slice(0, 500) : undefined;
      await notifications.notify({
        title,
        body,
        timeoutMs: typeof init?.timeoutMs === 'number' ? init.timeoutMs : 4000,
        app: pluginId,
      });
      return true;
    },

    // Clipboard (permission: 'clipboard')
    'clipboard.readText': async () => {
      await requirePerm('clipboard');
      return clipboard.readText();
    },
    'clipboard.writeText': async (text) => {
      await requirePerm('clipboard');
      return clipboard.writeText(String(text ?? ''), { app: pluginId });
    },

    // Intents (permission: 'intents')
    'intents.open': async (target, options) => {
      await requirePerm('intents');
      return intents.open(target, options);
    },
    'intents.share': async (data, type, options) => {
      await requirePerm('intents');
      return intents.share(data, String(type), options);
    },

    // Scheduler (permission: 'scheduler', scoped to pluginId)
    'scheduler.schedule': async (job) => {
      await requirePerm('scheduler');
      return scheduler.schedule(pluginId, job);
    },
    'scheduler.cancel': async (id) => {
      await requirePerm('scheduler');
      const job = await scheduler.get(String(id));
      if (job && job.app !== pluginId) throw new Error('Plugins can only cancel their own jobs');
      return scheduler.cancel(String(id));
    },
    'scheduler.list': async () => {
      await requirePerm('scheduler');
      return scheduler.list(pluginId);
    },

    // AI (permission: 'ai')
    'ai.hasProvider': async () => {
      await requirePerm('ai');
      return ai.isAvailable();
    },
    'ai.chat': async (messages, options) => {
      await requirePerm('ai');
      return ai.chat(messages, options);
    },

    // Safe dialogs & non-privileged commands
    'dialog.alert': (msg) => dialogs.alert(String(msg ?? '')),
    'dialog.confirm': (msg) => dialogs.confirm(String(msg ?? '')),
    'dialog.prompt': (msg, val) => dialogs.prompt(String(msg ?? ''), val === undefined ? '' : String(val)),
    'commands.execute': async (id, args) => {
      const cmdId = String(id ?? '');
      // Block privileged shell/debug internal commands from untrusted plugins unless explicit
      if (cmdId.startsWith('dev.')) throw new Error(`Plugin cannot run "${cmdId}"`);
      return commands.execute(cmdId, args);
    },

    // Theme & Window / Widget controls
    'theme.token': (name) => theme.token(String(name ?? '')),
    'window.setTitle': (title) => deps.windowHandle?.setTitle?.(String(title ?? '')),
    'window.setBadge': (count) => deps.windowHandle?.setBadge?.(count === null ? null : Number(count)),
    'window.setProgress': (val) => deps.windowHandle?.setProgress?.(val === null ? null : Number(val)),
    'window.close': () => deps.windowHandle?.close?.(),
    'window.focus': () => deps.windowHandle?.focus?.(),

    'widget.configGet': (key) => deps.widgetHandle?.get(String(key)),
    'widget.configSet': (key, val) => deps.widgetHandle?.set(String(key), val),
    'widget.size': () => deps.widgetHandle?.size() ?? [2, 2],

    'term.out': (text) => deps.onTermOut?.(String(text ?? '')),
    'term.err': (text) => deps.onTermErr?.(String(text ?? '')),
  };

  /**
   * @param {string} method
   * @param {any[]} args
   */
  return async function handleRpc(method, args = []) {
    const fn = methods[method];
    if (!fn) throw new Error(`Unknown plugin RPC method: "${method}"`);
    return fn(...args);
  };
}

/**
 * Snapshot of current CSS design tokens on `:root` to inject into sandboxed plugin iframes.
 * @param {Document} [doc]
 */
export function collectThemeCssVars(doc = globalThis.document) {
  /** @type {Record<string, string>} */
  const vars = {};
  if (!doc?.documentElement) return vars;
  const keys = [
    '--bg',
    '--surface-1',
    '--surface-2',
    '--surface-3',
    '--glass',
    '--border',
    '--text-1',
    '--text-2',
    '--text-3',
    '--accent',
    '--accent-2',
    '--accent-contrast',
    '--success',
    '--warning',
    '--danger',
    '--info',
    '--font-sans',
    '--font-mono',
    '--font-scale',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
  ];
  const style = doc.documentElement.style;
  const comp = doc.defaultView?.getComputedStyle?.(doc.documentElement);
  for (const k of keys) {
    const val = style.getPropertyValue(k) || comp?.getPropertyValue(k) || '';
    if (val.trim()) vars[k] = val.trim();
  }
  return vars;
}

/**
 * Generates the isolated `srcdoc` HTML document executed inside `<iframe sandbox="allow-scripts">`.
 * @param {object} options
 * @param {string} options.channelId
 * @param {'app' | 'widget' | 'headless'} options.mode
 * @param {string} options.pluginId
 * @param {string} options.version
 * @param {string} options.instanceId
 * @param {string} options.locale
 * @param {string} options.themeName
 * @param {'dark' | 'light'} options.scheme
 * @param {Record<string, string>} options.themeVars
 * @param {Record<string, unknown>} options.messages
 * @param {string} options.code
 * @param {string} [options.css]
 * @param {unknown} [options.launchArgs]
 * @param {unknown} [options.headlessCall]
 */
export function buildPluginSrcdoc(options) {
  const varsCss = Object.entries(options.themeVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');

  const initPayload = JSON.stringify({
    channelId: options.channelId,
    mode: options.mode,
    pluginId: options.pluginId,
    version: options.version,
    instanceId: options.instanceId,
    locale: options.locale,
    themeName: options.themeName,
    scheme: options.scheme,
    themeVars: options.themeVars,
    messages: options.messages ?? {},
    launchArgs: options.launchArgs ?? {},
    headlessCall: options.headlessCall ?? null,
  }).replace(/</g, '\\u003c');

  const preparedCode = preparePluginModuleCode(options.code);
  const safeCss = escapeStyleTag(options.css ?? '');

  return `<!DOCTYPE html>
<html lang="${options.locale === 'de' ? 'de' : 'en'}" data-scheme="${options.scheme}">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;" />
<style>
:root {
  color-scheme: ${options.scheme};
  ${varsCss}
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  color: var(--text-1, #eef2ff);
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  overflow: auto;
}
#app {
  min-height: 100%;
  padding: ${options.mode === 'widget' ? '8px' : '14px'};
}
button, input, select, textarea {
  font: inherit;
  color: inherit;
}
button {
  cursor: pointer;
  border: 1px solid var(--border, rgb(255 255 255 / 0.2));
  background: var(--surface-2, #121628);
  border-radius: 8px;
  padding: 6px 12px;
}
button:hover { border-color: var(--accent, #3ef0ff); }
button.primary {
  background: var(--accent, #3ef0ff);
  color: var(--accent-contrast, #05060d);
  border-color: transparent;
  font-weight: 600;
}
${safeCss}
</style>
</head>
<body>
<div id="app"></div>
<script>
(() => {
  const INIT = ${initPayload};
  const CHANNEL = INIT.channelId;
  const pending = new Map();
  let seq = 0;
  let themeState = { current: INIT.themeName, scheme: INIT.scheme, vars: INIT.themeVars || {} };
  const themeListeners = new Set();
  const resizeListeners = new Set();

  function post(msg) {
    window.parent.postMessage({ __nexusPlugin: true, channelId: CHANNEL, ...msg }, '*');
  }

  function rpc(method, ...args) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      post({ type: 'rpc', id, method, args });
    });
  }

  window.addEventListener('message', (event) => {
    const d = event.data;
    if (!d || !d.__nexusPlugin || d.channelId !== CHANNEL) return;
    if (d.type === 'res') {
      const p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error));
      else p.resolve(d.result);
    } else if (d.type === 'event') {
      if (d.name === 'theme:changed') {
        themeState = { current: d.payload.current, scheme: d.payload.scheme, vars: d.payload.vars || {} };
        const root = document.documentElement;
        root.dataset.scheme = themeState.scheme;
        root.style.colorScheme = themeState.scheme;
        for (const [k, v] of Object.entries(themeState.vars)) root.style.setProperty(k, v);
        for (const fn of themeListeners) try { fn(); } catch {}
      } else if (d.name === 'widget:resize') {
        for (const fn of resizeListeners) try { fn(d.payload.size); } catch {}
      }
    }
  });

  window.addEventListener('error', (e) => {
    post({ type: 'crash', error: String(e.message || e.error || 'Uncaught error') });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    post({ type: 'crash', error: String(reason?.message || reason || 'Unhandled promise rejection') });
  });

  function lookupMsg(key, vars) {
    const dict = INIT.messages || {};
    const parts = String(key).split('.');
    let cur = dict;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
      else { cur = undefined; break; }
    }
    let str = typeof cur === 'string' ? cur : String(key);
    if (vars && typeof vars === 'object') {
      str = str.replace(/\\{(\\w+)\\}/g, (_, k) => (k in vars ? String(vars[k]) : '{' + k + '}'));
    }
    return str;
  }

  const ctx = {
    app: { id: INIT.pluginId, version: INIT.version, instanceId: INIT.instanceId },
    env: { edition: 'web', dev: false, online: navigator.onLine },
    storage: {
      kv: {
        get: (k, f) => rpc('kv.get', k, f),
        set: (k, v) => rpc('kv.set', k, v),
        delete: (k) => rpc('kv.delete', k),
        keys: () => rpc('kv.keys'),
        entries: () => rpc('kv.entries'),
        clear: () => rpc('kv.clear'),
      },
    },
    fs: {
      home: () => rpc('vfs.home'),
      stat: (p) => rpc('vfs.stat', p),
      exists: (p) => rpc('vfs.exists', p),
      list: (p) => rpc('vfs.list', p),
      readText: (p) => rpc('vfs.readText', p),
      writeFile: (p, data, opts) => rpc('vfs.writeFile', p, data, opts),
      mkdir: (p, opts) => rpc('vfs.mkdir', p, opts),
      trash: (p) => rpc('vfs.trash', p),
      walk: (p) => rpc('vfs.walk', p),
    },
    notify: (init) => rpc('notify.show', init),
    clipboard: {
      readText: () => rpc('clipboard.readText'),
      writeText: (t) => rpc('clipboard.writeText', t),
    },
    intents: {
      open: (target, opts) => rpc('intents.open', target, opts),
      share: (data, type, opts) => rpc('intents.share', data, type, opts),
    },
    scheduler: {
      schedule: (job) => rpc('scheduler.schedule', job),
      cancel: (id) => rpc('scheduler.cancel', id),
      list: () => rpc('scheduler.list'),
    },
    ai: {
      hasProvider: () => rpc('ai.hasProvider'),
      chat: (messages, opts) => rpc('ai.chat', messages, opts),
    },
    dialog: {
      alert: (m) => rpc('dialog.alert', m),
      confirm: (m) => rpc('dialog.confirm', m),
      prompt: (m, v) => rpc('dialog.prompt', m, v),
    },
    commands: {
      execute: (id, args) => rpc('commands.execute', id, args),
    },
    window: {
      setTitle: (t) => rpc('window.setTitle', t),
      setBadge: (n) => rpc('window.setBadge', n),
      setProgress: (v) => rpc('window.setProgress', v),
      close: () => rpc('window.close'),
      focus: () => rpc('window.focus'),
    },
    widget: INIT.mode === 'widget' ? {
      id: INIT.instanceId,
      size: () => rpc('widget.size'),
      onResize: (fn) => { resizeListeners.add(fn); return () => resizeListeners.delete(fn); },
      config: {
        get: (k) => rpc('widget.configGet', k),
        set: (k, v) => rpc('widget.configSet', k, v),
      },
    } : undefined,
    theme: {
      get current() { return themeState.current; },
      get scheme() { return themeState.scheme; },
      token: (n) => themeState.vars['--' + n] || '',
      onChange: (fn) => { themeListeners.add(fn); return () => themeListeners.delete(fn); },
    },
    i18n: {
      locale: INIT.locale,
      t: lookupMsg,
    },
  };

  window.nexus = { ctx };
  window.__nexusRegisterPlugin = async (mod) => {
    try {
      if (INIT.mode === 'headless') {
        const call = INIT.headlessCall;
        let result = 0;
        if (call?.kind === 'terminal') {
          const handler = mod?.terminal?.[call.name];
          if (!handler) throw new Error('Terminal command not found: ' + call.name);
          const io = {
            args: call.args || [],
            stdin: call.stdin ?? null,
            cwd: call.cwd || '/',
            env: call.env || {},
            out: (t) => void rpc('term.out', t),
            err: (t) => void rpc('term.err', t),
          };
          const code = await handler(ctx, io);
          result = typeof code === 'number' ? code : 0;
        } else if (call?.kind === 'command') {
          const handler = mod?.commands?.[call.id];
          if (!handler) throw new Error('Command handler not found: ' + call.id);
          result = await handler(ctx, call.args);
        }
        post({ type: 'headless-done', result });
        return;
      }
      const root = document.getElementById('app');
      if (typeof mod?.mount === 'function') {
        await mod.mount(root, ctx, INIT.launchArgs || {});
      }
      post({ type: 'ready' });
    } catch (err) {
      post({ type: 'crash', error: String(err?.stack || err?.message || err) });
    }
  };
})();
</script>
<script type="module">
${preparedCode}
</script>
</body>
</html>`;
}

/**
 * Mounts an isolated plugin `<iframe sandbox="allow-scripts">` in `container`.
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {'app' | 'widget'} options.mode
 * @param {string} options.pluginId
 * @param {string} options.title
 * @param {string} options.version
 * @param {string} options.instanceId
 * @param {string} options.code
 * @param {string} [options.css]
 * @param {unknown} [options.launchArgs]
 * @param {import('../../kernel/types').AppContext} options.hostCtx
 * @param {ReturnType<typeof createPluginRpcHandler>} options.rpcHandler
 * @param {() => void} [options.onReload]
 */
export function mountSandboxedPluginFrame(options) {
  const { container, mode, pluginId, title, version, instanceId, code, css, launchArgs, hostCtx, rpcHandler } = options;
  const channelId =
    globalThis.crypto?.randomUUID?.() ?? `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const iframe = /** @type {HTMLIFrameElement} */ (
    h('iframe', {
      class: 'nx-plugin-frame',
      sandbox: 'allow-scripts',
      title,
      style: {
        width: '100%',
        height: '100%',
        border: '0',
        display: 'block',
        background: 'transparent',
      },
    })
  );

  let disposed = false;

  /** @param {string} message */
  function showCrash(message) {
    hostCtx.log.error(`Plugin "${pluginId}" crashed in sandbox`, message);
    replace(
      container,
      h(
        'div',
        { class: 'nx-plugin-crash', role: 'alert', style: { padding: '16px', display: 'grid', gap: '10px' } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' } },
          icon('warning', { size: 18 }),
          `${title} crashed`,
        ),
        h('pre', {
          text: message,
          style: {
            margin: '0',
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--surface-2)',
            overflow: 'auto',
            fontSize: '12px',
          },
        }),
        options.onReload
          ? h('button', { type: 'button', class: 'nx-btn', text: 'Reload', onclick: () => options.onReload?.() })
          : null,
      ),
    );
  }

  const locale = hostCtx.i18n.locale;
  const themeVars = collectThemeCssVars(container.ownerDocument);
  const srcdoc = buildPluginSrcdoc({
    channelId,
    mode,
    pluginId,
    version,
    instanceId,
    locale,
    themeName: hostCtx.theme.current,
    scheme: /** @type {'dark' | 'light'} */ (/** @type {any} */ (hostCtx.theme).scheme ?? 'dark'),
    themeVars,
    messages: {},
    code,
    css,
    launchArgs,
  });

  const onMessage = async (/** @type {MessageEvent} */ e) => {
    if (disposed) return;
    if (e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (!d || !d.__nexusPlugin || d.channelId !== channelId) return;

    if (d.type === 'crash') {
      showCrash(String(d.error || 'Plugin error'));
      return;
    }

    if (d.type === 'rpc') {
      try {
        const result = await rpcHandler(d.method, d.args ?? []);
        iframe.contentWindow?.postMessage({ __nexusPlugin: true, channelId, type: 'res', id: d.id, result }, '*');
      } catch (err) {
        iframe.contentWindow?.postMessage(
          {
            __nexusPlugin: true,
            channelId,
            type: 'res',
            id: d.id,
            error: String(/** @type {Error} */ (err)?.message ?? err),
          },
          '*',
        );
      }
    }
  };

  window.addEventListener('message', onMessage);
  const offTheme = hostCtx.theme.onChange(() => {
    if (disposed) return;
    iframe.contentWindow?.postMessage(
      {
        __nexusPlugin: true,
        channelId,
        type: 'event',
        name: 'theme:changed',
        payload: {
          current: hostCtx.theme.current,
          scheme: /** @type {any} */ (hostCtx.theme).scheme ?? 'dark',
          vars: collectThemeCssVars(container.ownerDocument),
        },
      },
      '*',
    );
  });

  iframe.srcdoc = srcdoc;
  replace(container, iframe);

  return {
    pushWidgetResize(/** @type {[number, number]} */ size) {
      iframe.contentWindow?.postMessage(
        { __nexusPlugin: true, channelId, type: 'event', name: 'widget:resize', payload: { size } },
        '*',
      );
    },
    unmount() {
      disposed = true;
      offTheme();
      window.removeEventListener('message', onMessage);
      iframe.remove();
    },
  };
}

/**
 * Runs a plugin command or terminal command inside a temporary hidden sandboxed iframe.
 * @param {object} options
 * @param {string} options.pluginId
 * @param {string} options.version
 * @param {string} options.code
 * @param {string} options.locale
 * @param {string} options.themeName
 * @param {'dark' | 'light'} options.scheme
 * @param {ReturnType<typeof createPluginRpcHandler>} options.rpcHandler
 * @param {{ kind: 'terminal', name: string, args: string[], stdin: string | null, cwd: string, env: Record<string, string> } | { kind: 'command', id: string, args: unknown }} options.call
 * @param {AbortSignal} [options.signal]
 */
export function runSandboxedHeadless(options) {
  const doc = globalThis.document;
  if (!doc?.body) return Promise.reject(new Error('DOM unavailable for sandboxed plugin execution'));

  const channelId =
    globalThis.crypto?.randomUUID?.() ?? `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const iframe = doc.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.display = 'none';

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('Plugin headless execution timed out')), 15_000);

    const onAbort = () => finish(new Error('Aborted'));
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const onMessage = async (/** @type {MessageEvent} */ e) => {
      if (e.source !== iframe.contentWindow) return;
      const d = e.data;
      if (!d || !d.__nexusPlugin || d.channelId !== channelId) return;
      if (d.type === 'headless-done') return finish(null, d.result);
      if (d.type === 'crash') return finish(new Error(String(d.error || 'Plugin crashed')));
      if (d.type === 'rpc') {
        try {
          const result = await options.rpcHandler(d.method, d.args ?? []);
          iframe.contentWindow?.postMessage({ __nexusPlugin: true, channelId, type: 'res', id: d.id, result }, '*');
        } catch (err) {
          iframe.contentWindow?.postMessage(
            {
              __nexusPlugin: true,
              channelId,
              type: 'res',
              id: d.id,
              error: String(/** @type {Error} */ (err)?.message ?? err),
            },
            '*',
          );
        }
      }
    };

    /** @param {Error | null} err @param {unknown} [res] */
    function finish(err, res) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      window.removeEventListener('message', onMessage);
      iframe.remove();
      if (err) reject(err);
      else resolve(res);
    }

    window.addEventListener('message', onMessage);
    iframe.srcdoc = buildPluginSrcdoc({
      channelId,
      mode: 'headless',
      pluginId: options.pluginId,
      version: options.version,
      instanceId: `${options.pluginId}#headless`,
      locale: options.locale,
      themeName: options.themeName,
      scheme: options.scheme,
      themeVars: collectThemeCssVars(doc),
      messages: {},
      code: options.code,
      headlessCall: options.call,
    });
    doc.body.append(iframe);
  });
}
