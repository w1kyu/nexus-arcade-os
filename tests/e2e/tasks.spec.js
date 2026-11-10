// @ts-check
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

const tasksWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.tasks"]');

async function openTasks(/** @type {Page} */ page) {
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Tasks');
  await expect(page.getByRole('option', { name: /^Tasks/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(tasksWin(page)).toBeVisible();
}

test.describe('tasks', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard flows');

  test('quick add with natural language, complete task with undo, Kanban view, and stats', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');
    await openTasks(page);

    const win = tasksWin(page);
    await expect(win.locator('.nx-tasks')).toBeVisible();

    // Quick add with EN natural language
    const quickInput = win.locator('.nx-tasks-quickadd input.nx-input');
    await quickInput.fill('Finish OS kernel report tomorrow 14:00 !1 #Uni @deepwork every week');
    await quickInput.press('Enter');

    const row = win.locator('.nx-tasks-row', { hasText: 'Finish OS kernel report' });
    await expect(row).toBeVisible();

    // Select the task and verify inspector parsed fields
    await row.click();
    await expect(win.locator('.nx-tasks-detail')).toBeVisible();

    // Add a subtask in the inspector
    const subInput = win.locator('.nx-tasks-sublist input.nx-input').first();
    await subInput.fill('Draft architecture diagram');
    await subInput.press('Enter');
    await expect(win.locator('.nx-tasks-subitem', { hasText: 'Draft architecture diagram' })).toBeVisible();

    // Switch to Kanban view
    await win.locator('.nx-tasks-controls .nx-btn-group button').nth(1).click();
    await expect(win.locator('.nx-tasks-kanban')).toBeVisible();
    await expect(win.locator('.nx-tasks-row', { hasText: 'Finish OS kernel report' })).toBeVisible();

    // Switch to Calendar (2-week) view
    await win.locator('.nx-tasks-controls .nx-btn-group button').nth(2).click();
    await expect(win.locator('.nx-tasks-cal-grid')).toBeVisible();

    // Switch back to List view and complete a non-recurring task
    await win.locator('.nx-tasks-controls .nx-btn-group button').nth(0).click();
    await quickInput.fill('Simple one-off errand !2');
    await quickInput.press('Enter');

    const simpleRow = win.locator('.nx-tasks-row', { hasText: 'Simple one-off errand' });
    await expect(simpleRow).toBeVisible();
    await simpleRow.locator('input[type="checkbox"]').click();

    // Undo banner appears
    await expect(win.locator('.nx-tasks-undo-banner')).toBeVisible();

    // Open Statistics view
    await win.locator('.nx-tasks-nav-item', { hasText: /Statistics|Statistiken/ }).click();
    await expect(win.locator('.nx-tasks-stats')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
