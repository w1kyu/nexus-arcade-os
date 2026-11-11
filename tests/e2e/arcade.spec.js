// @ts-check
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

async function openAppFromPalette(/** @type {Page} */ page, name, appId) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('.nx-palette-input')).toBeFocused();
  await page.locator('.nx-palette-input').fill(name);
  const opt = page
    .locator('.nx-palette-list')
    .getByRole('option', { name: new RegExp(`^${name}`) })
    .first();
  await expect(opt).toBeVisible();
  await opt.click();
  const win = page.locator(`.nx-windows .nx-window[data-app="${appId}"]`);
  await expect(win).toBeVisible();
  return win;
}

test.describe('Phase 9 — Game Engine & Arcade Hub', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard and window flows');

  test('launches Arcade Hub, filters games, and plays arcade titles', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Open Arcade Hub
    const hubWin = await openAppFromPalette(page, 'Arcade Hub', 'nexus.arcade');
    await expect(hubWin.locator('.nx-arcade-app')).toBeVisible();
    await expect(hubWin.locator('.nx-game-card').first()).toBeVisible();

    // Verify search filter in Arcade Hub
    const search = hubWin.locator('.nx-arcade-search-box input');
    await search.fill('snake');
    await expect(hubWin.locator('.nx-game-card')).toHaveCount(1);
    await expect(hubWin.locator('.nx-card-name')).toContainText('Snake Evolution');
    await search.fill('');

    // 2. Open 2048 Cyber from Palette and test sliding tiles
    const puzzleWin = await openAppFromPalette(page, '2048', 'nexus.2048');
    await expect(puzzleWin.locator('.nx-2048-app')).toBeVisible();
    await expect(puzzleWin.locator('.nx-2048-board')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');

    // Test Undo button in 2048
    const undoBtn = puzzleWin.locator('button', { hasText: 'Undo' });
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // 3. Open Memory Master and interact with cards
    const memWin = await openAppFromPalette(page, 'Memory Master', 'nexus.memory');
    await expect(memWin.locator('.nx-memory-app')).toBeVisible();
    const playMemBtn = memWin.locator('.nx-memory-play-btn');
    await playMemBtn.click();
    await expect(memWin.locator('.nx-memory-grid')).toBeVisible();
    const firstCard = memWin.locator('.nx-memory-card').first();
    await firstCard.click();
    await expect(firstCard).toHaveClass(/flipped/);

    // 4. Open Snake Evolution
    const snakeWin = await openAppFromPalette(page, 'Snake Evolution', 'nexus.snake');
    await expect(snakeWin.locator('.nx-snake-app')).toBeVisible();
    const playSnakeBtn = snakeWin.locator('.nx-snake-play-btn');
    await playSnakeBtn.click();
    await expect(snakeWin.locator('.nx-snake-canvas')).toBeVisible();

    // 5. Open Breakout Nexus
    const breakoutWin = await openAppFromPalette(page, 'Breakout Nexus', 'nexus.breakout');
    await expect(breakoutWin.locator('.nx-breakout-app')).toBeVisible();
    const campaignBtn = breakoutWin.locator('button', { hasText: /CAMPAIGN/i });
    await campaignBtn.click();
    await expect(breakoutWin.locator('.nx-breakout-canvas')).toBeVisible();

    // 6. Open Reaction Trainer
    const reactionWin = await openAppFromPalette(page, 'Reaction Trainer', 'nexus.reaction');
    await expect(reactionWin.locator('.nx-reaction-app')).toBeVisible();
    await expect(reactionWin.locator('.nx-reaction-card').first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
