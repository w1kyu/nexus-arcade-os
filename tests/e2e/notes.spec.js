// Nexus Notes e2e: create notes, live preview + KaTeX math, wiki-links + backlinks,
// search/filter, and per-note password encryption.
import { expect, test } from '@playwright/test';
import { collectErrors, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

const notesWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.notes"]');
const editorContent = (/** @type {Page} */ page) => notesWin(page).locator('.nx-notes-cm-host .cm-content');
const previewPane = (/** @type {Page} */ page) => notesWin(page).locator('.nx-notes-preview-pane');

async function openNotes(/** @type {Page} */ page) {
  await page.keyboard.press('Control+k');
  await page.locator('.nx-palette-input').fill('Nexus Notes');
  const opt = page
    .locator('.nx-palette-list')
    .getByRole('option', { name: /^Nexus Notes/ })
    .first();
  await expect(opt).toBeVisible();
  await opt.click();
  await expect(notesWin(page)).toBeVisible();
}

test.describe('nexus notes', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard flows');

  test('create note, render KaTeX math & wiki links, navigate backlinks, encrypt & unlock', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await startNexus(page);
    await page.keyboard.press('Escape');
    await openNotes(page);

    // Welcome note is seeded and rendered in split mode with KaTeX MathML.
    await expect(previewPane(page).locator('math').first()).toBeVisible();

    // Create a new note and write Markdown with math and a wiki link.
    await notesWin(page).getByRole('button', { name: 'New note' }).click();
    const titleInput = notesWin(page).locator('.nx-notes-title-input');
    await titleInput.fill('Quantum Physics');
    await titleInput.press('Enter');

    await editorContent(page).click();
    await page.keyboard.type('Energy $E = \\hbar \\omega$ and see [[Experiment Log]].');

    // Live preview updates with math and missing wiki link.
    await expect(previewPane(page).locator('h1')).toHaveText('Quantum Physics');
    await expect(previewPane(page).locator('math')).toBeVisible();
    const wikiLink = previewPane(page).locator('a[data-wiki="Experiment Log"]');
    await expect(wikiLink).toBeVisible();

    // Clicking the missing wiki link creates "Experiment Log" and shows "Quantum Physics" in Backlinks.
    await wikiLink.click();
    await expect(notesWin(page).locator('.nx-notes-title-input')).toHaveValue('Experiment Log');
    await expect(notesWin(page).locator('.nx-notes-backlink-item', { hasText: 'Quantum Physics' })).toBeVisible();

    // Encrypt "Experiment Log" with a password, lock it, and unlock it again.
    await notesWin(page).getByRole('button', { name: 'Lock note with password' }).click();
    const promptDlg = page.getByRole('dialog', { name: 'Lock note with password' });
    await promptDlg.locator('input').fill('correct-horse');
    await promptDlg.getByRole('button', { name: 'OK' }).click();

    await notesWin(page).getByRole('button', { name: 'Lock now' }).click();
    await expect(notesWin(page).locator('.nx-notes-lock-screen')).toBeVisible();

    await notesWin(page).locator('.nx-notes-lock-form input[type="password"]').fill('correct-horse');
    await notesWin(page).getByRole('button', { name: 'Unlock note' }).click();
    await expect(previewPane(page).locator('h1')).toHaveText('Experiment Log');

    expect(errors).toEqual([]);
  });
});
