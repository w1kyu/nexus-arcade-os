// Phase 13 end-to-end journeys: interactive tour, What's new modal, sandboxed plugin
// install/run/uninstall, live Theme Editor + .nexus-theme export, and Profile & Achievements.
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus, waitForDesktop } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

async function paletteRun(/** @type {Page} */ page, /** @type {string} */ query, /** @type {RegExp} */ option) {
  await page.keyboard.press('Control+k');
  const input = page.locator('.nx-palette-input');
  await expect(input).toBeFocused();
  await input.fill(query);
  const opt = page.locator('.nx-palette-list').getByRole('option', { name: option }).first();
  await expect(opt).toBeVisible();
  await opt.click();
}

test.describe('phase 13 ecosystem & polish', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop flows');

  test('interactive tour and whats new modal', async ({ page }) => {
    const errors = collectErrors(page);
    await startNexus(page);

    // Launch interactive tour from Welcome or command palette
    await paletteRun(page, 'interactive tour', /Start interactive tour/i);
    const tour = page.getByTestId('interactive-tour');
    await expect(tour).toBeVisible();
    await expect(tour).toContainText('Step 1 of 5');

    await tour.getByTestId('tour-next').click();
    await expect(tour).toContainText('Step 2 of 5');

    await tour.getByTestId('tour-skip').click();
    await expect(tour).toHaveCount(0);

    // Open What's new modal via command palette
    await paletteRun(page, 'release notes', /release notes/i);
    const modal = page.locator('.nx-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Changelog');
    await modal.getByRole('button', { name: 'Continue' }).click();
    await expect(modal).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('installs example single-file plugin, launches sandboxed iframe, and uninstalls', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    await paletteRun(page, 'App Center', /^App Center/);
    const center = page.locator('.nx-windows [data-testid="appcenter"]');
    await expect(center).toBeVisible();

    const pluginPath = resolve(import.meta.dirname, '../../examples/plugins/markdown-wordcloud.js');
    await center.getByTestId('appcenter-plugin-input').setInputFiles(pluginPath);

    await expect(center.getByTestId('appcenter-name')).toHaveText('Markdown Word Cloud');
    await expect(center.getByTestId('permissions')).toContainText('Files');

    // Launch installed plugin inside sandboxed iframe
    await center.getByRole('button', { name: 'Open', exact: true }).click();
    const frame = page.locator('.nx-windows iframe[sandbox="allow-scripts"]');
    await expect(frame).toBeVisible();

    // Bring App Center back and uninstall the plugin permanently
    await paletteRun(page, 'App Center', /^App Center/);
    await center.getByTestId('remove-plugin').click();
    const confirmModal = page.locator('.nx-modal');
    await confirmModal.getByRole('button', { name: /Remove/i }).click();
    await expect(center.locator('[data-category="plugins"] .nx-ac-count')).toHaveText('0');

    expect(errors).toEqual([]);
  });

  test('theme editor live contrast preview, export, and profile achievements', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+Comma');
    const settingsWin = page.locator('.nx-windows [data-testid="settings"]');
    await settingsWin.locator('[data-testid="settings-nav"][data-page="themeEditor"]').click();

    await expect(settingsWin.getByTestId('theme-preview')).toBeVisible();
    await expect(settingsWin.getByTestId('theme-contrast')).toBeVisible();

    // Switch titlebar style live to macOS traffic lights
    await settingsWin
      .locator('[data-setting="system/titlebarStyle"]')
      .getByRole('radio', { name: /Traffic lights/i })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-titlebar', 'macos');

    // Generate a palette from seed color (triggers live custom theme & theme_artist achievement)
    await settingsWin.getByTestId('theme-generate').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom');

    // Export .nexus-theme file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      settingsWin.getByTestId('theme-export').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.nexus-theme$/);

    // Profile & Achievements reflects unlocked achievement & Nexus Wrapped
    await paletteRun(page, 'Profile', /Profile & Achievements/i);
    const profile = page.locator('.nx-windows .nx-profile-app');
    await expect(profile).toBeVisible();
    await expect(profile.getByTestId('profile-achievements-grid')).toContainText('Style Architect');

    await profile.getByTestId('profile-tab-wrapped').click();
    await expect(profile.getByTestId('nexus-wrapped')).toBeVisible();

    // Reload preserves macOS titlebar customization
    await page.waitForTimeout(800);
    await page.reload();
    await waitForDesktop(page);
    await expect(page.locator('html')).toHaveAttribute('data-titlebar', 'macos');

    expect(errors).toEqual([]);
  });
});
