# Security Review & Threat Model

Nexus Arcade OS runs entirely client-side with untrusted user files, custom CSS, Markdown, code snippets, and third-party plugins. This document records the security controls verified for v1.0.0.

---

## 1. Content Security Policy (CSP)

Production builds inject a `<meta http-equiv="Content-Security-Policy">` tag in [`scripts/vite-shared.js`](../scripts/vite-shared.js):

```text
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' blob:;
frame-src 'self' blob: data:;
font-src 'self' data:;
connect-src 'self' https: http: blob: data:;
worker-src 'self' blob: data:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'none';
```

- `object-src 'none'`, `base-uri 'self'`, and `form-action 'none'` prevent plugin objects, base-tag hijacking, and accidental form submissions.
- Built-in CodeMirror 6 editors isolate dynamically generated CSS inside **Shadow DOM** constructed stylesheets rather than injecting host `<style>` tags.
- `connect-src` permits user-initiated connections only in **HTTP Client** and user-configured **AI Workspace** servers; Nexus itself makes zero background or telemetry requests.

---

## 2. Plugin & Code Preview Sandboxing

### Community Plugins ([`src/services/plugins/sandbox.js`](../src/services/plugins/sandbox.js))

- **Iframe Sandbox:** Every plugin UI, widget, and headless command runs in `<iframe sandbox="allow-scripts">` (opaque `null` origin; `allow-same-origin`, `allow-top-navigation`, `allow-popups`, and `allow-forms` are omitted).
- **Inner Sandbox CSP:** Each plugin `srcdoc` sets:
  ```text
  default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;
  ```
  Blocking `connect-src` inside the iframe guarantees plugins cannot exfiltrate data over `fetch` or WebSockets.
- **RPC Verification:** Host listeners ignore `message` events unless `event.source === iframe.contentWindow` and `event.data.channelId` matches the instance's CSPRNG UUID.
- **Privilege Boundaries:**
  - `system` permission is permanently rejected at manifest normalization and RPC dispatch (`PluginPermissionError`).
  - Built-in apps cannot be shadowed or overwritten by a plugin (`commitPackage` throws if `registry.has(id)`).
  - `kv` storage is namespaced to `plugin:<pluginId>`.
  - `vfs.writeFile` forces `{ system: false }` so plugins cannot mark system-protected files.
  - `scheduler.cancel` enforces `job.app === pluginId`.
  - `commands.execute` blocks `dev.*` commands.
  - `.nexus-plugin` zip extraction (`parseZipPlugin` in [`src/services/plugins/package.js`](../src/services/plugins/package.js)) rejects path traversal (`..`), absolute paths (`/`), and null bytes (`\0`).

### Code Playground & Nexus Code Previews

- User HTML/CSS/JS previews in `nexus.playground` and `nexus.code` also run inside `<iframe sandbox="allow-scripts">` without `allow-same-origin`, preventing preview code from touching the OS IndexedDB or parent DOM.

---

## 3. HTML, Markdown & Custom CSS Sanitization

- **Markdown ([`src/ui/markdown.js`](../src/ui/markdown.js)):** Parsed with `marked` and sanitized through **DOMPurify** before DOM insertion:
  - External links (`http:` / `https:`) automatically receive `target="_blank"` and `rel="noopener noreferrer"`.
  - **Privacy image blocker:** `<img src>` values not starting with `data:` or `blob:` are stripped to `data-blocked-src` so opening Markdown notes never triggers external tracking pixels.
  - Interactive `<input type="checkbox">` is restricted strictly to task items carrying `data-task-index`; all other `<input>` elements are removed.
  - Math expressions (`$…$`, `$$…$$`) render via KaTeX with `output: 'mathml'`, avoiding external font fetches and stripping inline styles.
- **Custom CSS Escape Hatch:** Advanced user CSS in Settings → Theme Editor includes a warning, strips `</style` tag breakouts, and is bypassed completely when **Safe Mode** (`Shift` at boot or `?safemode=1`) is active.
- **ESLint Hardening (`eslint.config.js`):** `no-eval`, `no-implied-eval`, `no-new-func`, and app import boundary rules run on every lint check and CI build.

---

## 4. Cryptography & Secret Management

- **Profile Locks, Encrypted Notes/Journals, Password Vault & Backups ([`src/services/crypto.js`](../src/services/crypto.js)):**
  - Key derivation: **PBKDF2-HMAC-SHA256** with **600,000 iterations** (OWASP recommendation) and 16-byte random salt (`crypto.getRandomValues`).
  - Encryption: **AES-256-GCM** with fresh 12-byte random IV per encryption payload.
  - Secret verification uses constant-time comparison (`verifySecret`).
  - Lost passwords cannot be recovered (explicitly disclosed in UI and docs).
- **AI Provider API Keys ([`src/services/ai/security.js`](../src/services/ai/security.js)):**
  - API keys are encrypted at rest with a per-device 256-bit `AES-GCM` Web Crypto key (`enc:<iv>:<data>`).
  - API keys are never written to system logs, error reports, or standard backups (`ai:providers` stripped unless user explicitly opts in).
- **Clipboard Vault Protection:** **Password Vault** marks copied secrets `{ sensitive: true }`, triggering 30-second clipboard auto-clear and exclusion from Clipboard Manager history.
