# ⚡ Nexus Arcade OS

[![CI](https://github.com/w1kyu/nexus-arcade-os/actions/workflows/ci.yml/badge.svg)](https://github.com/w1kyu/nexus-arcade-os/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-1.0.0-3ef0ff)
![License: MIT](https://img.shields.io/badge/license-MIT-3ddc97)

A complete, offline-first desktop operating system that runs inside your browser: overlapping & snapped windows, virtual file system, real shell terminal, theme engine, sandboxed plugin SDK, 91 built-in apps & arcade games, local-first AI workspace, and zero backend dependencies.

> **Version 1.0.0 — General Release.** All 13 development phases are complete: Kernel, Desktop Shell, System Utilities, Productivity Core, Study & Life Tools, Office & Creative Suite, Developer Toolkit, CS Lab, Game Engine & 31-Game Arcade, Media Center, AI Workspace, Sandboxed Plugin SDK, Theme Editor, Sync Folder, Gamification & Accessibility Audits.

![The Nexus desktop: a Welcome window snapped left, clock, Pomodoro, calendar and system status widgets on the right](docs/screenshot.png)

**Live PWA:** https://nexus-arcade-os.onrender.com · **Nexus Lite:** [download `nexus-lite.html`](https://nexus-arcade-os.onrender.com/nexus-lite.html)

---

## Two Editions, One Codebase

| Feature              | Website Edition (PWA)                                         | Nexus Lite (`nexus-lite.html`)                                              |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Install / Launch** | Installable Progressive Web App                               | Single self-contained HTML file (~7 MB) — double-click to run via `file://` |
| **Offline Support**  | Full Workbox precaching of app chunks, fonts, WASM, and icons | Built-in (`window.NEXUS_EDITION === 'lite'`), zero external requests        |
| **Apps Included**    | All 91 built-in apps + Plugin SDK                             | All 91 built-in apps + Plugin SDK (workers inlined via Blob URLs)           |
| **Updates**          | Automatic update prompt with one-click reload                 | Replace the single HTML file; use `.nexus-backup` to transfer profile data  |

---

## Feature Overview (91 Built-In Apps)

- **Desktop Shell & Personalization:** Multi-workspace window manager with halves/thirds/quarters snapping, dock with badges & magnification, Command Palette (`Ctrl+K`), Quick Switcher (``Alt+` ``), Desktop Widgets, 6 animated Canvas/WebGL live wallpapers, Interactive First-Run Tour, Daily Discovery Tips, Demo Profile, and **Live Theme Editor** (token editor, WCAG AA/AAA contrast warnings, wallpaper color extraction, macOS/Windows titlebars, `.nexus-theme` import/export, Profile Cards).
- **Productivity & Personal Life:** **Nexus Notes** (CodeMirror 6, KaTeX MathML, `[[Wiki links]]`, graph view, per-note AES-GCM encryption), **Tasks** (Kanban, bilingual EN/DE natural quick-add), **Calendar** (Day/Week/Month/Year + Tasks/Timetable/German Holidays + `.ics`), **Focus** (Pomodoro + Flow + 10-channel procedural Web Audio ambient mixer), **Habits**, **Journal** (encrypted), **Budget**, **Calculator** (Standard, Scientific, 64-bit Programmer, Graphing, Matrix, Stats), **Unit Converter**, **Clock**, **Password Vault & TOTP**, **Bookmarks**, **Clipboard Manager**.
- **Study & CS Lab:** **Timetable (Stundenplan)**, **Grade Tracker**, **Flashcards** (FSRS + `.apkg` Anki import), **Exam Planner**, **Sorting Visualizer**, **Pathfinding**, **Graph Lab**, **Data Structures**, **Logic Circuits**, **Turing Machine**, **Number Systems & IEEE 754**, **SQL Playground** (`sql.js` WASM), **Nexus-8 CPU Simulator**, and **CS Lab**.
- **Office & Creative Suite:** **Nexus Sheets** (10,000 × 100 virtual grid, 40+ formulas, embedded charts), **Nexus Write** (A4/Letter print layouts), **Nexus Whiteboard**, **Nexus Mind Map**, **Nexus Paint** (layers & blend modes), **Pixel Art Studio** (animated `.gif` export), **Nexus Present** (Markdown slides), **PDF Tools**.
- **Developer Toolkit:** **Code Playground**, **Nexus Code** (multi-file IDE + Node-Lite worker), **Developer Tools** (JSON/YAML/CSV, Crypto, Regex tester, JWT, Cron, UUID, QR, SVG), **Diff Viewer**, **Color Laboratory** (OKLCH, APCA, colorblindness sim), **HTTP Client**, **Snippet Manager**.
- **Media Center:** **Nexus Music** (ID3/Vorbis/MP4 tags, `.lrc` lyrics, 10-band EQ, 5 visualizers, MediaSession), **Video Player** (`.vtt`/`.srt` subtitles, PiP), **Nexus Photos** (EXIF viewer, non-destructive editor), **Voice Recorder**, **Camera** (WebGL shaders & QR scanner), **Screen Recorder**, **Beat Lab** (Web Audio drum machine + WAV render), **Synthesizer** (polyphonic + Web MIDI).
- **AI Workspace (`nexus.chat` & `nexus.assistant`):** Connects strictly to **user-configured** endpoints (Ollama, Lemonade, OpenAI-compatible servers, Anthropic) with encrypted device-key API secrets, streaming chat, RAG indexing over Notes, OS tool calling with approval cards, and integrations inside Notes, Tasks, Flashcards, Sheets, Code Playground, Terminal, and Photos.
- **Arcade (31 Games + Hub):** Snake Evolution, Breakout (+ level editor), Memory Master, 2048, Reaction Trainer, Blockfall, Minesweeper, Void Drifter, Sudoku, Typing Trainer, Neon Pong, Solitaire Collection, Nexus Chess (Web Worker AI + puzzles), Connect Four, Grid Invaders, Neon Glide, Nonogram, Block Pusher, Hexword (EN/DE), Checkers, Battleships, Grid Defense, Pixel Runner, Neon Racer, Ultimate Tic-Tac-Toe, Mahjong Solitaire, Match-3, Bubble Shooter, Cellular Automata, Quiz Arena, with local 2P multiplayer & gamepad support.
- **System, Sync & Gamification:** **File Explorer**, **Terminal** (pipes, redirection, app commands), **Nexus Edit**, **System Monitor**, **Settings** (15 pages), **App Center** (install/manage sandboxed `.nexus-plugin` & `.js` plugins), **Help** (`F1`), **Profile & Achievements** (XP, levels, OS-wide badges, **Nexus Wrapped**), `.nexus-backup` conflict wizard, **Sync Folder** (File System Access API), and QR pairing transfer.

---

## Privacy

Zero analytics, zero tracking, zero telemetry. All personal data stays strictly inside your browser's IndexedDB (`nexus-profile-<id>`). Outbound network traffic occurs **only** when you explicitly configure an AI endpoint or send a request in HTTP Client. See [Security Review](docs/security.md).

---

## Build & Run Locally

Requires Node **24 LTS** (`.nvmrc`).

```sh
npm install
npm run dev          # Start development server
npm run build        # Build dist/ (PWA) + dist/nexus-lite.html (< 8.00 MB budget)
npm run preview      # Preview production build
npm test             # Run Vitest unit & migration tests
npx playwright install chromium   # Once
npm run test:e2e     # Run Playwright E2E + axe-core WCAG AA tests
npm run lint         # ESLint + Prettier + EN/DE i18n key check
npm run typecheck    # TypeScript checkJs verification
```

---

## Documentation & Extending Nexus

- [Architecture Overview](docs/architecture.md)
- [Plugin SDK Guide](docs/plugin-sdk.md) & [`examples/plugins/`](examples/plugins/)
- [App API Reference](docs/app-api.md) & [`src/kernel/types.d.ts`](src/kernel/types.d.ts)
- [OS Event Reference](docs/events.md)
- [Design System](docs/design-system.md)
- [Offline & Nexus Lite Audit](docs/offline-audit.md)
- [Security Review](docs/security.md)
- [Testing Guide](docs/testing.md) & [Release Process](docs/release.md)

---

## Contributing & License

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

Licensed under the [MIT License](LICENSE). Bundled self-hosted fonts: Inter Variable and JetBrains Mono Variable under the SIL Open Font License 1.1 (`src/styles/fonts/`).
