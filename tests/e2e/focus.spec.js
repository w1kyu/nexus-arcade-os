// @ts-check
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

const focusWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.focus"]');

async function openFocus(/** @type {Page} */ page) {
  await page.keyboard.press('Control+k');
  await page.locator('.nx-palette-input').fill('Focus');
  const opt = page
    .locator('.nx-palette-list')
    .getByRole('option', { name: /^Focus/ })
    .first();
  await expect(opt).toBeVisible();
  await opt.click();
  await expect(focusWin(page)).toBeVisible();
}

test.describe('focus', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard flows');

  test('Pomodoro timer, ambient sound mixer, distraction blocker override, and statistics', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');
    await openFocus(page);

    const win = focusWin(page);
    await expect(win.locator('.nx-focus')).toBeVisible();
    await expect(win.locator('.nx-focus-digits')).toHaveText('25:00');

    // Enable blocking App Center in Distraction Blocker tab
    await win.locator('.nx-focus-tabs button').nth(2).click();
    await win.locator('.nx-focus-row', { hasText: 'App Center' }).locator('input[type="checkbox"]').check();

    // Switch to Ambient Sounds tab and activate Rainy Study preset
    await win.locator('.nx-focus-tabs button').nth(1).click();
    await win.getByRole('button', { name: /Rainy Study|Regnerisches Lernen/ }).click();
    await expect(win.locator('.nx-focus-channel[data-channel="rain"]')).toHaveClass(/is-active/);
    await win.getByRole('button', { name: /Silence all|Alle stummschalten/ }).click();

    // Switch back to Timer tab and start work session
    await win.locator('.nx-focus-tabs button').nth(0).click();
    await win
      .locator('.nx-focus-controls')
      .getByRole('button', { name: /Start|Starten/ })
      .click();

    // Open App Center while Focus work session is active -> distraction blocker overlay appears
    await page.keyboard.press('Control+k');
    await page.keyboard.type('App Center');
    await expect(page.getByRole('option', { name: /^App Center/ }).first()).toBeVisible();
    await page.keyboard.press('Enter');

    const appCenterWin = page.locator('.nx-windows .nx-window[data-app="nexus.appcenter"]');
    await expect(appCenterWin.locator('.nx-focus-block-overlay')).toBeVisible();

    // Click "I really need it" override button -> overlay disappears and override is logged
    await appCenterWin.locator('.nx-focus-override-btn').click();
    await expect(appCenterWin.locator('.nx-focus-block-overlay')).toBeHidden();

    // Close App Center so Focus window is in front again
    await appCenterWin.locator('[data-action="close"]').click();
    await expect(appCenterWin).toBeHidden();

    // Complete the work phase and check Statistics tab
    await win
      .locator('.nx-focus-controls')
      .getByRole('button', { name: /Finish|Abschließen/ })
      .click();
    await win.locator('.nx-focus-tabs button').nth(3).click();
    await expect(win.locator('.nx-focus-stats')).toBeVisible();
    await expect(win.locator('.nx-focus-stat-val', { hasText: '25m' })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
