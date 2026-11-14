# Changelog

All notable changes to Nexus Arcade OS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) (`0.N.0` = phase N).

## [Unreleased]

## [1.0.1] — 2026-11-14 — Performance, Cross-Browser & Test Stability

### Performance

- **Mobile Boot Optimization (`src/kernel/system.js`, `src/shell/`):** Gated eager `AudioContext` instantiation behind real first-gesture listeners (`pointerdown` / `keydown`), lazy-loaded secondary boot/assistant/plugin/search helpers (`whats-new.js`, `ai`, `search/sources.js`, `commands`, `plugins/package.js`, `wallpaper.js`), and tightened boot splash timing (`900 ms` first visit / `450 ms` repeat).
- Shrinks the initial JS entry bundle from `180.65 kB` to **`161.88 kB` gzipped** (under 200 KB budget) and lifts live Mobile Lighthouse Performance from `69` (`TBT 1,670 ms`) to **`99`** (`FCP 0.8 s`, `LCP 2.0 s`, **`TBT 0 ms`**, Desktop **`100`**).

### Fixed

- **WebKit IndexedDB & Shortcut Compatibility (`src/services/vfs/vfs.js`, `src/services/storage/serialize.js`):** Stored binary VFS files as `Uint8Array` (keeping backwards-compatible reads for existing `Blob` records) to eliminate WebKit `UnknownError` during IndexedDB writes, added alignment-safe binary chunk round-tripping in `.nexus-backup`, handled macOS/WebKit `Option+P` via `e.code === 'KeyP'` in Files, kept Settings sidebar buttons stable across refreshes, and ignored synthetic `pointermove` events on Command Palette re-renders.
- **Accessibility (`src/shell/topbar.js`):** Updated `.nx-tb-clock` `aria-label` to include the visible clock text prefix (`"${label}, Calendar"`), clearing the `label-content-name-mismatch` audit (`100` Accessibility).
- **Notes & E2E Stability (`src/apps/notes/index.js`, `tests/e2e/`):** Serialized note renames to avoid race conditions, made keyboard modifier helpers platform-aware (`Meta` on Apple platforms, `Control` elsewhere), closed arcade game windows cleanly between sub-checks for WebKit software-rendering stability, ignored top-level `file://` navigation differences in Firefox `lite.spec.js`, and extended `smoke.spec.js` timeouts to `240 s` when `NEXUS_BASE_URL` runs against cold CDN precaching.

### Changed

- **Cross-Browser CI (`.github/workflows/ci.yml`, `playwright.config.js`):** Added dedicated `cross-browser` GitHub Actions matrix jobs running the full Playwright Web + Nexus Lite (`file://`) suites on **Firefox** and **WebKit** alongside **Chromium**.

## [1.0.0] — 2026-11-13 — Ecosystem, Polish & Final Release

### Added

- **Sandboxed Plugin SDK (`src/services/plugins/`):**
  - Install plugins from `.nexus-plugin` (zip or JSON bundle), VFS folders, or single `.js` files with `@nexus-plugin` headers.
  - Real browser isolation: plugins run inside `<iframe sandbox="allow-scripts">` (opaque `null` origin, no `allow-same-origin`) with strict inner CSP and per-instance `channelId` + `event.source`-verified `postMessage` RPC bridge.
  - Permission-checked access to VFS, notifications, clipboard, intents, scheduler, and AI; `system` permission permanently blocked; permission prompt & revocation in **Settings → Apps**.
  - Support for desktop plugin widgets, plugin-contributed OS themes, plugin terminal commands, crash isolation, and **Dev Mode** auto-reload when watching a VFS folder.
  - Added two complete examples in `examples/plugins/` (`pomodoro-stats/` and `markdown-wordcloud.js`) and `docs/plugin-sdk.md`.
- **Theme Editor & Personalization (`src/apps/settings/pages/theme-editor.js`):**
  - Live design token editor with real-time OS preview, WCAG AA/AAA contrast warnings, palette extraction from current wallpaper (`src/ui/color-extract.js`), Color Lab theme integration, and `.nexus-theme` JSON import/export.
  - Window corner radius slider, font family selector, icon accent style (`outline` / `filled`), and **Titlebar Style** switch (macOS left traffic lights vs. Windows right buttons).
  - Advanced Custom CSS with live toggle and Boot Safe Mode escape hatch, plus exportable/importable **Profile Cards**.
- **Zero-Backend Sync & Data Portability (`src/services/backup/`):**
  - Restore wizard with side-by-side merge conflict detection (`inspectMerge`) and backup reminder polish.
  - **Sync Folder** via File System Access API (`src/services/backup/sync-folder.js`) for Chromium browsers with two-way conflict detection and honest fallback notice on Firefox/Safari.
  - Device-to-device transfer combining exported archive files with an offline SVG QR pairing summary (`src/ui/qr.js`).
- **Onboarding, Discoverability & Gamification:**
  - Interactive, skippable 5-step First-Run Tour (`src/shell/tour/tour.js`), max-daily feature discovery tips (`src/services/tips/tips.js`), Demo Profile creator (`src/services/profiles/demo.js`), Boot Safe Mode (`Shift` / `?safemode=1`), and "What's New" modal (`src/shell/whats-new.js`) powered by `CHANGELOG.md`.
  - Central **Profile & Achievements** app (`nexus.profile`) displaying XP, level progress, app activity breakdown, OS-wide achievements (`src/kernel/os-achievements.js`), yearly **Nexus Wrapped** summary, and subtle desktop easter eggs (`src/shell/easter-eggs.js`).
- **Accessibility, Security, Offline Audits & v1.0 Documentation:**
  - Automated WCAG 2.0/2.1 AA Playwright audit (`tests/e2e/a11y.spec.js` via `@axe-core/playwright`) plus keyboard focusability & ARIA labeling improvements across Profile, App Center, File Explorer, Markdown checkboxes/code blocks, and CodeMirror scrollers.
  - Historical version data migration tests (`tests/unit/migrations-v1.test.js` with `v0.1` and `v0.6` snapshots).
  - Complete documentation suite (`docs/plugin-sdk.md`, `docs/app-api.md`, `docs/design-system.md`, `docs/testing.md`, `docs/offline-audit.md`, `docs/security.md`, `docs/release.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, GitHub issue templates, and updated `README.md`).

### Fixed

- Exposed `kv` on the profile `System` handle in `src/kernel/system.js` and fixed `.then().catch()` error handling in `src/shell/boot.js` plus `sys.systemApi('nexus.shell')` invocation in `src/shell/whats-new.js`.
- Prevented Settings intent handling (`src/apps/settings/index.js`) from mutating `info.args` on reload.

## [0.12.0] — 2026-11-13 — AI Workspace

### Added

- **AI Provider Layer (`src/services/ai/`):**
  - Universal provider abstraction (`listModels()`, `chat(messages, options)` with streaming tokens, `cancel()`, `embed(texts)`).
  - Native adapters for **Ollama** (`/api/tags`, `/api/chat`, `/api/embed`), **Lemonade** (OpenAI-compatible server), **OpenAI-compatible endpoints** (LM Studio, llama.cpp server, vLLM, LocalAI, OpenRouter, etc.), and **Anthropic Messages API** with browser header handling.
  - Profile manager with multiple saved profiles and diagnostic connection testing (offline, DNS/connection refused, CORS blocked, 401 unauthorized, model not found).
  - Security: device-key AES-GCM encryption at rest for API keys; never exposed in backups or logs unless opted in.
  - Live token and timing statistics per message (tokens in/out, tok/s, latency, duration).
  - RAG knowledge indexing engine: chunking with overlap, vector storage in IndexedDB, cosine similarity retrieval, note citations with intent links.
  - OS tool calling: structured actions (create note, append note, search notes, create task, list today's tasks, create calendar event, start focus session, open app, set theme/wallpaper, create flashcards) with interactive user approval confirmation cards.
- **Nexus Chat (`nexus.chat`):**
  - Multi-conversation management with search, pin/unpin, folders, rename, delete, and archive.
  - Markdown message rendering with syntax-highlighted code blocks, KaTeX math rendering, tables, and copy actions.
  - Streaming responses with stop button, regeneration, and message branching/editing with variant navigation.
  - Model & parameter switcher per conversation (temperature, top-p, context length, system prompt).
  - Personas / assistants library (CS Tutor, Translator, Code Reviewer, Exam Coach) with custom prompt injection.
  - Prompt templates library with dynamic variable replacement (`{{topic}}`, `{{language}}`, etc.) and variable form prompt modal.
  - Context attachments: VFS files, code snippets, drag-and-drop, and images for vision-capable models.
  - Side-by-side Code Assistant panel with "Apply to Code" actions from assistant code blocks and diff viewer integration.
  - Compare mode to query multiple models side-by-side.
  - Speech synthesis read-aloud support.
  - Export conversation as Markdown, JSON, or HTML, and import from JSON.
- **Nexus Assistant (`nexus.assistant`):**
  - Quick AI assistant app with action presets: "Ask AI", "Explain", "Summarize", "Translate", "Refactor", "Fix grammar".
  - Quick action toolbar with copy, replace, and append integration across the OS.
- **Cross-App AI Integrations:**
  - **Terminal:** `ai "question"` command and `ai explain <command>` with `--help` and streaming CLI output.
  - **Notes:** AI toolbar assistant dropdown for summarize, continue writing, fix grammar, translate, outline, and explain selection.
  - **Playground:** AI assistance button to explain code, fix runtime errors, and optimize snippets.
- **AI Settings & Help Documentation:**
  - Settings page (`src/apps/settings/pages/ai.js`) for managing active providers, adding/editing profiles, testing connections, and viewing token usage stats.
  - Setup guides in Help Center (`src/apps/help/docs/{en,de}/ai-setup.md`) covering Ollama setup, CORS origins (`OLLAMA_ORIGINS`), Lemonade, and local OpenAI endpoints.
- **Testing & Quality Assurance:**
  - Unit tests for adapters, orchestrator, and prompt template parser in `tests/unit/ai-*.test.js` (1,065 unit tests passing).
  - End-to-end Playwright test suite `tests/e2e/ai.spec.js` asserting empty state, provider configuration, connection diagnostics, streaming chat with KaTeX math and code blocks, Code panel toggle, Assistant quick actions, and Terminal `ai` command.

## [0.11.0] — 2026-11-12 — Media Center Suite

### Added

- **Nexus Music (`nexus.music`):** full-featured offline music library and player with VFS scanning and local file import; custom zero-dependency ID3v2, Vorbis comment, and MP4 tag parsers; library views by songs, albums, artists, and playlists; playback queue, seek, shuffle, repeat, volume, playback speed, and gapless playback; custom synchronized `.lrc` lyrics viewer; 10-band equalizer (BiquadFilterNodes) with genre presets; audio visualizer with 5 canvas visualization modes (bars, circular spectrum, waveform, bass particles, starfield); MediaSession API integration with OS lock screen controls and hardware media keys; desktop mini player widget and Quick Settings notification center media card; podcast/audiobook mode with skip ±15/30s and position remembrance.
- **Video Player (`nexus.video`):** offline video player for web-supported video formats (`.mp4`, `.webm`, `.ogv`); responsive controls with custom seekbar, frame-by-frame stepping, playback speed (0.25x–3x), fullscreen, and native Picture-in-Picture; custom zero-dependency WebVTT and SubRip (`.srt`) subtitle parser with customizable subtitle size, color, and vertical offset; CSS-based live video filters (brightness, contrast, saturation); snapshot frame capture to `/Pictures`; position memory per video.
- **Image Viewer & Editor (`nexus.photos`):** photo gallery with virtualized responsive grid, date/size sorting, albums, and favorites; viewer with smooth wheel/pinch zoom, pan, fit/fill, fullscreen, and timed slideshow transitions; custom zero-dependency JPEG EXIF parser extracting camera metadata, lens, exposure, ISO, date, and GPS coordinates; non-destructive canvas photo editor supporting rotate, flip, free and fixed-ratio cropping, adjustments (brightness, contrast, saturation, warmth, vignette), preset filters, and privacy EXIF scrubbing; side-by-side comparison mode; intent integration to set photo as desktop wallpaper or user avatar.
- **Voice Recorder (`nexus.recorder`):** audio recorder using MediaRecorder with live waveform oscilloscope, volume level meter, pause/resume, and direct save to `/Music/Recordings`; interactive playback with playback speed adjustments (0.5x–2x); waveform trimming of start/end boundaries; lecture bookmarks with timestamped markers and notes; noise gate processing.
- **Camera / Photo Booth (`nexus.camera`):** webcam photo booth with countdown timer (3s, 5s, 10s) and multi-shot burst mode; WebGL live shader filters (grayscale, sepia, neon edges, pixelate, mirror, thermal); video clip recording; BarcodeDetector integration for live QR code scanning; direct image and clip export to `/Pictures` and `/Videos`.
- **Screen Recorder (`nexus.screenrecorder`):** screen and window capture utilizing `getDisplayMedia` + `MediaRecorder` with optional microphone voiceover; floating toolbar overlay with recording duration indicator; automated export to `/Videos` in WebM format.
- **Beat Lab Drum Machine (`nexus.beatlab`):** 16-step matrix drum sequencer with 8 tracks; fully algorithmic Web Audio synthesized drums (kick, snare, closed hi-hat, open hi-hat, clap, tom, rimshot, cowbell) with configurable pitch, decay, and tone; lookahead Web Audio scheduler with swing and tempo controls; mute/solo per track; multi-pattern chaining (Patterns A, B, C, D); built-in presets (Synthwave Arcade, 808 Trap, 909 Techno, Lo-Fi Chill); offline rendering to 16-bit PCM `.wav` files via `OfflineAudioContext`; project save and load to `/Music`.
- **Synthesizer (`nexus.synth`):** polyphonic synthesizer featuring dual oscillators (sawtooth, square, sine, triangle, noise), octave, semitone, and fine detune; multi-mode BiquadFilter (lowpass, highpass, bandpass, notch) with dedicated filter envelope; ADSR amplitude envelope; LFO with rate, depth, and destination routings (filter cutoff, pitch); built-in effects rack (delay with feedback and wet mix, algorithmic impulse response reverb, waveshaper distortion); 3-octave interactive on-screen keyboard, computer keyboard keybinding mapping, and Web MIDI API integration; built-in presets (Cyberpunk Lead, Retro Bass, Ambient Pad, 8-bit Arp); real-time oscilloscope and frequency spectrum canvas visualizer; programmable arpeggiator (up, down, up-down, random).
- **Media Center Playwright Suite:** added `tests/e2e/media.spec.js` asserting launch, UI verification, controls, and interaction across all 8 Phase 11 applications.

## [0.7.0] — 2026-11-10 — Developer Toolkit

### Added

- **Code Playground:** HTML/CSS/JavaScript multi-language sandbox with live preview iframe (`sandbox="allow-scripts"`), captured interactive console (log, warn, error, table, object inspection, expression execution), resizable side-by-side/stacked/editor-only layouts, single-file HTML import/export, URL-hash sharing, starter templates (Blank, Canvas game loop, CSS 3D animation, Fetch demo, Web Component, mini-p5 drawing helper), terminal command `playground [template]`.
- **Nexus Code:** full-featured multi-file IDE with recursive VFS file tree explorer, tabbed workspace, CodeMirror 6 with Shadow DOM isolation, syntax token themes, multi-cursor, find/replace across project files (case, whole word, regex), `Mod+P` Quick Open file switcher, `Mod+G` Go to Line, sandboxed live web project preview (`index.html` with asset blob URL resolution), Node-Lite Worker runner (`runner.worker.js`) executing JS files with console output, local history snapshots with visual diff comparison, terminal command `code [path]`.
- **Developer Tools Toolbox:** unified suite of utilities:
  - _JSON Toolkit:_ format with customizable indentation, minify, syntax validation with line/column pointers, key sorting, escape/unescape, tree viewer with path copying, JSON ↔ CSV converter, JSON ↔ YAML converter, JSON → TypeScript / JSDoc type generation, JSONPath queries, JSON Schema validator.
  - _Crypto & Encodings:_ Base64 (text, file, URL-safe), Base32, Hex, Binary, URL encode/decode, HTML entities, Unicode escapes, Punycode, hash suite (MD5 custom implementation, CRC32, SHA-1, SHA-256, SHA-384, SHA-512 via SubtleCrypto), hash verification against expected hash, HMAC with secret key, educational AES-GCM password-based encryption/decryption, RSA/ECDSA key pair generation with PEM/JWK export.
  - _Regex Tester:_ live pattern matching with regex flags, match highlighting, numbered/named groups table, replace preview with back-references (`$1`, `$<name>`), cheat sheet and common pattern library (email, URL, IPv4/6, dates, German postal codes, IBAN), worker-isolated evaluation with execution timeout against catastrophic backtracking, token-by-token regex explanation in English/German, test assertions mode.
  - _Small Utilities:_ JWT decoder (header/payload viewer, expiry badge, HS256 signature verification), UUID (v4/v7), ULID, and NanoID batch generators, Unix timestamp converter (seconds/ms ↔ ISO 8601 ↔ local/relative), number base converter (base 2–36, two's complement, endianness), Cron expression tool (plain English/German schedule translation, next 10 trigger times), text case/slug/dedupe/line sorting transforms, lorem ipsum generator, Markdown table editor/generator (table → MD/HTML/CSV), CSS generators (box-shadow, border-radius, gradients, clip-path, cubic-bezier easing preview, flexbox/grid visual playground), SVG viewer with basic optimizer and PNG conversion, QR code generator, fake data generator with schema export (names, emails, dates, addresses).
- **Diff Viewer:** side-by-side and unified inline diff visualization powered by LCS algorithm, line-by-line and character-level differences, whitespace and case sensitivity toggles, jump between change hunks, compare pasted text or VFS files, unified `.patch` file export, terminal command `diff <file1> <file2>`.
- **Color Laboratory:** color space conversions (HEX, RGB, HSL, HSV, CMYK, OKLCH, CSS Named colors), interactive color picker with sliders and EyeDropper API, color harmony palette generator (complementary, analogous, triadic, tetradic, monochromatic, tint/shade stairs, lock & randomize), WCAG 2.x AA/AAA and APCA contrast ratio checker, color blindness simulations (protanopia, deuteranopia, tritanopia, achromatopsia), CSS gradient generator (linear, radial, conic), image color extraction via k-means clustering in worker, one-click export to OS accent theme and CSS/SCSS variables, terminal command `color [value]`.
- **HTTP Client:** API request builder supporting GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS, query parameter and header key-value editors, JSON/form/raw request bodies, Bearer token and Basic auth helpers, response inspector with status, latency, payload size, headers, formatted JSON tree, HTML preview, image viewer, environment variables with `{{baseUrl}}` interpolation, curl and fetch code snippet generators, offline and CORS diagnostic explanations, request collection import/export, terminal command `curl`.
- **Snippet Manager:** code snippet library with syntax highlighting, search across titles/tags/content, language tagging, one-click clipboard copy, drag-and-drop JSON collection import/export, integration with Code Playground and Nexus Code via system intents, terminal command `snippet <query>`.
- **Developer Tools End-to-End Suite:** added Playwright test suite `tests/e2e/devtools.spec.js` asserting launch and UI verification across all 7 Phase 7 apps.

## [0.6.0] — 2026-11-10 — Office & Creative suite

### Added

- **Nexus Sheets:** full-featured spreadsheet with virtual scrolling grid (smoothly handles 10,000 × 100 cells), column/row headers and resizing, freeze rows/columns, and multi-sheet tabs; cell and range selection with keyboard extension, copy/paste (including external TSV clipboard support), and drag fill handle for numbers and formula series; custom zero-dependency formula engine with A1 / $A$1 references, range operators, circular reference detection, incremental recalculation, and error values (`#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`); 40+ built-in formula functions (SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTIF, SUMIF, AVERAGEIF, IF, IFS, AND, OR, NOT, ROUND, ABS, SQRT, POWER, MOD, CONCAT, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, TODAY, NOW, DATE, YEAR, MONTH, DAY, VLOOKUP, XLOOKUP, INDEX, MATCH, STDEV, MEDIAN, RAND, RANDBETWEEN); number, currency, percent, date, and decimal formatting; bold, italic, text/fill colors, text alignment, and cell borders; sort and filter ranges; find & replace; interactive canvas charts (line, bar, pie, scatter) embedded on the sheet; `.nsheet` JSON storage in the VFS with CSV and TSV import and export; 100-step undo/redo stack.
- **Nexus Write:** rich text document editor with page layout view (A4 and Letter paper sizes, configurable margins) and print CSS styles for crisp PDF export; formatted headings, bold, italic, underline, strikethrough, bulleted and numbered lists, task checklists, blockquotes, code blocks, links, tables, images, horizontal rules, text colors and highlights; document outline inspector, live word and character counters, and estimated reading time; `.ndoc` structured JSON document format in the VFS with Markdown and HTML import and export; DIN 5008 formal letter, modern CV, and report document templates; find & replace.
- **Nexus Whiteboard:** infinite canvas with smooth pan, zoom, and touch gesture support; tools for select/move, pressure-sensitive pen, highlighter, eraser, shapes (rectangles, ellipses, straight lines, and dynamic connectors that stay anchored to shapes), rich text labels, and colored sticky notes; stroke colors, stroke widths, fill colors, opacity, and font sizes; shape grouping/ungrouping, z-index layering (bring to front / send to back), alignment/distribution guides, and snap-to-grid; Flowchart, Kanban, Retro, and SWOT analysis templates; presentation mode stepping through frames; `.nboard` JSON format in VFS, plus high-res PNG and SVG vector export.
- **Nexus Mind Map:** keyboard-first visual ideation canvas (Tab for child nodes, Enter for siblings, arrow key tree navigation, Delete to remove); automatic tree layouts (Right-side tree, Radial mind map, Hierarchical org chart); custom node colors, category icons, and expandable Markdown notes per node; `.nmap` JSON file format in VFS with Markdown outline import and export, plus SVG and PNG visual export.
- **Nexus Paint:** raster image studio with multi-layer canvas support (add, duplicate, delete, reorder, toggle visibility, adjust layer opacity, and merge down); configurable blend modes (source-over, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion); brush engine (round, soft, pencil, spray), eraser, flood fill with tolerance, shape drawing, and text stamping; color adjustments (brightness, contrast, hue/saturation, invert, grayscale, and box blur); symmetry mode and canvas crop/resize; `.npaint` JSON project file format preserving layers in VFS, plus PNG, JPEG, and WebP raster export.
- **Pixel Art Studio:** retro sprite and animation editor with configurable canvas grid (8×8 up to 256×256); pencil, eraser, line, circle, rectangle, flood fill, color picker, and horizontal/vertical mirror drawing; classic retro color palettes (PICO-8, Game Boy 4-shade, Commodore 64, NES) alongside custom color swatches; frame-by-frame animation timeline with onion skinning, adjustable frame duration, and looping playback preview; custom zero-dependency GIF89a encoder producing animated `.gif` files, scaled PNG export, and multi-frame sprite sheets; intent integration to set creations as wallpaper or user avatar.
- **Nexus Present:** Markdown-powered presentation slide authoring using `---` delimiters, live presenter split-view with elapsed stopwatch, current time, speaker notes, and next-slide preview; full-screen slideshow mode with keyboard and clicker controls; themes matching OS aesthetics (Nexus Dark, Clean Light, Terminal Retro, Cyberpunk Neon, Warm Paper); KaTeX MathML equation rendering and syntax-highlighted code blocks; standalone self-contained offline HTML export and print-to-PDF support.
- **PDF Tools:** zero-dependency PDF 1.4 binary generator and document scanner utility; multi-image combiner converting JPEG/PNG images into multi-page PDF documents with A4, Letter, and Fit-to-Image page geometry; 90-degree page rotation, reordering, and page removal; integrated PDF preview viewer with direct download intent.
- **App Center & Desktop Integration:** added real screenshot assets for all 8 Office & Creative applications across App Center and documentation; added desktop context menu and file intent associations (`.nsheet`, `.ndoc`, `.nboard`, `.nmap`, `.npaint`, `.pdf`, `.gif`).
- **Office & Creative End-to-End Suite:** added comprehensive Playwright test suite `tests/e2e/office-creative.spec.js` asserting launch, editing, document export, and rendering for all 8 apps.

## [0.5.0] — 2026-11-10 — Study & Life tools

### Added

- **Timetable (Stundenplan):** weekly and biweekly (A/B) course grid with lecture, tutorial, lab and
  seminar types; rooms, lecturers, colors, and semester date ranges; lecture-free periods and
  holidays; "Now & Next" card and desktop widget; automatic Calendar sync via
  `~/.config/timetable-snapshot.json` overlay; links to Notes folders, Task projects and Flashcard
  decks; attendance tracking per course session; and `.ics` / JSON timetable import and export.
- **Grade Tracker (Notenrechner):** German 1.0–5.0 academic grading scale (with 0.3/0.7 steps; 4.0
  pass mark) with ECTS-weighted average calculation, plus alternative scales (percentages, US GPA,
  UK honours classes, Swiss 6–1, Austrian 1–5); semester dashboard chart, module statuses (planned,
  in progress, passed, failed), attempts tracking and retake planning; partial module grades (exam,
  project, homework weights); and interactive What-If scenario calculator.
- **Flashcards:** decks and subdecks with rich Markdown, syntax-highlighted code blocks, and KaTeX
  math (`$…$`, rendered to CSP-clean MathML); card types: basic, basic + reversed, cloze deletion
  (`{{c1::...}}`), and type-the-answer; modern FSRS spaced repetition scheduler with keyboard-only
  study sessions (1–4, Space), retention forecast chart, review heatmap calendar, and
  hardest-cards inspector; cram mode and custom tag study; CSV/TSV and JSON import/export; and Anki
  `.apkg` deck import powered by `fflate` and `sql.js`.
- **Exam & Study Planner:** exam countdown cards with rooms, module links, and topic checklists;
  automatic study plan generator distributing exam preparation tasks across remaining study days
  into Tasks; and readiness scores based on checklist progress and linked flashcard retention.
- **Habits:** daily, weekday, or N-per-week habits with yes/no, count, or duration goals; check-in
  from within the app, desktop widget, command palette, and terminal (`habit done <name>`); current
  streaks, best streak, completion rates, and GitHub-style yearly heatmaps; scheduler reminders and
  rest-day skipping without streak penalties.
- **Journal:** daily rich-text Markdown entries with 5-point mood rating, tags, and embedded photos
  from the VFS; calendar view with mood dots, "On this day" historical entries, search, writing
  prompts (English and German), and word count stats; whole-journal AES-GCM password encryption via
  `ctx.crypto` with automatic inactivity lock.
- **Budget:** multi-account management (cash, bank, savings), income/expense/transfer transactions
  with categories, tags, and recurring rules (rent, subscriptions); monthly category budget
  allowances with visual progress bars and warnings; donut category breakdowns, monthly income vs
  expense bars, and net balance charts; CSV transaction import with column mapping and CSV export;
  localized `Intl` currency formatting (EUR default); savings goals and expense splitting calculator.
- **Calculator:** multi-mode calculator with shared expression parser: Standard and Scientific modes
  (trigonometry in deg/rad, logarithms, powers, factorials, memory, parentheses, history tape);
  Programmer mode (side-by-side binary, octal, decimal, hexadecimal displays, 8/16/32/64-bit word
  sizes, signed/unsigned modes, bitwise operations, and interactive 64-bit clickable bit grid);
  Graphing mode (canvas plotting of multiple functions, pan/zoom, value tracing, numerical root and
  intersection finder); Equation solver and Matrix operations (determinant, inverse,
  multiplication, transpose); and Statistics mode (mean, median, standard deviation, linear
  regression).
- **Unit Converter:** 16 measurement categories (length, area, volume, mass, temperature, time,
  speed, pressure, energy, power, angle, data sizes with SI `kB` vs IEC `KiB` distinction, data
  rate, frequency, fuel economy, cooking); two-way live conversions, favorite pairs, and history;
  number base conversions and Roman numerals.
- **Clock:** World Clock with customizable cities and timezones via `Intl`, analog and digital
  clocks; scheduler-backed alarms, multiple simultaneous named timers with sound, and precision
  stopwatch with laps and export; time-zone meeting planner across multiple international locations.
- **Password Generator & Vault:** customizable password generator with length, symbol sets, entropy
  estimation, and English/German passphrase generation from bundled wordlists; 30-second clipboard
  auto-clear; master-password AES-GCM encrypted vault (`ctx.crypto`) with auto-lock, categories, and
  search; RFC 6238 TOTP two-factor authenticator with animated countdown; local password security
  health check (weak, reused, and stale passwords); and CSV import/export.
- **Bookmarks & Reading List:** bookmark collections with tags, notes, and zero-network
  letter-avatar fallback; browser HTML bookmarks import and export; reading list with read/unread
  tracking.
- **Clipboard Manager:** automatic clipboard history tracking with search, pinned items,
  single-click paste, clear history, and automatic exclusion of sensitive vault passwords; snippet
  manager with dynamic variable substitution (`{{date}}`, `{{clipboard}}`).

## [0.4.0] — 2026-11-10 — Productivity core

### Added

- **Nexus Notes:** Markdown notes stored in `Documents/Notes` with YAML front-matter, CodeMirror 6
  editor (edit, split and live-preview modes with synchronized scrolling), formatting toolbar,
  GitHub-flavored Markdown with footnotes, interactive task-list checkboxes, syntax-highlighted code
  blocks, **math rendering via KaTeX** (`$…$` and `$$…$$`, rendered to CSP-clean MathML), pasted and
  dropped VFS images, nested folders with drag-and-drop, tags, favorites, full-text search with date
  and tag filters, `[[Wiki links]]` with autocomplete and backlinks panel, force-directed Canvas
  **Graph view**, daily notes and templates, outline and reading-time inspector, checklist-to-Task
  promotion, per-note AES-GCM password encryption with auto-lock, and `.md`/`.html`/`.zip`/`.json`
  import and export.

- **Tasks:** projects with colors and sections, Inbox, nested subtasks, 4 priority levels, due dates
  and times, recurring tasks and scheduler reminders, attachments and note links, bilingual natural
  language **quick add** in English and German (`!1 #Uni @deepwork tomorrow 14:00 every week`), List
  view (grouped by section/date/project/priority), **Kanban** board with drag-and-drop and WIP
  limits, Today/Upcoming/Overdue and 2-week Calendar views, saved filters, completion sound with
  undo, "Today's tasks" desktop widget, and productivity statistics.
- **Calendar:** Day, Week, Month, Year and Agenda views with mini-month navigator and ISO week
  numbers; pointer drag-to-create, drag-to-move and drag-edge-to-resize on the 24-hour time grid;
  multiple calendars with colors and visibility toggles; full recurrence rules with single-instance
  (`EXDATE`/overrides) and "this and following" series splitting; multiple reminders per event;
  toggleable overlays for **Tasks with due dates**, **University Timetable** and **German public
  holidays** (computed locally by federal state, including Hesse and Easter-based holidays); natural
  language quick add; and RFC 5545 `.ics` import and export (`VEVENT`, `RRULE`, `EXDATE`, `VALARM`).
- **Focus:** Pomodoro timer (configurable work, short break, long break and rounds) and count-up
  **Flow mode** with circular ring UI and compact mini-window toggle; task linking that logs
  completed focus minutes directly onto Tasks; **procedural 10-channel Web Audio ambient mixer**
  (rain, thunderstorm, white/pink/brown noise, café murmur, fireplace crackle, ocean waves, forest
  and 40 Hz gamma binaural tones) with saved mixes; automatic Do-Not-Disturb and window-level
  **distraction blocking** (blocks games and chosen apps during work sessions with a logged
  "I really need it" override); Focus Goal desktop widget; and 7-day focus statistics.

## [0.3.0] — 2026-11-09 — System apps

### Added

- **File Explorer:** browse your files in icon, list, details or column view; preview pictures,
  highlighted code, Markdown, audio, video and PDFs; rename, copy, cut, paste, drag and drop
  between apps or from your computer, tag files, undo the last file change, and restore from the
  Trash (which also empties old items automatically).
- **Terminal:** a real shell with tabs, history search (`Ctrl+R`), tab completion, pipes (`|`),
  redirection (`>`, `>>`, `<`), `&&`/`||`, variables, aliases, `~/.nexusrc`, 47 built-in commands
  including `nexusfetch`, plus commands registered by apps.
- **Nexus Edit:** tabbed code and text editor on CodeMirror 6 with syntax highlighting, side-by-side
  Markdown preview, regex find and replace, multiple cursors, go to line, automatic draft recovery
  across reloads, and unsaved-changes protection on close.
- **Settings:** 14 pages covering Personalization, Desktop & Dock, Windows, Notifications,
  Shortcuts (rebind any shortcut), Language & Region, Profiles & Lock, Storage, Apps, Privacy,
  Accessibility, Backup & Restore, Updates and About (with full changelog and bundled library/font
  licenses), plus instant search and `@` deep links from the command palette.
- **System Monitor:** live Processes (per-window activity, DOM size and End task), Performance
  graphs (FPS, frame time, JS heap, DOM nodes, animation loops and workers), Storage breakdown,
  filterable System Log with export, and Network activity log.
- **App Center:** browse built-in apps by category with code size, permissions, bundled screenshots
  and changelogs; uninstall apps to hide them everywhere (and optionally clear their data) or
  reinstall them any time.
- **Help:** searchable user guides in English and German plus per-app help pages; press `F1` in any
  app to jump straight to its documentation.

## [0.2.0] — 2026-10-16 — Shell

### Added

- A real desktop: boot screen with live progress, lock and login screens (PIN, switch profile,
  guest profile that wipes itself on log out), desktop icons from your Desktop folder, 6 live
  wallpapers plus gradients, your own pictures and slideshows.
- Windows you can drag, resize, snap to halves/thirds/quarters (also from a layouts menu on the
  maximize button), minimize into the dock, spread over workspaces, and find again in the
  overview or with the Alt+` switcher. Everything comes back after a reload.
- Dock with running dots, badges, previews and magnification; top bar with clock, volume,
  notifications and profile menu; launcher (`Ctrl+Space`); command palette (`Ctrl+K`) with
  commands, files, settings, a calculator and live theme preview.
- Notification center with quick settings (Do not disturb, theme, battery saver, volume, Focus,
  screenshot, lock).
- Desktop widgets: clock (digital, analog, world), calendar, system status, quick note (saved as
  a file), Pomodoro, countdown and an app launcher. Apps can add their own.
- System dialogs for apps: open and save files in Nexus, pick colors, choose an app ("Open with…").
- Hold `Ctrl+/` to see every keyboard shortcut available right now.
- On phones: full-screen windows, an app bar (Apps, Home, Switcher), swipe up for the switcher
  and down for notifications, long-press for context menus.
- A Welcome window with a short tour on first start.

## [0.1.0] — 2026-10-15 — Kernel & services

### Added

- The engine every app will run on: app registry and lifecycle, crash protection per window
  ("This app stopped working" with Restart and Copy report), intents ("Open with…").
- Your data stays in the browser in a real file system (folders, trash, tags, search, import and
  export as zip), with automatic upgrades of saved data between versions.
- Local profiles with an optional PIN, 8 themes (Neon Night, Synthwave, Matrix, Blade, Deep Ocean,
  Arctic Light, Paper, High Contrast) with accent color, text size, transparency and animation
  settings, and English/German that switch without reloading.
- Notifications with Do-not-disturb, reminders that survive restarts ("While you were away"),
  fast fuzzy search over apps, commands, settings and files, synthesized UI sounds, clipboard
  history, achievements and XP levels.
- Full backup and restore of a profile as one `.nexus-backup` file, optionally password-encrypted.
- If IndexedDB is blocked, Nexus says so and falls back to limited storage instead of failing.

## [0.0.0] — 2026-10-15 — Foundation

### Added

- Installable Progressive Web App: works offline after the first visit and shows an
  "Update available — reload" notice when a new version is deployed.
- **Nexus Lite:** the whole OS as one `nexus-lite.html` file that runs by double-click, without a server.
- Start screen showing version, build date, edition, online/offline state, background-worker status
  and whether the browser keeps your data persistently. English and German.
