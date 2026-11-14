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

test.describe('Phase 11 — Media Center Suite', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop window workflows');

  test('opens and interacts with all Phase 11 Media Center applications', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/icons/icon.svg');
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) await caches.delete(k);
      }
    });
    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Music (nexus.music)
    const musicWin = await openAppFromPalette(page, 'Nexus Music', 'nexus.music');
    await expect(musicWin.locator('.nx-music')).toBeVisible();
    await expect(musicWin.locator('.nx-music-player-bar')).toBeVisible();
    // Close window
    await musicWin.locator('button[data-action="close"]').click();

    // 2. Video Player (nexus.video)
    const videoWin = await openAppFromPalette(page, 'Video Player', 'nexus.video');
    await expect(videoWin.locator('.nx-video')).toBeVisible();
    await expect(videoWin.locator('.nx-video-controls')).toBeVisible();
    await videoWin.locator('button[data-action="close"]').click();

    // 3. Photos (nexus.photos)
    const photosWin = await openAppFromPalette(page, 'Nexus Photos', 'nexus.photos');
    await expect(photosWin.locator('.nx-photos')).toBeVisible();
    await expect(photosWin.locator('.nx-photos-header')).toBeVisible();
    await photosWin.locator('button[data-action="close"]').click();

    // 4. Voice Recorder (nexus.recorder)
    const recorderWin = await openAppFromPalette(page, 'Voice Recorder', 'nexus.recorder');
    await expect(recorderWin.locator('.nx-recorder')).toBeVisible();
    await expect(recorderWin.locator('.nx-recorder-record-btn')).toBeVisible();
    await recorderWin.locator('button[data-action="close"]').click();

    // 5. Camera (nexus.camera)
    const cameraWin = await openAppFromPalette(page, 'Camera', 'nexus.camera');
    await expect(cameraWin.locator('.nx-camera')).toBeVisible();
    await expect(cameraWin.locator('.nx-camera-canvas')).toBeVisible();
    await cameraWin.locator('button[data-action="close"]').click();

    // 6. Screen Recorder (nexus.screenrecorder)
    const screenWin = await openAppFromPalette(page, 'Screen Recorder', 'nexus.screenrecorder');
    await expect(screenWin.locator('.nx-screenrecorder')).toBeVisible();
    await expect(screenWin.locator('.nx-screenrecorder-toolbar')).toBeVisible();
    await screenWin.locator('button[data-action="close"]').click();

    // 7. Beat Lab (nexus.beatlab)
    const beatWin = await openAppFromPalette(page, 'Beat Lab', 'nexus.beatlab');
    await expect(beatWin.locator('.nx-beatlab')).toBeVisible();
    await expect(beatWin.locator('.nx-beatlab-grid')).toBeVisible();
    await expect(beatWin.locator('.nx-beatlab-track')).toHaveCount(8);
    // Click Play / Stop toggle
    const playBtn = beatWin.locator('.nx-beatlab-topbar button').first();
    await playBtn.click();
    await playBtn.click();
    await beatWin.locator('button[data-action="close"]').click();

    // 8. Synthesizer (nexus.synth)
    const synthWin = await openAppFromPalette(page, 'Synthesizer', 'nexus.synth');
    await expect(synthWin.locator('.nx-synth')).toBeVisible();
    await expect(synthWin.locator('.nx-synth-canvas')).toBeVisible();
    await expect(synthWin.locator('.nx-synth-keyboard')).toBeVisible();
    // Test on-screen piano key click
    const whiteKey = synthWin.locator('.nx-synth-key-white').first();
    await expect(whiteKey).toBeVisible();
    await whiteKey.dispatchEvent('mousedown', { button: 0 });
    await expect(whiteKey).toHaveClass(/is-active/);
    await whiteKey.dispatchEvent('mouseup');
    await expect(whiteKey).not.toHaveClass(/is-active/);

    await synthWin.locator('button[data-action="close"]').click();

    // Verify clean run without unhandled errors
    expect(errors).toEqual([]);
  });
});
