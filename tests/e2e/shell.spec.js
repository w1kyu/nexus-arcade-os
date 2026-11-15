// Phase 2 "done when": the shell works entirely with the keyboard, with the mouse and with touch,
// and everything is restored after a reload.
import { expect, test } from '@playwright/test';
import { collectErrors, pressMod, startNexus, waitForDesktop } from '../helpers/nexus.js';

const windows = (/** @type {import('@playwright/test').Page} */ page) => page.locator('.nx-windows .nx-window');
const appBar = (/** @type {import('@playwright/test').Page} */ page) =>
  page.getByRole('navigation', { name: 'App bar' });
const welcome = (/** @type {import('@playwright/test').Page} */ page) =>
  page.getByRole('dialog', { name: /Welcome|Willkommen/ });

/** Session saves are debounced; give them time before reloading. */
async function reloadDesktop(/** @type {import('@playwright/test').Page} */ page) {
  await page.waitForTimeout(1200);
  await page.reload();
  await waitForDesktop(page);
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop flows');

  test('keyboard only: palette, snapping, workspaces, launcher, theme; restored after reload', async ({ page }) => {
    const errors = collectErrors(page);
    await startNexus(page);
    await expect(welcome(page)).toBeFocused();

    // Snap the Welcome window to the left half.
    await pressMod(page, 'ArrowLeft');
    await expect(windows(page).first()).toHaveClass(/is-snapped/);

    // A second window from the command palette, snapped right.
    await pressMod(page, 'k');
    await expect(page.locator('.nx-palette-input')).toBeFocused();
    await page.keyboard.type('Welcome');
    await expect(page.getByRole('option', { name: /Welcome/ }).first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(windows(page)).toHaveCount(2);
    await pressMod(page, 'ArrowRight');
    await expect(windows(page).nth(1)).toHaveClass(/is-snapped/);

    // Move it to workspace 2 (the view follows the window).
    await pressMod(page, 'Shift+ArrowRight');
    await expect(page.locator('.nx-workspace.is-current')).toHaveAttribute('data-index', '1');
    await expect(page.locator('.nx-workspace.is-current .nx-window')).toHaveCount(1);

    // Launcher and shortcut overlay open and close with the keyboard.
    await pressMod(page, 'Space');
    await expect(page.locator('.nx-launcher-backdrop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.nx-launcher-backdrop')).toBeHidden();
    await pressMod(page, '/');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();

    // Change the theme through the palette.
    const theme = await page.locator('html').getAttribute('data-theme');
    await pressMod(page, 'k');
    await page.keyboard.type('>Next theme');
    await expect(page.getByRole('option', { name: /Next theme/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme ?? '');
    const newTheme = await page.locator('html').getAttribute('data-theme');

    await reloadDesktop(page);
    await expect(windows(page)).toHaveCount(2);
    await expect(page.locator('.nx-workspace.is-current')).toHaveAttribute('data-index', '1');
    await expect(page.locator('.nx-windows .nx-window.is-snapped')).toHaveCount(2);
    await expect(page.locator('html')).toHaveAttribute('data-theme', newTheme ?? '');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('mouse: drag to snap, add a widget from the desktop menu; restored after reload', async ({ page }) => {
    const errors = collectErrors(page);
    await startNexus(page);
    const bar = welcome(page).locator('.nx-titlebar');
    const box = /** @type {{ x: number, y: number, width: number }} */ (await bar.boundingBox());
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(200, 300, { steps: 5 });
    await page.mouse.move(1, 300, { steps: 5 });
    await page.mouse.up();
    await expect(windows(page).first()).toHaveClass(/is-snapped/);

    await page.locator('.nx-desk-grid').click({ button: 'right', position: { x: 900, y: 600 } });
    await page.getByRole('menuitem', { name: /Add widgets/ }).click();
    await page.locator('.nx-widget-card[data-key="nexus.widgets/clock"]').click();
    await expect(page.locator('.nx-widget[data-key="nexus.widgets/clock"] .nx-wclock-time')).toBeVisible();

    await reloadDesktop(page);
    await expect(windows(page).first()).toHaveClass(/is-snapped/);
    await expect(page.locator('.nx-widget[data-key="nexus.widgets/clock"] .nx-wclock-time')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    test(`overview: strip, search and thumbnails do not overlap at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      // Regression: the translucent backdrop let windows behind collide with the strip and search.
      await page.setViewportSize(viewport);
      await startNexus(page);
      await pressMod(page, 'Shift+Space');
      const overview = page.locator('.nx-overview');
      await expect(overview).toBeVisible();
      const box = async (/** @type {string} */ sel) =>
        /** @type {{ y: number, height: number }} */ (await page.locator(sel).first().boundingBox());
      const [strip, search, thumb] = [await box('.nx-ov-strip'), await box('.nx-ov-search'), await box('.nx-ov-win')];
      expect(strip.y + strip.height).toBeLessThanOrEqual(search.y);
      expect(search.y + search.height).toBeLessThanOrEqual(thumb.y);
      // The backdrop hides what is behind it, with or without blur.
      const alpha = await overview.evaluate((el) => {
        const probe = document.createElement('div');
        probe.style.color = getComputedStyle(el).backgroundColor;
        document.body.append(probe);
        const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? [];
        probe.remove();
        return m.length === 4 ? Number(m[3]) : 1;
      });
      expect(alpha).toBeGreaterThanOrEqual(0.85);
    });
  }

  test('first boot: setup sets name, theme and language, then Welcome offers one primary action', async ({ page }) => {
    const errors = collectErrors(page);
    await startNexus(page);
    const setup = page.locator('.nx-setup');
    await expect(setup).toBeVisible();
    await setup.getByLabel('Your name').fill('Ada');
    await setup.getByRole('radio', { name: 'Arctic Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'arctic-light');
    await setup.getByRole('radio', { name: 'Deutsch' }).click();
    await expect(setup.getByLabel('Dein Name')).toHaveValue('Ada'); // kept across the language switch
    await setup.getByRole('button', { name: 'Nexus verwenden' }).click();
    await expect(page.locator('.nx-welcome-actions .nx-btn.is-primary')).toHaveCount(1);
    await expect(welcome(page).locator('.nx-window-title')).toHaveText('Willkommen');
    // Done once: a reload shows the Welcome page, not the setup.
    await reloadDesktop(page);
    await expect(page.locator('.nx-setup')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('dock rail: flush edge bar, maximized windows keep clear of it', async ({ page }) => {
    await startNexus(page);
    /** Sets a system setting through the palette's `@` mode. @param {string} label @param {RegExp} option */
    const setting = async (label, option) => {
      await pressMod(page, 'k');
      await page.keyboard.type(`@${label}`);
      await expect(page.getByRole('option', { name: new RegExp(`^${label}`) }).first()).toBeVisible();
      await page.keyboard.press('Enter');
      await page.getByRole('option', { name: option }).click();
    };
    await setting('Dock style', /^Rail/);
    await setting('Dock position', /^Left/);
    const dock = page.locator('.nx-dock');
    await expect(dock).toHaveAttribute('data-style', 'rail');
    await expect.poll(async () => (await dock.boundingBox())?.x).toBe(0); // after the slide-in
    const rail = /** @type {{ x: number, y: number, width: number, height: number }} */ (await dock.boundingBox());
    expect(rail.y).toBe(36);
    expect(rail.y + rail.height).toBe(page.viewportSize()?.height);
    await welcome(page).locator('[data-action="maximize"]').click();
    const win = /** @type {{ x: number }} */ (await welcome(page).boundingBox());
    expect(win.x).toBeGreaterThanOrEqual(rail.width);
  });

  test('palette groups results by kind with app tiles and one line per result', async ({ page }) => {
    await startNexus(page);
    await pressMod(page, 'k');
    await page.keyboard.type('notes');
    const list = page.locator('.nx-palette-list');
    await expect(list.locator('.nx-palette-group').first()).toHaveText(/apps/i);
    const first = list.getByRole('option').first();
    await expect(first).toHaveText(/^Nexus Notes/);
    await expect(first.locator('.nx-app-icon')).toHaveCount(1);
    // The description shows on the selected row only.
    await expect(list.getByRole('option').nth(1).locator('small')).toBeHidden();
  });

  test('top-bar app menu: window commands and the app menus of the focused window', async ({ page }) => {
    await startNexus(page);
    await pressMod(page, 'k');
    await page.keyboard.type('nexus write');
    await expect(page.getByRole('option').first()).toHaveText(/^Nexus Write/);
    await page.keyboard.press('Enter');
    const write = page.locator('.nx-windows .nx-window[data-app="nexus.write"]');
    await expect(write).toBeVisible();
    const bar = page.locator('.nx-tb-appmenu');
    await expect(bar.locator('.nx-tb-app')).toHaveText(/write/i);
    await expect(bar.locator('.nx-tb-menu')).toHaveText(['File', 'Edit', 'View']);
    // View shows the outline as checked; picking it hides the outline.
    await bar.getByRole('button', { name: 'View' }).click();
    const outline = page.getByRole('menuitemcheckbox', { name: /outline/i });
    await expect(outline).toHaveAttribute('aria-checked', 'true');
    await outline.click();
    await bar.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: /outline/i })).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    // The app name opens the window menu; Minimize leaves the desktop without app menus.
    await bar.locator('.nx-tb-app').click();
    await page.getByRole('menuitem', { name: 'Minimize' }).click();
    await expect(bar.locator('.nx-tb-menu')).toHaveCount(0);
  });

  test('dock folders: group pinned apps into a stack, launch from the popover, and ungroup', async ({ page }) => {
    await startNexus(page);
    const dock = page.locator('.nx-dock');
    await dock.locator('[data-app="nexus.notes"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /move to folder/i }).hover();
    await page.getByRole('menuitem', { name: /new folder/i }).click();
    const modal = page.locator('.nx-modal');
    await modal.getByRole('textbox').fill('Work');
    await modal.getByRole('button', { name: 'OK' }).click();

    const folderBtn = dock.getByRole('button', { name: 'Work' });
    await expect(folderBtn).toBeVisible();
    await expect(dock.locator('[data-app="nexus.notes"]')).toHaveCount(0);

    // Move Tasks into the same folder.
    await dock.locator('[data-app="nexus.tasks"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /move to folder/i }).hover();
    await page.getByRole('menuitem', { name: 'Work' }).click();
    await expect(dock.locator('[data-app="nexus.tasks"]')).toHaveCount(0);

    // Clicking the folder opens the stack popover and launches Notes.
    await folderBtn.click();
    const pop = page.getByRole('dialog', { name: 'Work' });
    await expect(pop.locator('.nx-dock-folder-app')).toHaveCount(2);
    await pop.locator('[data-app="nexus.notes"]').click();
    await expect(page.locator('.nx-windows .nx-window[data-app="nexus.notes"]')).toBeVisible();
    await expect(folderBtn).toHaveClass(/is-active/);

    // Ungroup puts the apps back in the dock.
    await folderBtn.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /ungroup folder/i }).click();
    await expect(dock.getByRole('button', { name: 'Work' })).toHaveCount(0);
    await expect(dock.locator('[data-app="nexus.notes"]')).toBeVisible();
    await expect(dock.locator('[data-app="nexus.tasks"]')).toBeVisible();
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch flows');

  /** @param {import('@playwright/test').Page} page @param {string} selector @param {number} dy */
  async function swipe(page, selector, dy) {
    const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (
      await page.locator(selector).boundingBox()
    );
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const init = { pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true, clientX: x };
    await page.locator(selector).dispatchEvent('pointerdown', { ...init, clientY: y });
    await page.locator(selector).dispatchEvent('pointerup', { ...init, clientY: y + dy });
  }

  test('toasts sit above the app bar', async ({ page }) => {
    // Regression: the "ready to work offline" toast covered Home and Switcher.
    await startNexus(page);
    await page.evaluate(() => {
      const toast = Object.assign(document.createElement('div'), { className: 'nx-toast', textContent: 'Test toast' });
      document.querySelector('.nx-toasts')?.append(toast);
    });
    const toast = await page.locator('.nx-toast', { hasText: 'Test toast' }).boundingBox();
    const bar = await page.locator('.nx-mbar').boundingBox();
    expect(toast && bar && toast.y + toast.height).toBeLessThanOrEqual(/** @type {any} */ (bar).y);
  });

  test('touch only: app bar, sheets, switcher, swipes and long-press; restored after reload', async ({ page }) => {
    const errors = collectErrors(page);
    await startNexus(page);
    await expect(page.locator('html')).toHaveAttribute('data-mobile', '');
    await expect(page.locator('.nx-windows .nx-window.is-sheet')).toHaveCount(1);

    // Home shows the desktop; Apps opens the full-screen launcher.
    await appBar(page).getByRole('button', { name: 'Home' }).tap();
    await expect(page.locator('.nx-windows .nx-window.is-sheet')).toHaveCount(0);
    await appBar(page).getByRole('button', { name: 'Apps' }).tap();
    await expect(page.locator('.nx-launcher-backdrop')).toBeVisible();
    await page.locator('.nx-launcher-tile', { hasText: 'Welcome' }).first().tap();
    await expect(page.locator('.nx-windows .nx-window.is-sheet')).toHaveCount(1);

    // Swipe up from the app bar: switcher. Swipe down from the top bar: notification center.
    await swipe(page, '.nx-mbar', -120);
    await expect(page.locator('.nx-overview')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.nx-overview')).toBeHidden();
    await swipe(page, '.nx-topbar', 160);
    await expect(page.locator('.nx-center-backdrop')).toBeVisible();
    await page.keyboard.press('Escape');

    // Long-press on the desktop opens its context menu.
    await appBar(page).getByRole('button', { name: 'Home' }).tap();
    const grid = page.locator('.nx-desk-grid');
    const g = /** @type {{ x: number, y: number }} */ (await grid.boundingBox());
    const touch = {
      pointerType: 'touch',
      pointerId: 9,
      isPrimary: true,
      bubbles: true,
      clientX: g.x + 200,
      clientY: g.y + 400,
    };
    await grid.dispatchEvent('pointerdown', touch);
    await expect(page.getByRole('menu')).toBeVisible();
    await grid.dispatchEvent('pointerup', touch);

    await page.keyboard.press('Escape');
    const count = await windows(page).count();
    await reloadDesktop(page);
    await expect(windows(page)).toHaveCount(count);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
