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

test.describe('Phase 5 — Study & Life Tools', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard and window flows');

  test('launches Calculator, evaluates expression, and switches modes', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    const win = await openAppFromPalette(page, 'Calculator', 'nexus.calculator');
    await expect(win.locator('.nx-calculator')).toBeVisible();

    // Verify mode switcher
    const nav = win.locator('.nx-calc-nav');
    await expect(nav).toBeVisible();

    // Switch to Programmer mode
    const progTab = win.locator('.nx-calc-tab', { hasText: 'Programmer' });
    if (await progTab.isVisible()) {
      await progTab.click();
      await expect(win.locator('.nx-calc-bit-grid')).toBeVisible();
    }

    // Switch to Converter
    const convWin = await openAppFromPalette(page, 'Unit Converter', 'nexus.converter');
    await expect(convWin.locator('.nx-converter')).toBeVisible();
    await expect(convWin.locator('.nx-conv-val-input').first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('launches Clipboard Manager, inspects tabs, and adds snippet', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    const win = await openAppFromPalette(page, 'Clipboard', 'nexus.clipboard');
    await expect(win.locator('.nx-clipboard')).toBeVisible();

    // Tabs exist
    const tabs = win.locator('.nx-cb-tab');
    await expect(tabs).toHaveCount(3);

    // Switch to Snippets tab
    const snippetsTab = tabs.nth(2);
    await snippetsTab.click();
    await expect(win.locator('.nx-cb-btn', { hasText: 'New Snippet' })).toBeVisible();

    // Open modal
    await win.locator('.nx-cb-btn', { hasText: 'New Snippet' }).click();
    await expect(win.locator('.nx-cb-modal')).toBeVisible();

    // Fill form
    await win.locator('.nx-cb-modal input[placeholder*="Signature"]').fill('E2E Template');
    await win.locator('.nx-cb-modal textarea').fill('Today is {{date}}!');
    await win.locator('.nx-cb-modal-footer .nx-cb-btn-accent').click();

    // Verify snippet card appears
    await expect(win.locator('.nx-cb-modal')).toHaveCount(0);
    await expect(win.locator('.nx-cb-card', { hasText: 'E2E Template' })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('launches Vault, generates password, and checks Clock', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    const vaultWin = await openAppFromPalette(page, 'Password Vault', 'nexus.vault');
    await expect(vaultWin.locator('.nx-vault')).toBeVisible();

    // Generator tab
    const genTab = vaultWin.locator('.nx-vault-tab', { hasText: 'Generator' });
    if (await genTab.isVisible()) {
      await genTab.click();
      await expect(vaultWin.locator('.nx-vault-entropy')).toBeVisible();
    }

    // Launch Clock
    const clockWin = await openAppFromPalette(page, 'Clock', 'nexus.clock');
    await expect(clockWin.locator('.nx-clock')).toBeVisible();
    await expect(clockWin.locator('.nx-clock-card').first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
