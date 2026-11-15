// UX review sheet (phase 14.2): `npm run build && npm run ux:shots`.
// Opens every built-in app in each theme × viewport on a clean profile, saves a screenshot,
// runs axe-core on the app window, and writes test-results/ux/index.html (a contact sheet with
// the serious/critical findings per cell). A review tool, not a CI gate.
//
// Options: --apps=notes,files  --themes=nexus-hud,arctic-light  --sizes=desktop,phone  --no-axe
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';

const PORT = 4181;
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL('../', import.meta.url);
const OUT = new URL('test-results/ux/', ROOT);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const list = (/** @type {unknown} */ v, /** @type {string[]} */ all) => (typeof v === 'string' ? v.split(',') : all);

const THEMES = list(args.themes, ['nexus-hud', 'arctic-light', 'high-contrast']);
const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, isMobile: false },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true },
};
const sizeKeys = /** @type {(keyof typeof SIZES)[]} */ (list(args.sizes, Object.keys(SIZES)));

/** @typedef {{ folder: string, id: string, name: string }} App */
/** @type {App[]} */
const apps = [];
for (const folder of readdirSync(new URL('src/apps/', ROOT)).sort()) {
  if (!existsSync(new URL(`src/apps/${folder}/manifest.js`, ROOT))) continue;
  const { default: m } = await import(new URL(`src/apps/${folder}/manifest.js`, ROOT).href);
  apps.push({ folder, id: m.id, name: m.name.en });
}
const selected = typeof args.apps === 'string' ? apps.filter((a) => args.apps.split(',').includes(a.folder)) : apps;

/** @typedef {{ file?: string, error?: string, axe?: { id: string, impact: string, help: string, nodes: number }[] }} Cell */
/** @type {Record<string, Record<string, Cell>>} app folder → "theme/size" → result */
const results = {};

mkdirSync(OUT, { recursive: true });
const preview = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' });
try {
  await waitForServer();
  const browser = await chromium.launch();
  for (const size of sizeKeys) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        ...devices['Desktop Chrome'],
        ...SIZES[size],
        hasTouch: SIZES[size].isMobile,
        locale: 'en-US',
      });
      const page = await context.newPage();
      await cleanProfile(page);
      await setTheme(page, theme);
      for (const app of selected) {
        const cell = ((results[app.folder] ??= {})[`${theme}/${size}`] = {});
        try {
          await closeWindows(page);
          await openApp(page, app);
          await page.waitForTimeout(700);
          const file = `${app.folder}--${theme}--${size}.png`;
          await page.screenshot({ path: new URL(file, OUT).pathname });
          cell.file = file;
          if (!args['no-axe'] && size === 'desktop') {
            const scan = await new AxeBuilder({ page })
              .include(`.nx-windows .nx-window[data-app="${app.id}"]`)
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze();
            cell.axe = scan.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => ({ id: v.id, impact: String(v.impact), help: v.help, nodes: v.nodes.length }));
          }
        } catch (error) {
          cell.error = String(/** @type {Error} */ (error).message).split('\n')[0];
        }
        const axe = cell.axe?.length ? ` axe:${cell.axe.length}` : '';
        console.log(`${size} ${theme} ${app.folder}: ${cell.error ? `ERROR ${cell.error}` : 'ok'}${axe}`);
      }
      await context.close();
    }
  }
  await browser.close();
} finally {
  preview.kill();
}
writeSheet();

function writeSheet() {
  const cols = sizeKeys.flatMap((s) => THEMES.map((t) => `${t}/${s}`));
  const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const rows = selected
    .map((app) => {
      const cells = cols
        .map((col) => {
          const c = results[app.folder]?.[col] ?? {};
          const img = c.file ? `<a href="${c.file}"><img loading="lazy" src="${c.file}" alt=""></a>` : '';
          const err = c.error ? `<p class="err">${esc(c.error)}</p>` : '';
          const axe = c.axe?.length
            ? `<ul class="axe">${c.axe.map((v) => `<li>${v.impact}: ${esc(v.help)} (${v.id}, ${v.nodes})</li>`).join('')}</ul>`
            : c.axe
              ? '<p class="ok">axe: no serious/critical</p>'
              : '';
          return `<td>${img}${err}${axe}</td>`;
        })
        .join('');
      return `<tr><th>${esc(app.name)}<small>${app.folder}</small></th>${cells}</tr>`;
    })
    .join('\n');
  const issues = Object.values(results)
    .flatMap((r) => Object.values(r))
    .reduce((n, c) => n + (c.axe?.length ?? 0) + (c.error ? 1 : 0), 0);
  writeFileSync(
    new URL('index.html', OUT),
    `<!doctype html><meta charset="utf-8"><title>Nexus UX sheet</title>
<style>
body{font:13px system-ui,sans-serif;margin:16px;background:#111;color:#eee}
table{border-collapse:collapse}th,td{border:1px solid #333;padding:6px;vertical-align:top}
thead th{position:sticky;top:0;background:#1b1b1b}tbody th{text-align:left;min-width:140px}
th small{display:block;color:#999;font-weight:400}
img{width:260px;display:block;border-radius:4px}
.err{color:#ff7a7a}.ok{color:#7adf9a}.axe{color:#ffc46b;margin:4px 0 0;padding-left:16px;max-width:260px}
</style>
<h1>Nexus UX sheet</h1>
<p>${selected.length} apps × ${cols.length} views, ${issues} findings (axe serious/critical + errors). ${new Date().toISOString()}</p>
<table><thead><tr><th>App</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
${rows}
</tbody></table>`,
  );
  writeFileSync(new URL('results.json', OUT), JSON.stringify(results, null, 2));
  console.log(`\nSheet: ${new URL('index.html', OUT).pathname} (${issues} findings)`);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview did not start (did you run npm run build?)');
}

/** @param {import('playwright').Page} page */
async function cleanProfile(page) {
  await page.goto(`${BASE}/icons/icon.svg`);
  await page.evaluate(async () => {
    localStorage.clear();
    for (const { name } of (await indexedDB.databases?.()) ?? [])
      await new Promise((done) => {
        const request = indexedDB.deleteDatabase(/** @type {string} */ (name));
        request.onsuccess = request.onerror = request.onblocked = done;
      });
  });
  await page.goto(BASE);
  await page.waitForSelector('html[data-kernel="ready"]', { timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector('.nx-boot'), null, { timeout: 15_000 });
}

/** Picks the theme in Settings (the same path a user takes). @param {import('playwright').Page} page @param {string} theme */
async function setTheme(page, theme) {
  await closeWindows(page);
  await openApp(page, { folder: 'settings', id: 'nexus.settings', name: 'Settings' });
  await page.locator('.nx-windows [data-setting="system/theme"] select').selectOption(theme);
  await page.waitForTimeout(300);
}

/** @param {import('playwright').Page} page @param {App} app */
async function openApp(page, app) {
  await page.keyboard.press('Control+k');
  const input = page.locator('.nx-palette-input');
  await input.waitFor();
  await input.fill(app.name);
  const escaped = app.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .locator('.nx-palette-list')
    .getByRole('option', { name: new RegExp(`^${escaped}`) })
    .first()
    .click({ timeout: 5000 });
  await page.locator(`.nx-windows .nx-window[data-app="${app.id}"]`).first().waitFor({ timeout: 10_000 });
}

/** @param {import('playwright').Page} page */
async function closeWindows(page) {
  await page.keyboard.press('Escape');
  for (let i = 0; i < 8; i++) {
    const win = page.locator('.nx-windows .nx-window');
    if (!(await win.count())) return;
    await win
      .last()
      .locator('[data-action="close"]')
      .click({ timeout: 2000 })
      .catch(() => {});
    await page.waitForTimeout(200);
    // An app may ask to discard changes: take the destructive choice, it's a throwaway profile.
    await page
      .getByRole('button', { name: /discard|don.t save|close anyway/i })
      .first()
      .click({ timeout: 300 })
      .catch(() => {});
  }
}
