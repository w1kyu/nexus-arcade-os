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
  await opt.click();
  const win = page.locator(`.nx-windows .nx-window[data-app="${appId}"]`);
  await expect(win).toBeVisible();
  return win;
}

test.describe('Phase 8 — CS Lab Educational Tools', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard and window flows');

  test('launches CS Lab Hub, launches tools, and inspects visualizers', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Open CS Lab Hub
    const hubWin = await openAppFromPalette(page, 'CS Lab Hub', 'nexus.cslab');
    await expect(hubWin.locator('.nx-cslab-app')).toBeVisible();
    await expect(hubWin.locator('.nx-cslab-card').first()).toBeVisible();

    // Type in search bar to filter
    const search = hubWin.locator('.nx-cslab-search-bar input');
    await search.fill('turing');
    await expect(hubWin.locator('.nx-cslab-card')).toHaveCount(1);
    await expect(hubWin.locator('.nx-cslab-card').first()).toContainText('Turing');

    // 2. Launch Turing Machine from Hub Card
    const launchTuringBtn = hubWin.locator('.nx-cslab-card button').first();
    await launchTuringBtn.click();
    const turingWin = page.locator('.nx-windows .nx-window[data-app="nexus.turing"]');
    await expect(turingWin).toBeVisible();
    await expect(turingWin.locator('.nx-turing-tape-pane')).toBeVisible();

    // 3. Open Sorting Visualizer from Palette
    const sortWin = await openAppFromPalette(page, 'Sorting', 'nexus.sorting');
    await expect(sortWin.locator('.nx-sorting-app')).toBeVisible();
    await expect(sortWin.locator('.nx-sorting-canvas-wrap canvas')).toBeVisible();
    // Regressions: the hidden race grid squeezed the canvas to ~24 px (flat bars), and the
    // shared engine showed raw keys like "engine.play".
    await expect(sortWin.locator('.nx-sorting-race-grid')).toBeHidden();
    await expect
      .poll(async () => (await sortWin.locator('.nx-sorting-canvas-wrap canvas').boundingBox())?.height ?? 0)
      .toBeGreaterThan(200);
    await expect(sortWin.locator('.nx-cs-engine-toolbar')).toContainText('Play');
    await expect(sortWin).not.toContainText('engine.');
    // Pseudocode line numbers keep one fixed column, also on long lines.
    const nums = sortWin.locator('.nx-cs-pseudo-line-num');
    const xs = await nums.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBe(1);

    // 4. Open Number & CPU Lab from Palette
    const archWin = await openAppFromPalette(page, 'Number & CPU', 'nexus.archlab');
    await expect(archWin.locator('.nx-archlab-app')).toBeVisible();
    await expect(archWin.locator('.nx-bit-strip')).toBeVisible();

    // Switch to CPU tab
    const cpuTabBtn = archWin.locator('.nx-archlab-header button', { hasText: /CPU/ }).first();
    await cpuTabBtn.click();
    await expect(archWin.locator('.nx-mem-grid')).toBeAttached();

    expect(errors).toEqual([]);
  });
});
