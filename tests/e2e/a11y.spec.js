// Automated WCAG 2.0 / 2.1 AA accessibility checks via @axe-core/playwright across shell & core apps.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

async function openAppViaPalette(/** @type {Page} */ page, /** @type {string} */ query, /** @type {RegExp} */ option) {
  await page.keyboard.press('Control+k');
  const input = page.locator('.nx-palette-input');
  await expect(input).toBeVisible();
  await input.focus();
  await input.fill(query);
  const opt = page.locator('.nx-palette-list').getByRole('option', { name: option }).first();
  await expect(opt).toBeVisible();
  await opt.click();
}

/**
 * Runs axe-core WCAG 2.0/2.1 AA scan and fails if any serious or critical violations exist.
 * @param {Page} page
 * @param {string} label
 */
async function expectNoSeriousViolations(page, label) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const severe = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const formatted = severe.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes: ${v.nodes
        .slice(0, 2)
        .map((n) => n.target.join(' '))
        .join(', ')})`,
  );
  expect(formatted, `Axe WCAG AA violations on "${label}"`).toEqual([]);
}

test.describe('accessibility (axe-core WCAG AA)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop viewport scan');

  test('shell and core apps pass axe-core serious/critical WCAG 2.1 AA checks', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await startNexus(page);

    // 1. Desktop shell + Welcome app
    await expectNoSeriousViolations(page, 'desktop + welcome');

    // Close Welcome window cleanly before scanning individual apps
    await page.keyboard.press('Escape');
    const closeTop = async () => {
      const btn = page.locator('.nx-window.is-focused [data-action="close"]');
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(150);
      }
    };
    await closeTop();

    // 2. Settings + Theme Editor + Backup tabs
    await page.keyboard.press('Control+Comma');
    const settingsWin = page.locator('.nx-windows [data-testid="settings"]');
    await expect(settingsWin).toBeVisible();
    await expectNoSeriousViolations(page, 'settings general');

    await settingsWin.locator('[data-testid="settings-nav"][data-page="themeEditor"]').click();
    await expect(settingsWin.getByTestId('theme-contrast')).toBeVisible();
    await expectNoSeriousViolations(page, 'settings theme editor');

    await settingsWin.locator('[data-testid="settings-nav"][data-page="backup"]').click();
    await expectNoSeriousViolations(page, 'settings backup');
    await closeTop();

    // 3. Profile & Achievements
    await openAppViaPalette(page, 'Profile', /Profile & Achievements/i);
    await expect(page.locator('.nx-windows .nx-profile-app')).toBeVisible();
    await expectNoSeriousViolations(page, 'profile & achievements');
    await closeTop();

    // 4. App Center
    await openAppViaPalette(page, 'App Center', /^App Center/);
    await expect(page.locator('.nx-windows [data-testid="appcenter"]')).toBeVisible();
    await expectNoSeriousViolations(page, 'app center');
    await closeTop();

    // 5. Files
    await openAppViaPalette(page, 'File Explorer', /^File Explorer/);
    await expect(page.locator('.nx-windows [data-testid="files"]')).toBeVisible();
    await expectNoSeriousViolations(page, 'file explorer');
    await closeTop();

    // 6. Notes
    await openAppViaPalette(page, 'Nexus Notes', /^Nexus Notes/);
    await expect(page.locator('.nx-windows .nx-notes')).toBeVisible();
    await expectNoSeriousViolations(page, 'notes');
    await closeTop();

    // 7. Arcade
    await openAppViaPalette(page, 'Arcade', /^Arcade Hub/);
    await expect(page.locator('.nx-windows .nx-arcade-app')).toBeVisible();
    await expectNoSeriousViolations(page, 'arcade hub');
    await closeTop();

    // 8. Help
    await page.keyboard.press('F1');
    await expect(page.locator('.nx-windows [data-testid="help"]')).toBeVisible();
    await expectNoSeriousViolations(page, 'help');

    expect(errors).toEqual([]);
  });
});
