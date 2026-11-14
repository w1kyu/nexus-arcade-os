// @ts-check
import { expect, test } from '@playwright/test';
import { collectErrors, pressMod, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

async function openAppFromPalette(/** @type {Page} */ page, name, appId) {
  await pressMod(page, 'k');
  await expect(page.locator('.nx-palette-input')).toBeFocused();
  await page.keyboard.type(name);
  const opt = page.getByRole('option', { name: new RegExp(`^${name}`) }).first();
  await expect(opt).toBeVisible();
  await page.keyboard.press('Enter');
  const win = page.locator(`.nx-windows .nx-window[data-app="${appId}"]`);
  await expect(win).toBeVisible();
  return win;
}

test.describe('Phase 7 — Developer Tools', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard and window flows');

  test('launches Code Playground, Nexus Code, Diff Viewer and Color Laboratory', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Code Playground
    const playgroundWin = await openAppFromPalette(page, 'Code Playground', 'nexus.playground');
    await expect(playgroundWin.locator('.nx-playground-app')).toBeVisible();
    await expect(playgroundWin.locator('.nx-playground-toolbar')).toBeVisible();

    // 2. Nexus Code
    const codeWin = await openAppFromPalette(page, 'Nexus Code', 'nexus.code');
    await expect(codeWin.locator('.nx-code-app')).toBeVisible();
    await expect(codeWin.locator('.nx-code-activity-bar')).toBeVisible();

    // 3. Diff Viewer
    const diffWin = await openAppFromPalette(page, 'Diff Viewer', 'nexus.diff');
    await expect(diffWin.locator('.nx-diff-app')).toBeVisible();
    await expect(diffWin.locator('.nx-diff-viewer')).toBeVisible();

    // 4. Color Laboratory
    const colorWin = await openAppFromPalette(page, 'Color Laboratory', 'nexus.colorlab');
    await expect(colorWin.locator('.nx-colorlab-app')).toBeVisible();
    await expect(colorWin.locator('.nx-colorlab-nav')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('launches Developer Tools, HTTP Client, and Snippet Manager', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 5. Developer Tools
    const devWin = await openAppFromPalette(page, 'Developer Tools', 'nexus.devtools');
    await expect(devWin.locator('.nx-devtools-app')).toBeVisible();
    await expect(devWin.locator('.nx-devtools-sidebar')).toBeVisible();

    // 6. HTTP Client
    const httpWin = await openAppFromPalette(page, 'HTTP Client', 'nexus.httpclient');
    await expect(httpWin.locator('.nx-http-app')).toBeVisible();

    // 7. Snippet Manager
    const snippetsWin = await openAppFromPalette(page, 'Snippet Manager', 'nexus.snippets');
    await expect(snippetsWin.locator('.nx-snippets-app')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
