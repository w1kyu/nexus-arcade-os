# Phase 14 — UI/UX rework (v1.1)

Goal: make Nexus look and behave like **one** product. Today the shell is coherent but the 93 apps each have their own styling, so themes, light mode, mobile and copy all break app by app. This phase fixes the basics first, then moves every surface onto one design system, and only then refines the look.

Status: **plan, decisions taken 2026-11-15** (§14.0). Direction: HUD shell + calm window interiors (prototype variant D).

---

## Audit (2026-11-15, build of `42cac6b` + the uncommitted theme-schedule work)

How: Playwright screenshots of the production build at 1440×900 and 390×844, in Neon Night and Arctic Light, plus `grep` counts over `src/apps`.

### Bugs seen in the live build

| #   | Where                           | What                                                                                                                                                                                                                                                                       |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Settings sidebar                | Every page shows its label twice ("Personalization Personalization"). The icon slot renders text: `<span class="nx-icon-wrap">Personalization</span>`.                                                                                                                     |
| B2  | Sorting Visualizer (+ CS Lab)   | Raw keys in the UI: `engine.speed`, `engine.step: 0`, `engine.pseudocode`, and a button reading `[object HTMLSpanElement] engine.play`. Cause: `src/ui/visualizer/engine.js` calls `t(key, 'fallback')`, but `t`'s 2nd argument is params, and the keys exist in no app's `i18n/`. |
| B3  | i18n check                      | `scripts/check-i18n.js` passed with B2 present: it compares EN against DE but never checks that keys used in code exist.                                                                                                                                                   |
| B4  | Arcade Hub (and likely others)  | It ignores the theme: it stays dark navy with cyan in Arctic Light.                                                                                                                                                                                                         |
| B5  | Command palette                 | Searching "Notes" ranks Journal above Nexus Notes. A description match beats a name match.                                                                                                                                                                                  |
| B6  | Mobile                          | The "ready to work offline" toast covers the bottom nav (Home/Switcher).                                                                                                                                                                                                    |
| B7  | Overview                        | The search field overlaps the workspace strip and the first row of thumbnails.                                                                                                                                                                                             |
| B8  | Sorting Visualizer              | Bars render as a flat 2 px line at the default size. Pseudocode line 5 is misaligned.                                                                                                                                                                                      |

### Systemic problems

- **No shared component layer in practice:** 91 app stylesheets hold about 38,000 lines of CSS. Only 23 of 93 apps use `.nx-btn`; the rest define their own (`nx-cs-btn` ×56, `nx-write-btn` ×33, `nx-pixelart-btn`, `nx-paint-btn`, `nx-sheets-btn` …).
- **Themes stop at the app border:** there are 1,923 hard-coded colors (`#hex`/`rgb(`) in app CSS. This is the root cause of B4 and of most light/high-contrast breakage.
- **No app scaffold:** every app reinvents its header, toolbar, sidebar, status bar and empty state. Compare Files (clean sidebar + toolbar), Arcade Hub (marketing hero, all-caps CTAs, emoji art), Sorting (full-width stacked selects) and Journal.
- **First boot is noisy:** Welcome offers 6 equal-weight buttons plus 4 cards plus a shortcut table, and it overflows its window. Two toasts arrive at once ("ready offline", "Achievement unlocked"). The `[P2]` first-boot setup (2.1) is still open.
- **Copy reads like a spec:** app descriptions such as "Interpolated cyber snake with 6 maps, power-up cascades, and hazard patrols" or "… AES-GCM password encryption" appear in the launcher, palette and Arcade. Window titles like `~ — Terminal` and `Home — File Explorer` are inconsistent.
- **Icon grammar is mixed:** in the dock and launcher, system apps get grey tiles and others colored tiles. Every Productivity icon has the same teal tile, so color carries no information. Arcade cards use emoji.

---

## Research (2026-11-15)

Sources read, and what Nexus takes from each. All are rulebooks for agents; none can see this codebase, so the result is our own rule set (§ Design rules) and a project skill, not a dependency.

| Source                                                                                                                                                  | What it is                                                                                                                                         | License             | Take                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)                                                                                | Searchable design database (80 styles, 192 palettes, 74 font pairs, 120 UX rules) + `search.py --design-system` that writes `design-system/MASTER.md` | MIT, needs Python 3 | Its priority-ordered UX rules and pre-delivery checklist (contrast 4.5:1, focus ring 2–4 px, targets ≥ 24 px web / 44 px touch, one primary CTA per screen, no emoji icons, exit motion ≈ 60–70 % of enter). Skip the style generator: our identity is set. |
| [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)                                                      | Design-direction skill: plan tokens first, review the plan, then code                                                                              | Apache-2.0          | The "AI slop" list (all-caps tracked eyebrows, middle-dot meta strings, identical card kits, fade-up on everything, emoji art) and "one memorable element, everything else quiet". Arcade Hub today hits most of the list.                |
| [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines)                                                                                 | Concrete web rules by area (interactions, motion, layout, content, forms, perf, design)                                                            | not stated          | Most of § Design rules: `:focus-visible`, never `transition: all`, layered shadows, nested radii, tabular numbers, `…` not `...`, spinner show-delay 150–300 ms / min 300–500 ms, design empty/sparse/dense/error states. Also ships an audit skill (`web-design-guidelines`). |
| [ui-skills](https://www.ui-skills.com) (ibelick)                                                                                                        | `baseline-ui`, `fixing-accessibility`, `fixing-motion-performance`: QA skills for existing UI                                                       | not stated          | Best fit for the migration waves (14.5): they fix, not redesign. Examples assume Tailwind, rules translate. Notable: no glow as a primary affordance, never animate large `blur()`/`backdrop-filter`, blur ≤ 8 px for one-shot effects.        |
| [aiforui.dev skills](https://aiforui.dev/skills) (Emil Kowalski, `emilkowalski/skills`)                                                                 | 18 motion and polish skills                                                                                                                        | not stated          | `review-animations` (Approve/Block review), `remove-animations` (no motion on keyboard navigation), `break-ui` (worst-case data: long names, empty lists, huge counts). Ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, dialog 300 ms in / 150 ms out, scale from 0.95 not 0. |
| [Taste](https://github.com/Leonxlnx/taste-skill)                                                                                                         | Landing-page generator                                                                                                                             | MIT                 | Not a fit (company websites, not app UI).                                                                                                                                                                                                |
| [Superdesign review](https://superdesign.dev/blog/design-skills-reviewed) (vendor opinion)                                                              | Comparison of the above                                                                                                                            | –                   | Confirms the split: direction skills for new work, QA skills for existing UI; rulebooks cannot see your code, so pair them with screenshots.                                                                                            |

## Design rules

The rules distilled from the research live in one place: the project skill [`.claude/skills/nexus-ui/SKILL.md`](../.claude/skills/nexus-ui/SKILL.md) (13 rules: tokens only, shell vs. interior shapes, glow budget of three, one primary action, targets, focus, contrast, type ramp, motion, blur, states, copy, icons). `docs/design-system.md` (14.3) will document the components and point back to it.

## Prototype (2026-11-15)

`prototypes/phase-14-ui/` (throwaway, not imported by `src/`; uses the real icon set and fonts). Run `npx vite prototypes/phase-14-ui`, then `?variant=A|B|C&scene=settings|arcade|setup|palette|mobile|components&theme=neon|arctic|hc`; ←/→ cycle variants. Screenshots in `prototypes/phase-14-ui/shots/` (`before-*` = current build, `A-*`/`B-*`/`C-*` = proposals).

- **A: Refined neon** (recommended): same identity, glow budget, opaque calmer surfaces, grouped-list settings, app scaffold, category-hue tiles. Shown in all scenes and in Neon Night / Arctic Light / High Contrast.
- **B: Calm pro**: graphite, no glow, taskbar with Start + labelled running apps, bento-card settings.
- **C: HUD**: amber/cyan, chamfered frames, left app rail, global app menu in the top bar, live-preview inspector pane.
- **D: HUD shell + calm interior** (**chosen**): C's shell (amber, grid wallpaper, bevelled window/dock/palette via `corner-shape: bevel`, mono uppercase titles, global app menu) with B's interiors (solid graphite surfaces, rounded cards, bento settings). Keeps the dock (decision 2), restyled as bevelled slots with glyphs in the category hue. New default theme _Nexus HUD_. Screenshots `shots/D-*`.

---

## 14.0 Decisions (owner, 2026-11-15)

1. **Visual direction: D**, C's HUD shell with B's window interiors (§ Prototype). Two shapes: shell surfaces bevelled, interiors rounded. A new default theme _Nexus HUD_ (amber `#ffb040`, focus cyan `#5ce1ff`, graphite surfaces) joins the 8 existing themes; Neon Night stays.
2. **Shell layout: keep** top bar + dock + launcher, restyled. C's side rail returns as a dock style the user picks, at any edge (§14.4 Dock style). The global app menu in the top bar stays in scope: it adds to the top bar rather than restructuring it, and it was already planned (open item 2.4, §14.4).
3. **Delivery: one release per sub-phase** (decided by Claude at the owner's request): 14.1 → `v1.0.2`; 14.2 → `v1.0.3`; 14.3 + 14.4 → `v1.1.0` (the new look ships with the shell); each app wave → `v1.1.x`; 14.6/14.7 close with the last wave. Each release runs the 13.6 audits.
4. **Prototype: done** (variant D); kept as reference until 14.3 ports its tokens.
5. **Agent skills: installed** in `.claude/skills/` (MIT, vendored with LICENSE and SOURCE.md, reviewed): `nexus-ui` (ours), `fixing-accessibility`, `fixing-motion-performance`, `review-animations`, `break-ui`, `web-design-guidelines` (its rules pinned locally instead of fetched on every run). Not installed: UI UX Pro Max (its core is a style/palette generator for picking a direction, which is settled; needs Python; its UX checklist is folded into `nexus-ui`) and Taste (generates marketing landing pages and excludes app UI).

---

## 14.1 Fix what's broken (no design decisions needed)

- [x] [P1] B1: Settings nav icons render as SVG; the label appears once. _Done: the cause was the label refresh, not `icon()`; e2e asserts one SVG + one label._
- [x] [P1] B2: the visualizer engine takes strings from the calling app (or a shared `src/ui/visualizer/i18n/`); fix every `t(key, fallback)` call; add EN/DE keys.
- [x] [P1] B3: extend `check-i18n.js` to collect literal `t('…')` / `ctx.i18n.t('…')` keys per app and fail on missing ones.
- [x] [P1] B4: Arcade Hub uses tokens only (light, Paper and High Contrast must render correctly).
- [x] [P1] B5: palette scoring ranks exact name > name prefix > name substring > keywords > description. Add unit tests.
- [x] [P1] B6: on mobile, toasts sit above the bottom nav (`bottom: calc(nav height + safe-area)`).
- [x] [P1] B7: the overview lays out strip, search and grid without overlap at 1280×720 and at 1440×900. _Done: the boxes never overlapped; the translucent backdrop let windows show through, now `--bg` at 90 %._
- [x] [P1] B8: bars have a minimum height; the pseudocode panel uses a fixed gutter. _Done: the cause was the hidden race grid taking the canvas's height._
- [x] [P1] Each fix gets a regression test (unit or e2e).

## 14.2 Measure before changing (baseline + guards)

- [x] [P1] `scripts/ux-shots.js` (Playwright, already a dev dependency): opens every app from the registry and saves screenshots for {Neon Night, Arctic Light, High Contrast} × {1440×900, 390×844} to `test-results/ux/`, plus an HTML contact sheet. Not a CI gate (pixel diffs are too flaky across engines); it is the review tool for every later step. _Done: `npm run ux:shots` (filters `--apps`, `--themes`, `--sizes`, `--no-axe`); first run 2026-11-15: 91 apps × 6 views, 0 errors._
- [x] [P1] `scripts/check-tokens.js` (in `npm run lint`): counts hard-coded colors per app CSS file against a committed baseline (`scripts/token-baseline.json`). The count may only go down: a "ratchet" that stops new debt without blocking work. _Done; baseline: 1,813 colors, 101 app-local control classes, 467 literal font sizes in 86 of 91 apps (also covers the 14.3 [P2] font-size count). Lower it with `--update`._
- [x] [P1] The same script counts app-local button/input classes, with the same ratchet.
- [x] [P1] An axe-core pass over every app in the screenshot run (`@axe-core/playwright` is already a dev dependency, used by `tests/e2e/a11y.spec.js`); serious/critical findings get listed in the contact sheet. _Done (desktop views): 68 distinct app × rule findings in 43 apps (204 across the 3 themes): unnamed `select` 87, input without label 51, unnamed button 39, scrollable region not focusable 21, list/ARIA structure 6. Fixed per app in 14.5; Wave 1–2 apps first._
- [x] [P1] A unit test that computes contrast for every theme's token pairs (text-1/2/3 on bg and surfaces, accent-contrast on accent, focus on surfaces) against rule 6. _Done: `tests/unit/theme.test.js` already covered text-1/2/3 ≥ 4.5 and accent/status ≥ 3 on all surfaces plus accent-contrast; added accent/status as text ≥ 4.5 on bg, surface-1, surface-2. `--focus` and the soft/on-soft pairs join when 14.3 adds them._

## 14.3 Design system v2 (tokens + components)

Depends on 14.0 (1) and (4).

- [x] [P1] **Tokens:** start from the variant D values in `prototypes/phase-14-ui/styles.css`: add the _Nexus HUD_ theme (default) to `themes.js`, plus `--bevel` and `--frame` (shell frame color) for every theme. Shell surfaces use `corner-shape: bevel` with the rounded fallback; check Firefox/WebKit CI screenshots for the fallback. Add the missing semantic roles so apps never need raw colors: `--surface-hover`, `--surface-active`, `--surface-sunken`, `--border-strong`, `--focus`, `--scrim`, `--accent-soft` (tinted background), `--success/warning/danger/info-soft` each with an `--*-on-soft` text color (14.2 measured accent/status text on a 16 % tint at 3.5–4.4:1 in Arctic Light and Paper, below 4.5; the theme contrast test gets these pairs), and data-viz colors `--chart-1…8` (checked for contrast in every theme). Also control sizes `--control-h-sm/md/lg`, and density (`data-density="compact|comfortable"`).
- [x] [P1] **Glow budget:** glow only on the focused window border, the primary button and the active selection. Elsewhere use `--shadow-*`. This turns the brief's "neon is an accent" into a rule.
- [x] [P1] **Components** in `src/ui/` (plain CSS classes + small DOM helpers, as today; no new framework): button (primary / secondary / ghost / danger, sm/md/lg, icon-only), segmented control, input/select/textarea, toggle, slider with value, tabs, list rows, card, badge, kbd, empty state, skeleton, toolbar, split pane, status bar. Each is documented in `docs/design-system.md` with a live gallery in the dev debug screen (`/#debug`).
- [x] [P1] **App scaffold** `createAppFrame({ toolbar, sidebar, content, inspector, status })` in `src/ui/`: standard paddings, sticky toolbar, collapsible sidebar, and a mobile layout (sidebar becomes a sheet, toolbar overflows into a menu). Generalise `tool-layout.js` into it rather than adding a second one.
- [x] [P1] **Icon grammar:** one rule for app tiles (category hue + per-app glyph; system apps on neutral), applied in dock, launcher, palette and App Center. No emoji as primary art; games get SVG cover art from shared shapes.
_14.3 done (2026-11-15): tokens derived per theme in `computeTokens()`, components in `src/ui/components.js` + `controls.css` (shared card is `.nx-panel`: Solitaire owns `.nx-card`), `createAppFrame` in `src/ui/frame/` (the frame of `tool-layout.js`), gallery in `/#debug`, catalogue in `docs/design-system.md`. Game cover art and the palette/App Center tiles move to 14.4/14.5. The type ramp tokens exist (`--text-ui/-title/-headline/-display/-hero`); app CSS moves to them in 14.5._

- [x] [P2] Typography pass: a fixed type ramp for window titles, page titles, section labels and body; no ad-hoc `font-size` in app CSS (the ratchet counts it). _Done 2026-11-15: 464 → 17 literal font sizes (left: Write/Present document typography, 8–9 px glyphs in game and visualizer cells). App text now follows the font-scale setting._

## 14.4 Shell

- [x] [P1] **First boot:** a setup wizard (open item 2.1: name, avatar, language, theme, accent, under 30 s). Then a short Welcome with **one** primary action ("Take the tour") and secondary links. One toast at a time; achievements queue behind system toasts.
- [x] [P1] **Launcher:** search-first, sized to its content, no overlap with windows behind (opaque enough even at 0 % transparency), categories as filter chips, Pinned/Recent only when non-empty and not duplicating each other.
- [x] [P1] **Palette:** ranking (14.1), one-line results (name + type badge; description only for the selected row), grouped sections (Apps, Commands, Settings, Files).
- [x] [P1] **Window chrome:** consistent titles (`App` or `Document — App`, never `~ — App`), clearer focused vs unfocused contrast, hit targets ≥ 32 px (44 px with large targets on).
- [x] [P1] **Notifications:** stacking, grouping per app, max 2 visible toasts.
- [x] [P2] **Top bar:** a richer active-app area (app name + window menu when `ctx.window.setMenu` exists, which is open item 2.4). _Done 2026-11-15: the app name opens the window menu (new window, minimize, maximize/restore, close); `ctx.window.setMenu()` adds the app's menus beside it (←/→ move between them). Write (File, Edit, View), Paint, Whiteboard and Mind Map (File) provide menus. Hidden on phones. Test: `shell.spec.js` top-bar app menu._
- [x] [P1] **Dock style** (owner, 2026-11-15): new setting _Dock style: Floating | Rail_ next to the existing `dockPosition` (bottom / left / right). Rail = variant C's side bar: flush, full-length edge bar under the top bar; launcher pinned to the far end. Windows, snapping and maximize respect the rail's width. Prototype: `?variant=D&dock=left|right|bottom&dockstyle=rail|float`, shots `D-dock-*`.
- [P2] Dock: separators and running indicators follow the icon grammar; dock folders/stacks (open item 2.6). _Indicators done in 14.3 (square dots, accent bar for the focused app); folders/stacks open._

_14.4 done (2026-11-15): setup is the Welcome window's first step on a new profile (`session.isNew` → `setup: true`), not a blocking modal, so it never traps a first-time keyboard user or the e2e suite; the default dock pins Files, Notes, Tasks, Calendar, Terminal and Settings. Toasts: at most 2 visible, one per app (merged with a count), urgent first, achievements last (`toast.test.js`). Palette: grouped sections, app tiles, one line per result with the description on the selected row; keyword/description matches need a real substring (fixes "Notes" → Arcade Hub); Enter waits for the search of what's typed. Launcher: category chips, Recent never repeats Pinned, content-sized, 97 % opaque. Dock rail: `dockStyle` setting; the dock publishes `--dock-inset-*` so the desktop, toasts and launcher keep clear. Found on the way: Nexus Present reacted to arrow keys and "F" from other windows (scoped to its window), and a window finishing loading could pull focus out of an open palette (the window manager now leaves an open `aria-modal` alone). The top-bar app menu (P2) followed later the same day._

## 14.5 App migration (waves)

Per app: move to the scaffold and components, replace raw colors with tokens, check light / HC / mobile in the screenshot sheet, rewrite the store copy (14.6), and lower the ratchet baseline. Most-used apps go first.

Per-app checklist (definition of done, from the UI UX Pro Max pre-delivery list + Vercel guidelines):

- [ ] Uses `createAppFrame` and `src/ui` components; no app-local button/input classes.
- [ ] 0 raw colors / font sizes in its CSS (or listed exceptions).
- [ ] Readable in Neon Night, Arctic Light, High Contrast at 1440×900 and 390×844 (contact sheet).
- [ ] One primary action per view; destructive actions confirm or undo.
- [ ] Keyboard: every action reachable, visible focus, Esc closes overlays, focus returns to the trigger.
- [ ] Empty, loading, error and worst-case states designed (`break-ui` data).
- [ ] Motion follows rule 8; nothing animates on keyboard navigation.
- [ ] Copy: plain EN + DE, sentence case, no raw keys (i18n check passes).
- [ ] No axe serious/critical findings.

- [P1] **Wave 1 — system:** Settings, Files, Terminal, App Center, Help, Welcome, Profile, Monitor.
  _Started 2026-11-15. Sheet run: 0 axe serious/critical findings in all 8. Fixed: Settings and App Center kept a 200-px column on phones (their narrow rules queried the element that was itself the container); Help moved onto `createAppFrame` (page list → sheet, TOC → inspector); App Center tiles follow the icon grammar; Welcome got the setup step and one primary action (14.4); Settings font sizes → tokens. Kept on purpose: Settings' list → page navigation on phones (a better phone pattern than a sheet) and Files' own toolbar/places sheet (same behavior as the frame). Open: Profile and Monitor onto the frame, Terminal tab bar on phones._
_Accessibility pass across all waves (2026-11-15): the 68 axe serious/critical findings from 14.2 are fixed; the sheet run reports 0 in all 91 apps (Nexus HUD, desktop). Icon-only buttons, selects, sliders, colour inputs and text fields got EN/DE names; scrolling regions are focusable; game boards name every square with its coordinate and state (Battleships, Checkers, Chess, Nonogram, Ultimate Tic-Tac-Toe); Editor's open-file bar is no longer a tablist. Found on the way: 8 apps (Photos, Music, Video, Recorder, Screen Recorder, Beat Lab, Camera, Synth) kept message keys with dots in their names (`"photos.all"`), which never resolve, so they showed raw keys; the files are nested now and `check-i18n.js` fails on dotted keys._

- [P1] **Wave 2 — productivity & study:** Notes, Tasks, Calendar, Journal, Flashcards, Timetable, Grades, Habits, Focus, Budget, Bookmarks, Clipboard, Clock, Calculator, Converter.
- [P1] **Wave 3 — CS Lab & dev tools:** the shared visualizer engine first (fixes all CS apps at once), then Sorting, Pathfinding, Graph Lab, Data Structures, Automata, Turing, Arch Lab, Circuits, Code, Editor, Diff, HTTP client, Playground, Snippets, Dev Tools.
- [P1] **Wave 4 — office & creative:** Write, Sheets, Present, PDF, Paint, Pixel Art, Whiteboard, Mind Map, Color Lab, Photos, Music, Video, Recorder, Screen Recorder, Camera, Synth, Beat Lab.
- [P1] **Wave 5 — Arcade:** the Hub and a shared game shell (HUD, pause, game over, high scores) on `games/engine`, then all games. Game canvases may keep their own palettes; the surrounding UI may not.
_Ratchet at target (2026-11-15): colors 1,813 → 169 (game art), app-local controls 101 → 0, font sizes 464 → 17. Toolbar buttons use `.nx-btn.is-xs` with `aria-pressed` for toggles and the current tool; specialised controls without a shared equivalent got role names (`.nx-calc-key`). Found on the way: 63 buttons in HTTP Client, Snippets, Playground, Diff, Code, Dev Tools, Color Lab and the shared diff/tool views used a class that was never defined (`nx-button`), so they rendered as bare browser buttons; HTTP Client's request editors never showed their initial text and were unstyled; Arcade's play buttons and Write's/Paint's pressed states used `--surface-1` text on the accent._
- [P1] Done when: hard-coded colors in app CSS are near 0, with exceptions listed in the baseline and justified (game sprites, color pickers); every app is readable in all 8 themes at both viewports.

## 14.6 Copy & content

- [x] [P1] App descriptions: one plain sentence per app, user benefit rather than implementation (EN + DE). Technical detail moves to Help. _Done 2026-11-15: 86 rewritten (Files, Help, Monitor, Settings, Welcome were already plain); the games' menu subtitles use the same sentence, and the Arcade hub reads names and descriptions from the manifests instead of its own English-only copies._
- [x] [P1] A voice guide in `docs/design-system.md`: sentence case, no all-caps CTAs, no marketing words ("salon", "cascades"), honest empty states. _Done: `docs/design-system.md` §3; all-caps buttons and panel titles in Arcade, Breakout, Code, Memory, Snake and Typing are sentence case now (EN + DE)._
- [P2] Help pages get a screenshot per app from the 14.2 run.

## 14.7 Motion, sound, accessibility, release

- [x] [P1] Motion tokens applied consistently (window open/close, sheets, menus); everything respects `data-motion` and reduced motion. _Done 2026-11-15: 180 literal transition durations/easings in app and shell CSS → `--dur-*` / `--ease-out` (only linear progress transitions and timers ≥ 1 s keep literals), so the Reduced animation level now applies to them; window move/minimize/close animations read the same tokens._
- [P1] Re-run the 13.6 audits: Lighthouse (no regression from mobile 99 / desktop 100), keyboard-only pass, contrast tests for the new tokens in all themes, Firefox + WebKit CI.
- [P1] Budgets hold: initial JS ≤ 200 KB gz; Lite ≤ 8 MB. The CSS reduction should shrink Lite.
- [P1] README screenshot and `docs/screenshot.png` refreshed; CHANGELOG entry; release per §14.0 (3).

## Done when

- B1–B8 are fixed with regression tests.
- The token and class ratchets are at their target, and every app uses the scaffold.
- The screenshot sheet shows all apps correct in Neon Night, Arctic Light and High Contrast at desktop and phone size.
- Audits and budgets from 13.6 still pass; CI is green on all 3 engines.
