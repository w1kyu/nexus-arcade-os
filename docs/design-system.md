# Design system (v2, phase 14.3)

Nexus is built from CSS custom properties (`src/styles/tokens.css`, theme values from `src/services/theme/`) and small vanilla DOM helpers in `src/ui/`. No UI framework.

The rules for using all of this (tokens only, two shapes, glow budget, targets, focus, contrast, type, motion, states, copy, icons) live in one place: the project skill [`.claude/skills/nexus-ui/SKILL.md`](../.claude/skills/nexus-ui/SKILL.md). This page is the catalogue.

**Direction:** HUD shell, calm interior. The shell (top bar, dock, window frame and titlebar, palette, launcher) has bevelled corners, a mono uppercase voice and the accent. Everything inside a window uses solid surfaces, rounded cards, no glow and sentence case.

**Live gallery:** `npm run dev`, open `/#debug`, scroll to _Components_. It renders every component below in the current theme.

---

## 1. Tokens

Every theme defines every role; `tests/unit/theme.test.js` checks the contrast pairs for all 9 themes.

### Color roles

| Token                                                                                                                     | Use                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `--bg`                                                                                                                    | Desktop and page background                                                            |
| `--surface-1` / `-2` / `-3`                                                                                               | Window body / cards and controls / raised controls, hover on controls                  |
| `--surface-sunken`                                                                                                        | Inputs, sidebars, titlebars, wells                                                     |
| `--surface-hover`                                                                                                         | Hover on rows and ghost buttons (translucent, works on any surface)                    |
| `--surface-active`                                                                                                        | Selected row, pressed toggle button (text-1 stays ≥ 4.5:1 on it)                       |
| `--border` / `--border-strong`                                                                                            | Dividers / control outlines, unfocused window frames                                   |
| `--frame`                                                                                                                 | Shell frame: focused window, dock, palette, launcher                                   |
| `--text-1` / `-2` / `-3`                                                                                                  | Primary / secondary / muted text (all ≥ 4.5:1 on every surface)                        |
| `--accent`, `--accent-2`, `--accent-contrast`                                                                             | Primary actions and selection; secondary hue; text on `--accent`                       |
| `--focus`                                                                                                                 | Keyboard focus ring (cyan in Nexus HUD and High Contrast, the accent elsewhere)        |
| `--success`, `--warning`, `--danger`, `--info`                                                                            | Status (≥ 4.5:1 as text on bg, surface-1, surface-2); `--danger-contrast` sits on them |
| `--accent-soft`, `--success-soft` … and `--accent-on-soft`, `--success-on-soft` …                                         | Tinted status backgrounds with their readable text color (badges, banners)             |
| `--chart-1` … `--chart-8`                                                                                                 | Data visualisation, ≥ 3:1 on `--surface-1`                                             |
| `--hue-productivity`, `--hue-study`, `--hue-office`, `--hue-dev`, `--hue-cslab`, `--hue-games`, `--hue-media`, `--hue-ai` | App category hues (app tiles, category tags)                                           |
| `--scrim`                                                                                                                 | Behind modals, sheets and the palette                                                  |
| `--glass` + `--blur-glass`                                                                                                | Top bar, dock, menus (blur off in Battery saver and with transparency at 0)            |

Game canvases may keep their own palettes; the UI around them uses these roles.

### Shape, depth, glow

- `--radius-sm` / `-md` / `-lg` / `-full`: interior corners (scaled by Settings → Theme Editor → window radius). A child's radius is ≤ its parent's.
- `--bevel` / `--bevel-sm` with `corner-shape: var(--corner-shape)`: shell corners. Chromium cuts them; Firefox and WebKit fall back to rounded. Settings → Theme Editor → _Window and dock corners_ switches to rounded everywhere (`data-corners="round"`).
- `--shadow-1` / `--shadow-2`: two-layer shadows (ambient + direct); none in High Contrast.
- Glow budget of three: `--glow-window` (focused window), `--glow-btn` (primary button), the accent bar of the active selection. Nothing else glows.

### Size and type

- Spacing `--space-1` (4 px) … `--space-7` (48 px).
- Control heights `--control-h-sm` / `-md` / `-lg`: 28 / 34 / 40 px; 24 / 30 / 36 with `data-density="compact"`; 36 / 44 / 48 on phones and with large targets on.
- Type ramp (× `--font-scale`): `--text-xs` 12, `--text-ui` 13, `--text-sm` 14 (body), `--text-md` 16, `--text-title` 19, `--text-headline` 22, `--text-display` 26, `--text-hero` 30 px. (`--text-lg` 20, `--text-xl` 28 and `--text-2xl` 40 remain for existing screens.) Weights `--weight-regular` 450, `--weight-medium` 550, `--weight-bold` 650. `.nx-num` sets tabular figures.
- `--font-sans` (Inter, or the user's choice), `--font-mono` (JetBrains Mono): the shell's voice is mono uppercase with 0.06em tracking.

### Motion

`--dur-fast` 120 ms (hover), `--dur-med` 220 ms (menus, sheets, windows), `--dur-slow` 420 ms; `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`. Durations drop to 0 with Animations off or reduced motion. Keyboard-opened surfaces (palette) appear instantly.

---

## 2. Components

CSS in `src/ui/controls.css`, helpers in `src/ui/dom.js` and `src/ui/components.js`. Prefer the helpers: they set the ARIA state.

| Component                 | Markup / helper                                                                                                                               | Notes                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                    | `button({ label, icon, variant, size })` → `.nx-btn` + `.is-primary` / `.is-ghost` / `.is-danger`, `.is-xs` / `.is-sm` / `.is-lg`, `.is-icon` | No label = icon-only, `title` becomes the name. One primary per view. `.is-xs` is the 28 px editor-toolbar size. `aria-pressed="true"` (toggles, the current tool/mode/filter) or `aria-current` shows the pressed state. |
| Icon button               | `iconButton({ icon, label, pressed })` → `.nx-icon-btn`                                                                                       | 32 px; `aria-pressed` shows the active state                                                                                                                                                                              |
| Segmented                 | `segmented({ label, options, value, onChange })` → `.nx-segmented`                                                                            | Radio group, arrow keys                                                                                                                                                                                                   |
| Tabs                      | `tabs({ label, tabs, value, onChange })` → `.nx-tabs`                                                                                         | Roving focus; the caller shows the panel                                                                                                                                                                                  |
| Field                     | `field({ label, hint, error }, control)` → `.nx-field`                                                                                        | Wires `for`, `aria-describedby`, `aria-invalid`                                                                                                                                                                           |
| Input / select / textarea | `.nx-input`, `.nx-select`, `.nx-textarea` (`.is-sm`, `.is-xs`, `.is-mono`; `.nx-input.is-inline` for a document title edited in place)        | Sunken surface, focus ring in `--focus`. `.is-xs` sizes to its content for toolbars.                                                                                                                                      |
| Toggle                    | `toggle({ label, checked, onChange })` → `.nx-toggle`                                                                                         | `role="switch"`                                                                                                                                                                                                           |
| Slider                    | `rangeField({ label, min, max, value, format, onInput })` → `.nx-range`                                                                       | Shows the formatted value, sets `aria-valuetext`                                                                                                                                                                          |
| List row                  | `listRow({ title, subtitle, meta, icon, selected, onClick })` inside `.nx-list`                                                               | Selected rows get `--surface-active` and the accent bar                                                                                                                                                                   |
| Panel (card)              | `panel({ title, sunken }, ...children)` → `.nx-panel`                                                                                         | `.nx-card` is taken by Solitaire                                                                                                                                                                                          |
| Badge                     | `badge(text, tone)` → `.nx-badge.is-neutral/accent/success/warning/danger/info`; plain `.nx-badge` is a count                                 | Soft background + on-soft text                                                                                                                                                                                            |
| Kbd                       | `<kbd class="nx-kbd">`                                                                                                                        |                                                                                                                                                                                                                           |
| Empty state               | `emptyState({ icon, title, text, action })` → `.nx-empty`                                                                                     | Says what's missing and offers one next action                                                                                                                                                                            |
| Skeleton                  | `skeleton({ lines, label })` → `.nx-skeleton`                                                                                                 | Show after 150–300 ms, keep ≥ 300 ms                                                                                                                                                                                      |
| Toolbar                   | `toolbar({ label, title }, ...items)`; `null` = spacer, `'\|'` = separator                                                                    | `role="toolbar"`                                                                                                                                                                                                          |
| Status bar                | `statusBar(...items)` → `.nx-statusbar`                                                                                                       | Tabular figures                                                                                                                                                                                                           |
| App frame                 | `createAppFrame({ label, locale, toolbar, sidebar, content, inspector, status })` (`src/ui/frame/`)                                           | See below                                                                                                                                                                                                                 |

Also in `src/ui/`: `overlay.js` (modals, popovers, tooltips: focus trap, Esc, focus return), `menu.js` (context menus), `markdown.js`, `diff.js`, `qr.js`, `color-extract.js`, `visualizer/` (CS Lab engine), `tool-layout.js` (input/output tools, built on the app frame).

### App frame

```js
import { button } from '../../ui/dom.js';
import { statusBar, toolbar } from '../../ui/components.js';
import { createAppFrame } from '../../ui/frame/app-frame.js';

const frame = createAppFrame({
  label: ctx.i18n.t('app.name'),
  locale: () => ctx.i18n.locale,
  toolbar: toolbar(
    { label: ctx.i18n.t('toolbar'), title: ctx.i18n.t('app.name') },
    button({ label: ctx.i18n.t('new'), icon: 'plus', variant: 'primary', size: 'sm', onClick: create }),
    null,
    button({ label: ctx.i18n.t('export'), size: 'sm', onClick: exportAll }),
  ),
  sidebar: folderList,
  content: noteView,
  status: statusBar(wordCount),
});
root.append(frame.root);
```

- Areas: toolbar (sticky) / sidebar · content · inspector / status bar. Content scrolls; the frame never does.
- The sidebar toggle is added to the toolbar automatically. Below 640 px of window width the sidebar becomes a sheet over the content (scrim, Esc closes, focus moves in) and the inspector stacks under the content.
- Toolbar items that don't fit move into a _More actions_ menu, last item first. Mark an item `data-overflow="never"` to keep it. Call `frame.refresh()` after changing the toolbar.
- Existing apps wrap their own panels with `bare: true`: the panels keep their look and width, and without a toolbar of the app's own the frame shows a toggle bar only in narrow windows (`toggleIn: headerEl` puts the toggle into the app's header instead). Apps that re-render keep one frame and swap panels with `frame.setSidebar(el)` / `frame.setContent(el)`. In a sheet, picking a button or link closes it; typing does not. An inspector whose panel is `hidden` hides its slot.
- On the frame (14.5): Help, Notes, Tasks, Calendar, Bookmarks, Budget, Journal, Vault, Flashcards, Music, Chat, HTTP Client, Snippets, Recorder (list as inspector), Developer Tools and the developer tool layout. Kept on purpose: Settings (list → page on phones), Files (own places sheet), App Center (category strip on phones), apps whose side panel is a tool palette or inspector (Paint, Pixel Art, Photos, Circuits, Write's outline, Code's explorer with its activity bar), apps with top tabs (Calculator, Clock, Color Lab) and the games (game shell) and CS Lab tools (visualizer layout).

### App CSS

App stylesheets use tokens only: no hard-coded colors, font sizes from the type ramp, no app-local copies of shared controls (`scripts/check-tokens.js`, baseline in `scripts/token-baseline.json`). Specialised controls with no shared equivalent are named for their role, not their element (`.nx-calc-key`, `.nx-camera-shutter`, `.nx-quiz-option`). Kept on purpose: game art colors (tiles, boards, cards, swatches), document typography that scales with the document (Write pages, Present slides) and 8–9 px glyphs inside game and visualizer cells.

## 3. Voice

Rule 12 of the skill in practice. Nexus talks like a helpful colleague: plain, short, specific.

- **Sentence case** everywhere inside windows: buttons, headings, menu items, labels ("Play now", "Local history"). No all-caps calls to action; mono uppercase belongs to the shell (titlebar, top-bar app name) and game HUD readouts.
- **Say what it does for the user.** App descriptions are one sentence that starts from the user's goal ("Plan tasks and projects in lists or boards"), not the implementation ("Kanban boards with bilingual NLP quick add"). Technical detail (algorithms, formats, standards) goes in the app's Help page.
- **No marketing words:** professional, next-gen, ultimate, powerful, seamless, vibrant, salon, cascades, quantum, high-velocity. If a sentence still works without the adjective, drop it.
- **Honest states.** Empty states say what's missing and offer one next step ("No notes yet. Create one with New note."). Errors say what happened and how to fix it. Never pretend: no fake data, no "AI" output without a configured model.
- **Actions** are verbs ("Save", "Export…"); `…` marks an action that asks for more before it runs. Confirmations name the thing ("Delete 3 notes?") and the button repeats the verb ("Delete"), never "OK".
- **Both languages.** Every string ships in English and German; German uses "du", keeps nouns capitalized and follows the same sentence-case rule ("Spiel starten", not "SPIEL STARTEN").
