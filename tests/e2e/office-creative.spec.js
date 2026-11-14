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

test.describe('Phase 6 — Office & Creative Apps', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard and window flows');

  test('launches Sheets, Write, Whiteboard and Mind Map', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Nexus Sheets
    const sheetsWin = await openAppFromPalette(page, 'Nexus Sheets', 'nexus.sheets');
    await expect(sheetsWin.locator('.nx-sheets')).toBeVisible();
    await expect(sheetsWin.locator('.nx-sheets-formula-input')).toBeVisible();

    // 2. Nexus Write
    const writeWin = await openAppFromPalette(page, 'Nexus Write', 'nexus.write');
    await expect(writeWin.locator('.nx-write')).toBeVisible();
    await expect(writeWin.locator('.nx-write-page')).toBeVisible();

    // 3. Nexus Whiteboard
    const wbWin = await openAppFromPalette(page, 'Nexus Whiteboard', 'nexus.whiteboard');
    await expect(wbWin.locator('.nx-whiteboard')).toBeVisible();
    await expect(wbWin.locator('.nx-whiteboard-canvas')).toBeVisible();

    // 4. Nexus Mind Map
    const mmWin = await openAppFromPalette(page, 'Nexus Mind Map', 'nexus.mindmap');
    await expect(mmWin.locator('.nx-mindmap')).toBeVisible();
    await expect(mmWin.locator('.nx-mindmap-canvas')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('launches Paint, Pixel Art Studio, Present, and PDF Tools', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 5. Nexus Paint
    const paintWin = await openAppFromPalette(page, 'Nexus Paint', 'nexus.paint');
    await expect(paintWin.locator('.nx-paint')).toBeVisible();
    await expect(paintWin.locator('.nx-paint-layer-canvas')).toBeVisible();

    // 6. Pixel Art Studio
    const pixelWin = await openAppFromPalette(page, 'Pixel Art Studio', 'nexus.pixelart');
    await expect(pixelWin.locator('.nx-pixelart')).toBeVisible();
    await expect(pixelWin.locator('.nx-pixelart-canvas')).toBeVisible();
    await expect(pixelWin.locator('.nx-pixelart-frames-tray')).toBeVisible();

    // 7. Nexus Present
    const presentWin = await openAppFromPalette(page, 'Nexus Present', 'nexus.present');
    await expect(presentWin.locator('.nx-present')).toBeVisible();
    await expect(presentWin.locator('.nx-present-slide-frame')).toBeVisible();

    // 8. PDF Tools
    const pdfWin = await openAppFromPalette(page, 'PDF Tools', 'nexus.pdf');
    await expect(pdfWin.locator('.nx-pdf')).toBeVisible();
    await expect(pdfWin.locator('.nx-pdf-combiner-view')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
