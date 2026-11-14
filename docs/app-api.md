# App API Reference

This guide covers building built-in apps in Nexus Arcade OS (`src/apps/<name>/` and `src/games/<name>/`). If you are building an external installable plugin, see [the Plugin SDK Guide](plugin-sdk.md).

Full TypeScript JSDoc definitions live in [`src/kernel/types.d.ts`](../src/kernel/types.d.ts).

---

## 1. Folder Structure & Import Boundary

Every app lives in `src/apps/<id>/`:

```text
src/apps/myapp/
├── manifest.js       # Data-only manifest (eagerly loaded at boot)
├── index.js          # Exports mount(container, ctx, args), optional commands & terminal
├── styles.css        # Scoped app styles
├── help.md           # Shown in Help app and on F1
├── changelog.md      # Optional Markdown shown in App Center
├── screenshots.js    # Optional lazy screenshot URLs
└── i18n/
    ├── en.json
    └── de.json
```

`eslint.config.js` strictly enforces that apps only import:

- files inside their own folder,
- `src/ui/` (shared UI primitives & utilities),
- `src/styles/` (design tokens & base CSS),
- and for games, `src/games/engine/`.

All OS services are accessed strictly through `ctx`.

---

## 2. The Manifest (`manifest.js`)

Manifests are loaded eagerly at boot to populate the launcher, search index, settings, and intent routing without pulling app bundles into initial JS. **Keep `manifest.js` data-only** with lazy `import()` callbacks:

```js
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.myapp',
  name: { en: 'My App', de: 'Meine App' },
  description: { en: 'Does something useful.', de: 'Macht etwas Nützliches.' },
  version: '1.0.0',
  icon: 'notes',
  category: 'productivity', // productivity | study | office | dev | cslab | games | media | ai | system
  window: { width: 820, height: 560, minWidth: 420, minHeight: 320, singleInstance: false },
  permissions: ['vfs', 'notifications'],
  handles: [{ action: 'open', types: ['.txt', 'text/plain'] }],
  commands: [{ id: 'myapp.new', title: { en: 'New item', de: 'Neuer Eintrag' }, shortcut: 'Mod+Alt+N' }],
  settings: [{ key: 'compact', type: 'boolean', default: false, label: { en: 'Compact view', de: 'Kompakt' } }],
  achievements: [
    {
      id: 'first_item',
      title: { en: 'First Step', de: 'Erster Schritt' },
      description: { en: 'Create 1 item.', de: 'Erstelle 1 Eintrag.' },
    },
  ],
  terminal: [{ name: 'myapp', description: { en: 'CLI helper', de: 'CLI-Hilfe' }, usage: 'myapp list' }],
  storage: {
    version: 1,
    collections: {
      items: { indexes: { updatedAt: 'updatedAt', tags: { keyPath: 'tags', multiEntry: true } } },
    },
    migrations: () => import('./migrations.js'),
  },
  messages: {
    en: () => import('./i18n/en.json'),
    de: () => import('./i18n/de.json'),
  },
  help: () => import('./help.md?raw'),
  load: () => import('./index.js'),
};
```

---

## 3. App Module & Lifecycle (`index.js`)

Export a named `mount(container, ctx, args)` function returning an `AppInstance`:

```js
export async function mount(container, ctx, args) {
  const { t } = ctx.i18n;
  const items = ctx.storage.collection('items');

  // Bind DOM events with ctx.signal so listeners auto-clean on unmount
  window.addEventListener('keydown', onKey, { signal: ctx.signal });

  // Use ctx.timers so loops pause automatically when minimized/suspended
  ctx.timers.setInterval(() => {
    /* ... */
  }, 1000);

  if (args.intent?.path) {
    // Handle file opened via File Explorer or "Open with…"
  }

  return {
    canClose: () => !hasUnsavedChanges, // Veto normal close (skipped on End Task)
    onSuspend() {
      /* Window minimized or tab hidden */
    },
    onResume() {
      /* Window visible again */
    },
    onIntent(intent) {
      /* For singleInstance: true apps receiving a second file/share */
    },
    saveState: () => ({ openId }), // Restored as args.restoredState on reload
    unmount() {
      container.replaceChildren();
    },
  };
}
```

### Headless Handlers

- **`export const commands = { 'myapp.new': async (ctx, args) => { ... } }`**: Triggered from Command Palette (`Ctrl+K`) or global shortcuts without opening a window (`ctx` is `HeadlessContext`).
- **`export const terminal = { myapp: async (ctx, io) => { io.out('OK\n'); return 0; } }`**: Registered as real shell commands in Nexus Terminal with pipe (`stdin`), `cwd`, `env`, and `AbortSignal` (`Ctrl+C`) support.

---

## 4. `ctx` Capabilities Summary

- **`ctx.storage`**: `ctx.storage.kv` (key-value store) and `ctx.storage.collection(name)` (`get`, `all`, `query`, `count`, `put`, `create`, `update`, `delete`, `clear`, `onChange`).
- **`ctx.fs`**: Full profile VFS (`readText`, `readFile`, `writeFile`, `mkdir`, `list`, `stat`, `trash`, `rename`, `move`, `copy`, `watch`, `importFiles`, `download`, `downloadBlob`, `zipFolder`, `recent`).
- **`ctx.settings`**: `get(key)`, `set(key, val)`, `reset(key?)`, `onChange(key, fn)`, `system(key)`.
- **`ctx.window`**: `setTitle`, `setBadge`, `setProgress`, `minimize`, `maximize`, `restore`, `close`, `focus`, `resize`, `setFullscreen`, `onResize`, `stateChanged()`.
- **`ctx.dialog`**: `alert`, `confirm`, `prompt`, `openFile`, `saveFile`, `openFolder`, `pickColor`.
- **`ctx.intents`**: `open`, `share`, `openersFor`, `getDefault`, `setDefault`, `clearDefault`.
- **`ctx.events`**: `on`, `once`, `off`, `emit` (wildcards supported; OS reserved prefixes listed in [docs/events.md](events.md) throw if emitted by apps).
- **`ctx.achievements`**: `unlock`, `progress`, `stat`, `award`.
- **`ctx.scheduler`**: Persistent reminders and recurring jobs surviving reloads (`schedule`, `cancel`, `list`).
- **`ctx.crypto`**: OWASP 600k PBKDF2-SHA256 + AES-256-GCM encryption/hashing helpers.
- **`ctx.ai`**: Provider-agnostic streaming chat, embeddings, and capability checks (`isAvailable()`).
- **`ctx.clipboard`, `ctx.sound`, `ctx.notify`, `ctx.i18n`, `ctx.theme`, `ctx.log`, `ctx.signal`, `ctx.timers`, `ctx.guard`**.

### Privileged System Apps (`ctx.system`)

Only built-in apps declaring `'system'` in `manifest.permissions` (`settings`, `appcenter`, `files`, `terminal`, `monitor`, `help`, `profile`) receive `ctx.system` ([`src/kernel/system-api.js`](../src/kernel/system-api.js)). Plugins can never obtain `'system'`.
