# Design System

Nexus Arcade OS uses a framework-free CSS Custom Property token architecture (`src/styles/tokens.css`, `src/styles/base.css`) paired with lightweight vanilla DOM primitives in `src/ui/`.

---

## 1. Design Tokens (`src/styles/tokens.css`)

All themes override the color palette and glow intensity while preserving spacing, radii, typography, z-layers, and motion curves:

### Colors & Surfaces

| Token                                          | Role                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--bg`                                         | Desktop & root canvas background                                                                       |
| `--surface-1`, `--surface-2`, `--surface-3`    | Layered panel, card, and elevated control surfaces                                                     |
| `--glass`                                      | Translucent frosted overlay background (paired with `--blur-glass`)                                    |
| `--border`                                     | Subtle borders & dividers                                                                              |
| `--text-1`, `--text-2`, `--text-3`             | Primary, secondary, and muted text hierarchy                                                           |
| `--accent`, `--accent-2`, `--accent-contrast`  | Primary interactive highlight, secondary gradient/highlight, and accessible text color over `--accent` |
| `--success`, `--warning`, `--danger`, `--info` | Semantic status colors                                                                                 |

### Spacing, Radii, Typography & Z-Layers

- **Spacing:** `--space-1` (`4px`) through `--space-7` (`48px`).
- **Radii:** `--radius-sm` (`6px`), `--radius-md` (`10px`), `--radius-lg` (`16px`), `--radius-full` (`999px`) — dynamically scaled by the user's Window Corner Radius setting.
- **Fonts:** Self-hosted variable fonts in `src/styles/fonts/` (SIL OFL 1.1):
  - `--font-sans`: `'Inter Variable', system-ui, sans-serif` (configurable in Theme Editor)
  - `--font-mono`: `'JetBrains Mono Variable', ui-monospace, monospace`
  - Scale multiplier `--font-scale` (`0.85`–`1.5`) driving `--text-xs` through `--text-2xl`.
- **Z-Layers:** `--z-desktop` (`0`), `--z-windows` (`100`), `--z-dock` (`1000`), `--z-overlay` (`2000`), `--z-toast` (`3000`).

---

## 2. Themes & Live Personalization

- **8 Built-in Themes (`src/services/theme/themes.js`):** Neon Night, Synthwave, Matrix, Blade, Deep Ocean, Arctic Light, Paper, High Contrast — all unit-tested (`tests/unit/theme.test.js`) for WCAG AA contrast.
- **Auto Scheme:** Follows `prefers-color-scheme` when set to Auto.
- **Theme Editor (`Settings → Theme Editor`):**
  - Edit every color token live with instant preview across sample windows, buttons, and charts.
  - Real-time **WCAG AA / AAA contrast warnings** (`text1` on `bg`, `text1` on `surface1`, `accentContrast` on `accent`, etc.).
  - Generate themes from the current **wallpaper's dominant colors** (`src/ui/color-extract.js`) or export directly from **Color Lab**.
  - Import and export `.nexus-theme` JSON files (`parseCustomThemeJson`).
  - Customize **Titlebar Style** (`data-titlebar="windows"` right-aligned controls vs `data-titlebar="macos"` left traffic lights), **Icon Style** (`outline` vs `filled`), corner radius, and font family.
  - Export/import full **Profile Cards** (theme, wallpaper, dock, widget layout).

---

## 3. Accessibility Attributes (`:root`)

Controlled by Settings and enforced in [`src/styles/base.css`](../src/styles/base.css):

- `data-focus-ring="strong"`: High-visibility double-ring `:focus-visible` indicator (`3px solid var(--text-1)` + `6px` `--accent` halo).
- `data-large-targets="true"`: Enforces `min-height: 44px` on `.nx-btn`, `.nx-icon-btn`, `[role="menuitem"]`, `[role="option"]`, and `[role="tab"]` (WCAG 2.5.5).
- `data-motion="off"` (and `@media (prefers-reduced-motion: reduce)`): Zeroes animation and transition durations across the OS.

---

## 4. Shared UI Primitives (`src/ui/`)

Apps and shell surfaces reuse these zero-dependency building blocks:

| Module                                           | Purpose                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [`dom.js`](../src/ui/dom.js)                     | `h(tag, props, ...children)`, `replace()`, `icon(name, opts)`, `focusedElement()` (shadow-DOM aware) |
| [`controls.css`](../src/ui/controls.css)         | Standard `.nx-btn`, `.nx-input`, `.nx-card`, `.nx-badge`, `.nx-tabs` classes                         |
| [`overlay.js`](../src/ui/overlay.js)             | Accessible modal/popover controller with focus trapping, `Escape` handling, and focus restoration    |
| [`menu.js`](../src/ui/menu.js)                   | Keyboard-navigable context menus and dropdowns                                                       |
| [`tool-layout.js`](../src/ui/tool-layout.js)     | Shared split/workbench layout (`createToolLayout`) used across Developer Toolkit & CS apps           |
| [`markdown.js`](../src/ui/markdown.js)           | Sanitized Markdown + syntax highlight + KaTeX MathML renderer                                        |
| [`diff.js`](../src/ui/diff.js)                   | LCS side-by-side and unified diff viewer (`createDiffViewer`)                                        |
| [`qr.js`](../src/ui/qr.js)                       | Zero-dependency SVG QR code generator used in DevTools and Device-to-Device transfer                 |
| [`color-extract.js`](../src/ui/color-extract.js) | Dominant palette extractor from images & gradients                                                   |

### Component Usage Example

```js
import { h, icon, replace } from '../../ui/dom.js';
import { showMenu } from '../../ui/menu.js';

const button = h(
  'button',
  {
    type: 'button',
    class: 'nx-btn is-primary',
    onclick: (ev) => showMenu(ev.currentTarget, [{ label: 'Export', run: exportData }]),
  },
  icon('download', { size: 16 }),
  'Save',
);
replace(container, button);
```
