# Release Process

This checklist covers preparing, verifying, tagging, and publishing a Nexus Arcade OS release.

---

## 1. Pre-Release Checklist

1. Ensure `CHANGELOG.md` has a complete, dated release section (`## [X.Y.Z] — YYYY-MM-DD — Title`).
   - Note: Nexus Arcade OS displays sections from `CHANGELOG.md` directly inside **Settings → About** and the in-app **What's New** modal on first launch after an update.
2. Update `"version"` in `package.json` and `package-lock.json`.
3. Update status and test counts in `PROGRESS.md` and `README.md`.
4. Run the full local verification gate:
   ```sh
   npm run format
   npm run typecheck
   npm run lint
   npm test
   npm run build
   npm run test:e2e
   ```
5. Verify the Nexus Lite output size printed by `npm run build:lite` stays strictly under **8.00 MB** (`dist/nexus-lite.html`).
6. Manually test `dist/nexus-lite.html` directly via `file://` in desktop browsers (Chrome, Firefox, Safari) if available.

---

## 2. Tagging & GitHub Release

Once CI passes on the release commit on `main`:

```sh
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
gh release create v1.0.0 dist/nexus-lite.html \
  --title "Nexus Arcade OS v1.0.0" \
  --notes-file CHANGELOG_RELEASE_NOTES.md
```

Wait for `render.yaml` (`autoDeployTrigger: checksPass`) to finish deploying the live site.

---

## 3. Post-Deploy Verification

Run smoke checks against the deployed URL (`NEXUS_BASE_URL`):

```sh
NEXUS_BASE_URL=https://nexus-arcade-os.onrender.com npm run test:live
```

Confirm manually on the live site:

- Fresh visit boots cleanly and installs the Service Worker.
- Reloading offline boots the full desktop and fonts cleanly.
- Returning visitors upgrading from the previous Service Worker receive the **"Update available — reload"** toast and **What's New** dialog.
- Chrome DevTools / Lighthouse scores ≥ 90 across Performance, Accessibility, Best Practices, and PWA.

---

<details>
<summary>Easter Eggs &amp; Escape Hatches (Spoilers)</summary>

1. **Konami Code (`src/shell/easter-eggs.js`):** Press `↑ ↑ ↓ ↓ ← → ← → B A` on the desktop to trigger a brief rainbow hue animation, toast notification, and the secret **Up, Up, Down, Down…** (`konami_secret`) OS achievement.
2. **Boot Safe Mode (`src/shell/boot-screen.js`):** Hold/press `Shift` during the boot screen or append `?safemode=1` to the URL to launch Nexus with installed community plugins and custom CSS disabled as an escape hatch.

</details>
