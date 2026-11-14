// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createLogger } from '../../src/kernel/logger.js';
import { createSettings, SETTINGS_STORE_SCHEMA } from '../../src/services/settings/settings.js';
import { SYSTEM_SETTINGS } from '../../src/services/settings/system-settings.js';
import { createIdbEngine } from '../../src/services/storage/engine-idb.js';
import { createThemeService } from '../../src/services/theme/engine.js';
import { auditThemeContrast, buildThemeColors, extractDominantColors } from '../../src/ui/color-extract.js';

describe('theme editor & personalization', () => {
  it('generates WCAG AA compliant dark and light palettes from seed colors', () => {
    for (const scheme of /** @type {const} */ (['dark', 'light'])) {
      const colors = buildThemeColors({ seed: '#2563eb', scheme, harmony: 'triadic' });
      const audit = auditThemeContrast(colors);
      expect(audit.allAA).toBe(true);
      expect(audit.checks.find((c) => c.id === 'text1')?.ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('flags low-contrast combinations in auditThemeContrast', () => {
    const bad = buildThemeColors({ seed: '#3ef0ff', scheme: 'dark' });
    bad.text1 = bad.bg;
    const audit = auditThemeContrast(bad);
    expect(audit.allAA).toBe(false);
    expect(audit.checks.find((c) => c.id === 'text1')?.passAA).toBe(false);
  });

  it('extracts dominant colors via K-Means from pixel buffers', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 250, 5, 5, 255, 0, 0, 255, 255, 5, 5, 250, 255]);
    const colors = extractDominantColors(pixels, 2, 6);
    expect(colors).toHaveLength(2);
    expect(colors.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });

  it('activates custom themes and honors custom CSS safe mode', async () => {
    const db = await createIdbEngine().open('theme-editor-db', SETTINGS_STORE_SCHEMA);
    const bus = createEventBus();
    const settings = createSettings({ db, bus, log: createLogger().child('settings') });
    settings.register('system', SYSTEM_SETTINGS);
    await settings.load();

    const root = document.documentElement;
    let safeMode = false;
    const theme = createThemeService({ settings, bus, root, isSafeMode: () => safeMode });

    const palette = buildThemeColors({ seed: '#ec4899', scheme: 'dark' });
    await theme.activateCustomTheme({
      id: 'my-pink',
      name: 'Neon Pink',
      scheme: 'dark',
      colors: palette,
      glow: '0 0 20px #ec4899',
    });

    expect(theme.current).toBe('my-pink');
    expect(root.dataset.theme).toBe('my-pink');
    expect(root.style.getPropertyValue('--accent')).toBe(palette.accent);

    await settings.set('system', 'titlebarStyle', 'macos');
    await settings.set('system', 'windowRadius', 20);
    await settings.set('system', 'iconStyle', 'filled');
    await settings.set('system', 'customCss', 'body { border: 2px solid red; }');
    theme.apply();
    expect(root.dataset.titlebar).toBe('macos');
    expect(root.dataset.iconStyle).toBe('filled');
    expect(root.style.getPropertyValue('--radius-lg')).toBe('20px');

    safeMode = true;
    expect(() => theme.apply()).not.toThrow();
  });
});
