# Testing Guide

Nexus Arcade OS combines fast Node/jsdom unit tests, cross-version data migration tests, static checks (ESLint, Prettier, TypeScript `checkJs`, i18n parity), and multi-project Playwright end-to-end tests including automated WCAG AA accessibility scans.

---

## 1. Quick Commands

```sh
npm run format      # Prettier write
npm run typecheck   # tsc -p jsconfig.json (strict JSDoc type checking)
npm run lint        # ESLint + Prettier check + i18n EN/DE key check
npm test            # Vitest unit & contract test suite
npm run build       # Builds dist/ (Website PWA) and dist/nexus-lite.html (must stay <= 8.00 MB)
npm run test:e2e    # Playwright E2E suite (runs against built dist/)
```

Run `npm run build` before `npm run test:e2e` because Playwright tests execute against `vite preview` and the generated `dist/nexus-lite.html`.

---

## 2. Unit & Contract Tests (`tests/unit/`)

- **Runner:** Vitest (`tests/unit/setup.js`) configured to run in **Node** by default (so real `Blob` and `structuredClone` work identically with `fake-indexeddb`).
- **DOM Tests:** Files that need browser DOM APIs opt in at line 1 with:
  ```js
  // @vitest-environment jsdom
  ```
- **Key Suites:**
  - `tests/unit/system.test.js` — End-to-end kernel integration in jsdom (boot, launch, storage, VFS, search, crash/restart, i18n switching, backup/restore, newer-schema read-only guard).
  - `tests/unit/storage-engines.test.js` & `storage-migrations.test.js` — Shared contract tests across IndexedDB, `localStorage`, and in-memory engines plus atomic version migrations and quarantine behavior.
  - `tests/unit/migrations-v1.test.js` — Real historical snapshot fixtures (`tests/fixtures/snapshot-v01.json`, `snapshot-v06.json`) migrating to v1.0.0 without data loss.
  - `tests/unit/plugins.test.js` — Zip/JSON/single-JS packaging, path traversal rejection, `system` permission denial, KV isolation, and `postMessage` RPC boundaries.
  - `tests/unit/backup-conflicts.test.js` & `sync-folder.test.js` — Merge conflict inspection wizard and File System Access directory mirroring.
  - `tests/unit/theme.test.js` & `theme-editor.test.js` — WCAG contrast guarantees for all built-in themes and `.nexus-theme` import/export validation.

---

## 3. End-to-End Tests (`tests/e2e/`)

Configured in [`playwright.config.js`](../playwright.config.js) with three projects:

1. **`web`**: Desktop Chromium (`1280×800`) against `vite preview`.
2. **`web-mobile`**: Mobile Chrome (`Pixel 7`) testing sheet windows, gestures, and responsive app bar.
3. **`lite`**: Loads `dist/nexus-lite.html` directly over `file://` (`tests/e2e/lite.spec.js`).

### Important Helpers (`tests/helpers/nexus.js`)

- `startNexus(page, opts)` clears storage for a clean profile, handles the boot screen, and returns a clean desktop ready for assertions.
- `collectErrors(page)` captures `console.error` and uncaught `pageerror` exceptions so every E2E test fails on runtime errors.

### Accessibility Suite (`tests/e2e/a11y.spec.js`)

Uses `@axe-core/playwright` (`AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa'])`) across the Desktop Shell, Settings (General, Theme Editor, Backup), Profile & Achievements, App Center, File Explorer, Nexus Notes, Arcade Hub, and Help, failing on any `serious` or `critical` violation.

---

## 4. i18n & Boundary Checks

- `node scripts/check-i18n.js` checks every EN and DE JSON file across root shell strings and all app namespaces to ensure **0 missing or mismatched keys**.
- `eslint.config.js` enforces the app/game import boundaries and bans `eval`, `new Function`, and unused variables.

---

## 5. Continuous Integration (`.github/workflows/ci.yml`)

Every push to `main` and every pull request runs:
`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` → `npm run test:e2e`.
Render (`render.yaml`) triggers deployment only when CI passes (`autoDeployTrigger: checksPass`).
