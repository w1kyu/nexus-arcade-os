---
name: nexus-ui
description: Nexus design rules (tokens, shell vs. window shapes, components, motion, copy) and the checks a UI change must pass. Use when building, restyling or reviewing any UI in src/ (apps, the UI around games, shell, styles, themes), or migrating an app in phase 14.
---

# Nexus UI

Direction (owner, 2026-11-15): **HUD shell, calm interior**, variant D in `prototypes/phase-14-ui/` (screenshots `shots/D-*.png`; run `npx vite prototypes/phase-14-ui`, open `?variant=D`).

- **Shell** = top bar, dock, window frame and titlebar, command palette: bevelled corners, mono uppercase titles, amber accent, glow on the focused window. Planned default theme: _Nexus HUD_ (amber `#ffb040`, focus cyan `#5ce1ff`); the other 8 themes stay.
- **Interior** = everything inside a window: solid surfaces, rounded cards, no glow, sentence case in Inter.

## Rules

1. **Tokens only.** App CSS uses role tokens (`src/styles/tokens.css`, theme values in `src/services/theme/themes.js`) for every color, size, radius, shadow and duration. Every theme defines every role. Game canvases may keep their own palettes; the UI around them follows the tokens.
2. **Two shapes.** Shell surfaces: `border-radius: var(--bevel); corner-shape: bevel` (Chromium bevels; Firefox and WebKit fall back to rounded, which is fine). Interior: `--radius-sm/md/lg`, a child's radius ≤ its parent's.
3. **Glow budget of three:** focused window frame, primary button, active selection indicator. Depth everywhere else comes from `--shadow-*` (two layers: ambient + direct).
4. **One primary action per view.** The rest are secondary or ghost. Destructive actions use the danger style and confirm or offer Undo.
5. **Targets:** pointer controls ≥ 32 px (24 px absolute floor), ≥ 44 px on mobile (`html[data-mobile]`) and with large targets on, ≥ 8 px between touch targets.
6. **Focus:** `:focus-visible` ring, 2 px `var(--focus)`, offset 2 px, fully visible (not clipped by `overflow`, not under sticky bars). Overlays trap focus, close on Esc, return focus to the trigger.
7. **Contrast** in every theme: body text ≥ 4.5:1, large text and UI parts ≥ 3:1.
8. **Type:** ramp 12 / 13 / 14 (body) / 16 / 19 / 22 / 26 / 30 px; weights 450 / 550 / 650. Mono uppercase with tracking is the shell's voice only (titlebar, top-bar app name, HUD readouts); interior labels and headings are sentence case. Compared numbers use `tabular-nums`.
9. **Motion:** `transform` and `opacity`, properties listed explicitly; ease-out `cubic-bezier(0.23, 1, 0.32, 1)`. Hover 120–150 ms, menus and popovers 150–200 ms from their trigger, windows and sheets 200–300 ms in and ~60 % of that out; entrances start at `scale(0.95)` + opacity. Keyboard-triggered actions (palette toggle, shortcuts, list navigation) switch instantly. Reduced motion keeps opacity and drops movement.
10. **Blur** lives on the top bar, dock, menus and the palette backdrop, static; Battery saver and `data-motion="off"` turn it off.
11. **States:** every view designs empty (one next action), loading (skeleton after 150–300 ms, shown ≥ 300 ms), error (cause, fix, retry) and worst-case content (long names, 1, 0, 1,000+).
12. **Copy:** EN + DE, plain user-benefit sentences, sentence case, active voice, `…` on actions that open a follow-up ("Export…") and on loading text, errors say how to fix. Window titles: `Document — App` or `App`.
13. **Icons:** the stroke set in `src/ui/icons/icons.js`, never emoji as UI. App tiles: glyph in the category hue on a dark bevelled slot; system apps neutral.

## Building blocks

Use the shared primitives over app-local classes: `src/ui/dom.js` (`h`, `icon`, `button`, `iconButton`, `toggle`) and `src/ui/controls.css` (`.nx-btn`, `.nx-icon-btn`, `.nx-input`, `.nx-select`, `.nx-textarea`, `.nx-toggle`, `.nx-slider`, `.nx-field`, `.nx-badge`, `.nx-kbd`, `.nx-empty`). Phase 14.3 adds the v2 components and `createAppFrame`; when they land, list them here.

## Checks

1. Screenshot every surface you changed in Nexus HUD (or Neon Night until it exists), Arctic Light and High Contrast, at 1440×900 and 390×844, from the production build: `npm run build && npm run ux:shots -- --apps=<folders>` writes them, with axe findings, to `test-results/ux/index.html`. Look at each one.
2. `npm run lint` includes the token ratchet; after paying off debt, lower it with `node scripts/check-tokens.js --update`.
3. App migrations: tick the per-app checklist in `specs/14-ui-ux-rework.md` §14.5.
4. Specialist passes, all project skills:
   - controls, dialogs, forms → `fixing-accessibility`
   - any motion → `fixing-motion-performance`, then `/review-animations`
   - lists and data-driven views → `break-ui`
   - full audit of a file set → `web-design-guidelines <files>`

   They assume React/Tailwind in places; translate to vanilla JS + CSS custom properties. Where one disagrees with this file (Title Case, for one), this file wins.

The work is done when every changed surface passes rules 1–13 in all three themes at both sizes.
