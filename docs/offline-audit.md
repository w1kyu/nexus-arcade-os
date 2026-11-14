# Offline & Nexus Lite Audit

Nexus Arcade OS v1.0.0 is designed offline-first with zero required backend services.

---

## 1. Website Edition (PWA) Precache & Routing

- **Strategy:** Workbox `injectManifest` (`vite.config.js` → `src/sw.js`).
- **Precached Assets:** `**/*.{js,css,html,svg,png,ico,woff2,webmanifest}` (excluding `nexus-lite.html`), covering the app shell, all 91 lazy-loaded app chunks, workers, WebAssembly/SQLite support bundles, self-hosted `Inter Variable` and `JetBrains Mono Variable` fonts, and PWA icons.
- **Navigation Fallback:** `NavigationRoute(createHandlerBoundToURL('index.html'))` with denylist for `/nexus-lite.html$` and icons/manifest files.
- **Update Flow:** `registerType: 'prompt'`; a waiting Service Worker activates only on explicit `SKIP_WAITING` when the user confirms the update toast.
- **Cache Safety:** Clearing caches in **Settings → Storage** clears runtime caches while preserving the Workbox precache so offline availability is never broken.

---

## 2. App Offline Audit Matrix

All 91 built-in applications under `src/apps/` were audited for offline operation with network disabled:

| Category                    | Apps                                                                                                                                                                                                                                                                                                                                             | Offline Status                   | Notes                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **System & Shell**          | `appcenter`, `editor`, `files`, `help`, `monitor`, `profile`, `settings`, `terminal`, `welcome`                                                                                                                                                                                                                                                  | **100% Offline**                 | All data backed by per-profile IndexedDB (`nexus-profile-<id>`) and VFS blobs. Settings Sync Folder mirrors locally on Chromium via File System Access API without network.                        |
| **Productivity**            | `bookmarks`, `calculator`, `calendar`, `clipboard`, `clock`, `converter`, `focus`, `habits`, `journal`, `notes`, `tasks`, `vault`                                                                                                                                                                                                                | **100% Offline**                 | KaTeX MathML, procedural Web Audio ambient mixer, ICS/MD/CSV export, PBKDF2 + AES-GCM encryption, and German state holiday calculations run locally.                                               |
| **Study & CS Lab**          | `archlab`, `circuits`, `cslab`, `datastructures`, `exams`, `flashcards`, `grades`, `graphlab`, `pathfinding`, `sorting`, `timetable`, `turing`                                                                                                                                                                                                   | **100% Offline**                 | `sql.js` WASM (bundled/precached), Anki `.apkg` importer, algorithm visualizers, and CPU simulator execute strictly in-browser.                                                                    |
| **Office & Creative**       | `mindmap`, `paint`, `pdf`, `pixelart`, `present`, `sheets`, `whiteboard`, `write`                                                                                                                                                                                                                                                                | **100% Offline**                 | Custom PDF 1.4 writer, GIF89a encoder, formula engine, canvas editors, and self-contained HTML exports require zero external CDNs.                                                                 |
| **Developer Toolkit**       | `code`, `colorlab`, `devtools`, `diff`, `playground`, `snippets`                                                                                                                                                                                                                                                                                 | **100% Offline**                 | CodeMirror 6, Node-Lite Worker runner, sandboxed HTML/JS previews, k-means worker color extractor, and regex worker run offline.                                                                   |
| **Developer HTTP Client**   | `httpclient`                                                                                                                                                                                                                                                                                                                                     | **Network-Optional**             | UI, request builder, collection storage, environment variables, and code generators work offline; outbound requests display clear offline/CORS diagnostics when disconnected.                      |
| **Media Center**            | `beatlab`, `camera`, `music`, `photos`, `recorder`, `screenrecorder`, `synth`, `video`                                                                                                                                                                                                                                                           | **100% Offline**                 | ID3/Vorbis/MP4/EXIF/VTT/SRT parsers, Web Audio synthesizer, `OfflineAudioContext` WAV renderer, and local device APIs require zero network access.                                                 |
| **Arcade (31 Games + Hub)** | `arcade`, `2048`, `automata`, `battleships`, `blockfall`, `breakout`, `bubbles`, `checkers`, `chess`, `connectfour`, `drifter`, `glide`, `griddefense`, `invaders`, `life`, `mahjong`, `match3`, `memory`, `minesweeper`, `nonogram`, `pong`, `quiz`, `racer`, `reaction`, `runner`, `snake`, `sokoban`, `solitaire`, `sudoku`, `typing`, `uttt` | **100% Offline**                 | Web Worker chess AI, MCTS, Sokoban puzzles, dictionaries, synth SFX, and local 2P multiplayer operate offline.                                                                                     |
| **AI Workspace**            | `chat`, `assistant`                                                                                                                                                                                                                                                                                                                              | **Network-Optional / Localhost** | Graceful empty/offline state when disconnected (`ctx.ai.isAvailable()` returns `false`). Local Ollama / Lemonade / llama.cpp servers run over localhost offline; remote APIs require connectivity. |

---

## 3. Nexus Lite (`dist/nexus-lite.html`) Audit

- **Included Apps:** All **91** built-in apps, Web Workers (rewritten at build time via `?worker&inline` into Blob URLs in `vite.lite.config.js`), design tokens, self-hosted fonts, and SVG favicon are inlined into a single HTML file.
- **Excluded Features (Honest Differences):** Service Worker registration and online PWA update notifications are omitted (`window.NEXUS_EDITION === 'lite'`), since Lite is a standalone local file. Storage lives under the `file://` origin, separate from the hosted website; backup/restore moves data cleanly between them.
- **Bundle Budget:** Configured hard limit is **8.00 MB** (`8,388,608` bytes). Current verified v1.0.0 size: **~6.99 MB** (below budget by ~1.01 MB).
- **`file://` Behavior:** IndexedDB and inline Blob Web Workers operate with zero external HTTP/HTTPS requests (`tests/e2e/lite.spec.js` asserts `requests === [liteUrl]` and zero console errors).

---

## 4. Automated Verification

- [`tests/e2e/smoke.spec.js`](../tests/e2e/smoke.spec.js): Loads `/`, awaits `navigator.serviceWorker.ready`, switches browser context to `offline: true`, reloads, and asserts `<html data-kernel="ready">`, `<html data-storage="indexeddb">`, `<html data-search="worker">`, and loaded `Inter Variable` fonts with zero errors.
- [`tests/e2e/lite.spec.js`](../tests/e2e/lite.spec.js): Loads `dist/nexus-lite.html` directly via `file://`, asserts zero external requests and `NEXUS_EDITION === 'lite'`.
