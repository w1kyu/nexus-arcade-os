# Plugin SDK Guide

Nexus Arcade OS allows third-party extensions without compromising user data or host security. Plugins use the same manifest schema as built-in apps, run inside an isolated browser sandbox, and request permissions explicitly on first use.

---

## 1. Security Model & Isolation

- **Opaque Origin Sandbox:** Every plugin window, desktop widget, and headless command executes inside `<iframe sandbox="allow-scripts">` (`src/services/plugins/sandbox.js`) **without** `allow-same-origin`.
- **Restricted Iframe CSP:** Each sandbox frame enforces:
  ```text
  default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;
  ```
  Plugins cannot access host DOM nodes, cookies, `localStorage`, IndexedDB, or `window.nexus` host internals, and cannot make arbitrary external network requests.
- **Verified `postMessage` RPC:** Communication crosses `window.parent.postMessage` verified on the host by both `event.source === iframe.contentWindow` and a per-instance random `channelId`.
- **Permission Enforcement:** Host RPC calls check `permissions.request(pluginId, perm)` before executing. Plugins can **never** request or receive the privileged `system` permission. Permissions can be inspected or revoked anytime in **Settings → Apps**.
- **Strict Data Isolation:** Each plugin's key-value store (`ctx.storage.kv`) is strictly scoped to `plugin:<pluginId>`.

---

## 2. Packaging Formats

Nexus accepts three plugin formats via **App Center → Install Plugin** or via VFS install:

### A. Single-File Plugin (`.js`)

Include an `@nexus-plugin` JSDoc JSON metadata block at the top of the `.js` file and export `mount` (plus optional `commands` / `terminal` handlers):

```js
/*
@nexus-plugin {
  "id": "plugin.hello-world",
  "name": { "en": "Hello World", "de": "Hallo Welt" },
  "version": "1.0.0",
  "description": { "en": "Minimal single-file plugin", "de": "Minimales Plugin" },
  "category": "productivity",
  "icon": "puzzle",
  "permissions": ["notifications"]
}
*/

export async function mount(root, ctx) {
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = ctx.i18n.locale === 'de' ? 'Hallo sagen' : 'Say Hello';
  btn.addEventListener('click', async () => {
    await ctx.notify({ title: 'Hello Plugin', body: 'Running inside sandbox!' });
  });
  root.appendChild(btn);
}
```

### B. `.nexus-plugin` Archive (ZIP) or VFS Folder

Structure your folder (or zip it into `my-plugin.nexus-plugin`):

```text
my-plugin/
├── manifest.json       # AppManifest JSON (data-only; no JS functions)
├── main.js             # Exports mount(root, ctx, args), optional commands/terminal
├── styles.css          # Optional CSS injected into the sandbox iframe
├── help.md             # Optional Markdown shown in Help
├── changelog.md        # Optional release history shown in App Center
├── themes.json         # Optional OS themes provided by the plugin
├── widget-<id>.js      # Optional separate entry point per widget id
└── i18n/
    ├── en.json
    └── de.json
```

### C. `.nexus-plugin` JSON Bundle

A single JSON document containing `{ manifest, code, css, widgetCodes, themes, help, changelog, messages }`.

---

## 3. Tutorial: Build & Test a Plugin in Dev Mode

1. Open **Nexus Edit** or **File Explorer** and create `/home/<user>/Projects/my-plugin/`.
2. Add `manifest.json` and `main.js`.
3. Open **App Center** and choose **Install from VFS…** (or install a `.nexus-plugin` / `.js` file via **Install Plugin File**).
4. Enable **Dev Mode** for VFS-installed plugins: Nexus watches the VFS folder recursively and automatically reloads your plugin whenever files change, showing a reload toast.
5. Note that holding `Shift` during boot (or adding `?safemode=1`) activates **Safe Mode**, which skips loading installed plugins.

---

## 4. Sandboxed `ctx` API Reference

Inside `mount(root, ctx, args)`, headless `commands[id](ctx, args)`, and `terminal[name](ctx, io)`:

| Namespace        | Permission Required              | Methods                                                                                                                                              |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.app`        | Always allowed                   | `{ id, version, instanceId }`                                                                                                                        |
| `ctx.env`        | Always allowed                   | `{ edition, dev, online }`                                                                                                                           |
| `ctx.storage.kv` | Always allowed (isolated)        | `get(k, fallback)`, `set(k, v)`, `delete(k)`, `keys()`, `entries()`, `clear()`                                                                       |
| `ctx.fs`         | `'vfs'`                          | `home()`, `stat(p)`, `exists(p)`, `list(p)`, `readText(p)`, `writeFile(p, data, opts)`, `mkdir(p, opts)`, `trash(p)`, `walk(p)`                      |
| `ctx.notify`     | `'notifications'`                | `ctx.notify({ title, body, timeoutMs })`                                                                                                             |
| `ctx.clipboard`  | `'clipboard'`                    | `readText()`, `writeText(text)`                                                                                                                      |
| `ctx.intents`    | `'intents'`                      | `open(target, opts)`, `share(data, type, opts)`                                                                                                      |
| `ctx.scheduler`  | `'scheduler'` (scoped)           | `schedule(job)`, `cancel(id)` (own jobs only), `list()`                                                                                              |
| `ctx.ai`         | `'ai'`                           | `hasProvider()`, `chat(messages, opts)`                                                                                                              |
| `ctx.dialog`     | Always allowed                   | `alert(msg)`, `confirm(msg)`, `prompt(msg, defaultVal)`                                                                                              |
| `ctx.commands`   | Always allowed (`dev.*` blocked) | `execute(id, args)`                                                                                                                                  |
| `ctx.window`     | Always allowed (window mode)     | `setTitle(t)`, `setBadge(n)`, `setProgress(v)`, `close()`, `focus()`                                                                                 |
| `ctx.widget`     | Always allowed (widget mode)     | `id`, `size()`, `onResize(fn)`, `config.get(k)`, `config.set(k, v)`                                                                                  |
| `ctx.theme`      | Always allowed                   | `current`, `scheme`, `token(name)`, `onChange(fn)` — OS CSS variables (`--bg`, `--surface-*`, `--text-*`, `--accent`, etc.) are synced automatically |
| `ctx.i18n`       | Always allowed                   | `locale` (`'en' \| 'de'`), `t(key, vars)`                                                                                                            |

### Terminal Commands (`terminal[name](ctx, io)`)

Plugins declaring `"terminal": [{ "name": "wordcloud", "description": ..., "usage": ... }]` receive a sandboxed `io` object with `{ args, stdin, cwd, env, out(text), err(text) }` and return an integer exit code (`0` = success).

### Themes (`manifest.themes` or `themes.json`)

Each theme entry provides `id` (`/^[a-z0-9-]+$/`), `name` (`{ en, de }`), `scheme` (`"dark" | "light"`), `glow` (`0–1`), and 14 `#rrggbb` color tokens (`bg`, `surface1`, `surface2`, `surface3`, `border`, `text1`, `text2`, `text3`, `accent`, `accent2`, `success`, `warning`, `danger`, `info`).

---

## 5. Included Example Plugins

Two complete, ready-to-install example plugins ship in `examples/plugins/`:

1. **[`examples/plugins/pomodoro-stats/`](../examples/plugins/pomodoro-stats/manifest.json)** — Folder / `.nexus-plugin` example (`plugin.pomodoro-stats`):
   - Demonstrates app + desktop widget sharing (`ctx.widget`), isolated `ctx.storage.kv` persistence, `notifications` permission prompts with graceful fallback if denied, `ctx.dialog.confirm`, bilingual EN/DE strings, and a custom `"Amber Focus"` theme registered into Settings.
2. **[`examples/plugins/markdown-wordcloud.js`](../examples/plugins/markdown-wordcloud.js)** — Single-file `.js` plugin (`plugin.markdown-wordcloud`):
   - Demonstrates `@nexus-plugin` inline manifest metadata, VFS folder walking (`ctx.fs.home()`, `ctx.fs.stat()`, `ctx.fs.walk()`, `ctx.fs.readText()`), a live interactive word-cloud renderer using host CSS design tokens, and a headless `wordcloud [path]` terminal command supporting piped `stdin`.
