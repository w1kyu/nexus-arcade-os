// @ts-check
import { expect, test } from '@playwright/test';
import { collectErrors, pressMod, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

async function openAppFromPalette(/** @type {Page} */ page, name, appId) {
  await pressMod(page, 'k');
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

  test('launches and plays Phase 10 Tier 1 games (Blockfall, Minesweeper, Drifter, Sudoku, Typing, Pong)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Blockfall
    const blockfallWin = await openAppFromPalette(page, 'Blockfall', 'nexus.blockfall');
    await expect(blockfallWin.locator('.nx-blockfall-app')).toBeVisible();
    await blockfallWin.locator('.nx-blockfall-play-btn').click();
    await expect(blockfallWin.locator('.nx-blockfall-canvas')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    // 2. Minesweeper
    const minesWin = await openAppFromPalette(page, 'Minesweeper', 'nexus.minesweeper');
    await expect(minesWin.locator('.nx-minesweeper-app')).toBeVisible();
    const cell = minesWin.locator('.nx-minesweeper-cell[data-row="4"][data-col="4"]');
    await cell.click();
    await expect(cell).toHaveClass(/revealed/);

    // 3. Void Drifter
    const drifterWin = await openAppFromPalette(page, 'Void Drifter', 'nexus.drifter');
    await expect(drifterWin.locator('.nx-drifter-app')).toBeVisible();
    await drifterWin.locator('.nx-drifter-play-btn').click();
    await expect(drifterWin.locator('.nx-drifter-canvas')).toBeVisible();
    await page.keyboard.press('ArrowUp');

    // 4. Sudoku
    const sudokuWin = await openAppFromPalette(page, 'Sudoku', 'nexus.sudoku');
    await expect(sudokuWin.locator('.nx-sudoku-app')).toBeVisible();
    await expect(sudokuWin.locator('.nx-sudoku-board')).toBeVisible();
    const sCell = sudokuWin.locator('.nx-sudoku-cell[data-row="0"][data-col="0"]');
    await sCell.click();
    await expect(sCell).toHaveClass(/selected/);

    // 5. Typing Trainer
    const typingWin = await openAppFromPalette(page, 'Typing Trainer', 'nexus.typing');
    await expect(typingWin.locator('.nx-typing-app')).toBeVisible();
    await expect(typingWin.locator('.nx-typing-keyboard')).toBeVisible();
    await typingWin.locator('.nx-typing-text-wrap').click();
    await page.keyboard.type('a');

    // 6. Neon Pong
    const pongWin = await openAppFromPalette(page, 'Neon Pong', 'nexus.pong');
    await expect(pongWin.locator('.nx-pong-app')).toBeVisible();
    await pongWin.locator('.nx-pong-play-btn').click();
    await expect(pongWin.locator('.nx-pong-canvas')).toBeVisible();
    await page.keyboard.press('KeyW');

    expect(errors).toEqual([]);
  });

  test('launches and plays Phase 10 Tier 2 games and verifies Arcade Hub multiplayer lobby', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Open Arcade Hub and check Cards & Board category filter tabs
    const hubWin = await openAppFromPalette(page, 'Arcade Hub', 'nexus.arcade');
    await expect(hubWin.locator('.nx-arcade-app')).toBeVisible();

    const cardsTab = hubWin.locator('.nx-filter-btn', { hasText: 'Cards' });
    await expect(cardsTab).toBeVisible();
    await cardsTab.click();
    await expect(hubWin.locator('.nx-game-card')).toHaveCount(1);
    await expect(hubWin.locator('.nx-card-name')).toContainText('Solitaire Collection');

    const boardTab = hubWin.locator('.nx-filter-btn', { hasText: 'Board' });
    await expect(boardTab).toBeVisible();
    await boardTab.click();
    await expect(hubWin.locator('.nx-game-card')).toHaveCount(5);

    // Test Local 2-Player Lobby Modal
    const lobbyBtn = hubWin.locator('.nx-lobby-btn');
    await expect(lobbyBtn).toBeVisible();
    await lobbyBtn.click();
    const lobbyModal = hubWin.locator('.nx-lobby-modal');
    await expect(lobbyModal).toBeVisible();
    // Close lobby modal
    await lobbyModal.locator('.nx-lobby-close-btn').click();
    await expect(lobbyModal).not.toBeVisible();

    // 2. Solitaire Collection
    const solWin = await openAppFromPalette(page, 'Solitaire Collection', 'nexus.solitaire');
    await expect(solWin.locator('.nx-solitaire')).toBeVisible();
    await expect(solWin.locator('.nx-sol-table')).toBeVisible();

    // 3. Nexus Chess
    const chessWin = await openAppFromPalette(page, 'Nexus Chess', 'nexus.chess');
    await expect(chessWin.locator('.nx-chess')).toBeVisible();
    await expect(chessWin.locator('.nx-chess-board')).toBeVisible();

    // 4. Connect Four
    const c4Win = await openAppFromPalette(page, 'Connect Four', 'nexus.connectfour');
    await expect(c4Win.locator('.nx-c4')).toBeVisible();
    await expect(c4Win.locator('.nx-c4-col').first()).toBeVisible();

    // 5. Checkers
    const ckWin = await openAppFromPalette(page, 'Checkers', 'nexus.checkers');
    await expect(ckWin.locator('.nx-ck')).toBeVisible();
    await expect(ckWin.locator('.nx-ck-board')).toBeVisible();

    // 6. Battleships
    const bsWin = await openAppFromPalette(page, 'Battleships', 'nexus.battleships');
    await expect(bsWin.locator('.nx-battleships')).toBeVisible();
    await expect(bsWin.locator('.nx-bs-grid.player')).toBeVisible();

    // 7. Hexword
    const hwWin = await openAppFromPalette(page, 'Hexword', 'nexus.hexword');
    await expect(hwWin.locator('.nx-hexword')).toBeVisible();
    await expect(hwWin.locator('.nx-hw-grid')).toBeVisible();

    // 8. Block Pusher (Sokoban)
    const skWin = await openAppFromPalette(page, 'Block Pusher', 'nexus.sokoban');
    await expect(skWin.locator('.nx-sokoban')).toBeVisible();
    await expect(skWin.locator('.nx-sk-stage')).toBeVisible();

    // 9. Nonogram
    const ngWin = await openAppFromPalette(page, 'Nonogram', 'nexus.nonogram');
    await expect(ngWin.locator('.nx-nonogram')).toBeVisible();
    await expect(ngWin.locator('.nx-ng-board')).toBeVisible();

    // 10. Grid Invaders
    const invWin = await openAppFromPalette(page, 'Grid Invaders', 'nexus.invaders');
    await expect(invWin.locator('.nx-invaders')).toBeVisible();
    await expect(invWin.locator('.nx-invaders-canvas')).toBeVisible();

    // 11. Neon Glide
    const glideWin = await openAppFromPalette(page, 'Neon Glide', 'nexus.glide');
    await expect(glideWin.locator('.nx-glide')).toBeVisible();
    await expect(glideWin.locator('.nx-glide-canvas')).toBeVisible();

    expect(errors).toEqual([]);
  });
  test('launches and plays Phase 10 Tier 3 games and verifies Arcade Hub categories', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Verify Arcade Hub has the new games and categories
    const hubWin = await openAppFromPalette(page, 'Arcade Hub', 'nexus.arcade');
    await expect(hubWin.locator('.nx-arcade-app')).toBeVisible();
    await expect(hubWin.locator('.nx-game-card').first()).toBeVisible();

    const search = hubWin.locator('.nx-arcade-search-box input');
    await search.fill('defense');
    await expect(hubWin.locator('.nx-game-card')).toHaveCount(1);
    await expect(hubWin.locator('.nx-card-name')).toContainText('Grid Defense');
    await search.fill('');

    // 2. Grid Defense
    const gdWin = await openAppFromPalette(page, 'Grid Defense', 'nexus.griddefense');
    await expect(gdWin.locator('.nx-gd')).toBeVisible();
    await expect(gdWin.locator('canvas')).toBeVisible();

    // 3. Pixel Runner
    const runnerWin = await openAppFromPalette(page, 'Pixel Runner', 'nexus.runner');
    await expect(runnerWin.locator('.nx-runner')).toBeVisible();
    await expect(runnerWin.locator('.nx-runner-canvas')).toBeVisible();

    // 4. Neon Racer
    const racerWin = await openAppFromPalette(page, 'Neon Racer', 'nexus.racer');
    await expect(racerWin.locator('.nx-racer')).toBeVisible();
    await expect(racerWin.locator('.nx-racer-canvas')).toBeVisible();

    // 5. Ultimate Tic-Tac-Toe
    const utttWin = await openAppFromPalette(page, 'Ultimate Tic-Tac-Toe', 'nexus.uttt');
    await expect(utttWin.locator('.nx-uttt')).toBeVisible();
    await expect(utttWin.locator('.nx-uttt-macro-grid')).toBeVisible();

    // 6. Mahjong Solitaire
    const mahjongWin = await openAppFromPalette(page, 'Mahjong Solitaire', 'nexus.mahjong');
    await expect(mahjongWin.locator('.nx-mahjong')).toBeVisible();
    await expect(mahjongWin.locator('.nx-mahjong-board')).toBeVisible();

    // 7. Match-3 Puzzle
    const match3Win = await openAppFromPalette(page, 'Match-3 Puzzle', 'nexus.match3');
    await expect(match3Win.locator('.nx-match3')).toBeVisible();
    await expect(match3Win.locator('.nx-match3-grid')).toBeVisible();

    // 8. Bubble Shooter
    const bubblesWin = await openAppFromPalette(page, 'Bubble Shooter', 'nexus.bubbles');
    await expect(bubblesWin.locator('.nx-bubbles')).toBeVisible();
    await expect(bubblesWin.locator('.nx-bubbles-canvas')).toBeVisible();

    // 9. Game of Life Sandbox
    const lifeWin = await openAppFromPalette(page, 'Game of Life', 'nexus.life');
    await expect(lifeWin.locator('.nx-life')).toBeVisible();
    await expect(lifeWin.locator('.nx-life-canvas')).toBeVisible();

    // 10. Quiz Arena
    const quizWin = await openAppFromPalette(page, 'Quiz Arena', 'nexus.quiz');
    await expect(quizWin.locator('.nx-quiz')).toBeVisible();
    await expect(quizWin.locator('.nx-quiz-hud')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
