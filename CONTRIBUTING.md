# Contributing to Nexus Arcade OS

Thank you for contributing to **Nexus Arcade OS**! Everything here is pure client-side ES2022 JavaScript with zero required backend services, offline-first storage, and strict app isolation.

---

## Development Setup

Requires Node **24 LTS** (see `.nvmrc`).

```sh
git clone https://github.com/w1kyu/nexus-arcade-os.git
cd nexus-arcade-os
npm install
npx playwright install chromium   # once, for E2E tests
npm run dev                       # start local dev server
```

---

## Project Conventions

1. **No UI Frameworks:** Use vanilla ES2022 JavaScript, CSS custom properties (`src/styles/tokens.css`), and shared helpers in `src/ui/`.
2. **Respect App Boundaries:** Apps (`src/apps/<name>/`) and games (`src/games/<name>/`) may only import their own files, `src/ui/`, `src/styles/` (and `src/games/engine/` for games). All OS interactions go through `ctx`. This is enforced by ESLint.
3. **Zero Unrequested Network Calls:** Never add analytics, telemetry, remote fonts, or external asset URLs.
4. **Bilingual i18n (EN & DE):** Keep `i18n/en.json` and `i18n/de.json` in complete key parity. Run `node scripts/check-i18n.js` (included in `npm run lint`).
5. **Accessibility First:** Include proper `aria-label` / roles, keyboard navigation (`Escape`, focus management), and respect `data-focus-ring="strong"`, `data-large-targets="true"`, and `data-motion="off"`.
6. **JSDoc Types:** Keep `@ts-check` clean across `src/kernel/`, `src/services/`, and shared UI modules.

---

## Before Opening a Pull Request

Run the complete local verification suite:

```sh
npm run format      # Format with Prettier
npm run typecheck   # Verify JSDoc types with TypeScript
npm run lint        # ESLint + Prettier check + EN/DE i18n key parity
npm test            # Run Vitest unit & migration suite
npm run build       # Build PWA + verify dist/nexus-lite.html <= 8.00 MB
npm run test:e2e    # Run Playwright E2E + axe-core WCAG AA checks
```

---

## Adding a Built-In App vs. Writing a Plugin

- Building a third-party extension? Follow [the Plugin SDK Guide](docs/plugin-sdk.md) to build sandboxed `.nexus-plugin` packages or single-file `.js` plugins without touching the core repo.
- Adding or improving a built-in app? Review [the App API Reference](docs/app-api.md), [Architecture](docs/architecture.md), and [Design System](docs/design-system.md).

---

## Reporting Bugs & Suggesting Features

Please use the templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/bug_report.md) when opening issues.
