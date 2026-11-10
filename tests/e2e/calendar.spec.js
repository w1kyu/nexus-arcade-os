// @ts-check
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

const calWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.calendar"]');

async function openCalendar(/** @type {Page} */ page) {
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Calendar');
  await expect(page.getByRole('option', { name: /^Calendar/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(calWin(page)).toBeVisible();
}

test.describe('calendar', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard flows');

  test('switch views, quick-add event, edit in inspector, and verify overlays', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');
    await openCalendar(page);

    const win = calWin(page);
    await expect(win.locator('.nx-cal')).toBeVisible();
    await expect(win.locator('.nx-cal-timegrid-wrap')).toBeVisible();

    // Quick add an event on today
    const quickInput = win.locator('.nx-cal-quick-input');
    await quickInput.fill('Architecture Review today 13:00-14:00 @Room 302');
    await quickInput.press('Enter');

    // Inspector opens automatically for the new event
    await expect(win.locator('.nx-cal-inspector')).toBeVisible();
    await expect(win.locator('.nx-cal-timed-event', { hasText: 'Architecture Review' })).toBeVisible();

    // Save changes in inspector
    await win
      .locator('.nx-cal-inspector')
      .getByRole('button', { name: /Save|Speichern/ })
      .click();
    await expect(win.locator('.nx-cal-inspector')).toBeHidden();

    // Switch to Month view
    await win.locator('.nx-cal-toolbar .nx-btn-group button').nth(2).click();
    await expect(win.locator('.nx-cal-month-grid')).toBeVisible();
    await expect(win.locator('.nx-cal-pill', { hasText: 'Architecture Review' })).toBeVisible();

    // Switch to Day view
    await win.locator('.nx-cal-toolbar .nx-btn-group button').nth(0).click();
    await expect(win.locator('.nx-cal-timegrid-wrap')).toBeVisible();

    // Switch to Year view
    await win.locator('.nx-cal-toolbar .nx-btn-group button').nth(3).click();
    await expect(win.locator('.nx-cal-year-grid')).toBeVisible();

    // Switch to Agenda view
    await win.locator('.nx-cal-toolbar .nx-btn-group button').nth(4).click();
    await expect(win.locator('.nx-cal-agenda')).toBeVisible();
    await expect(win.locator('.nx-cal-agenda-row', { hasText: 'Architecture Review' })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
