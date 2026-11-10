# Changelog

All notable changes to Nexus Arcade OS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) (`0.N.0` = phase N).

## [Unreleased]

## [0.4.0] — 2026-11-10 — Productivity core

### Added

- **Nexus Notes:** Markdown notes stored in `Documents/Notes` with YAML front-matter, CodeMirror 6
  editor (edit, split and live-preview modes with synchronized scrolling), formatting toolbar,
  GitHub-flavored Markdown with footnotes, interactive task-list checkboxes, syntax-highlighted code
  blocks, **math rendering via KaTeX** (`$…# Changelog

All notable changes to Nexus Arcade OS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) (`0.N.0` = phase N).

## [Unreleased]

and `$…$`, rendered to CSP-clean MathML), pasted and
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
