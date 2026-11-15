// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createLogger } from '../../src/kernel/logger.js';
import { createSettings, SETTINGS_STORE_SCHEMA } from '../../src/services/settings/settings.js';
import { SYSTEM_SETTINGS } from '../../src/services/settings/system-settings.js';
import { createMemoryEngine } from '../../src/services/storage/engine-memory.js';
import {
  contrastRatio,
  ensureContrast,
  luminance,
  mix,
  parseHex,
  readableOn,
  rgba,
} from '../../src/services/theme/color.js';
import {
  accentContrast,
  computeTokens,
  createThemeService,
  msUntilNextScheduleChange,
  parseTimeMinutes,
  resolveScheduledScheme,
} from '../../src/services/theme/engine.js';
import { THEMES } from '../../src/services/theme/themes.js';

describe('color math', () => {
  it('parses, mixes and formats colors', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(rgba('#3ef0ff', 0.25)).toBe('rgb(62 240 255 / 0.25)');
    expect(() => parseHex('red')).toThrow();
  });

  it('computes WCAG luminance and contrast', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(readableOn('#ffff00')).toBe('#000000');
    expect(readableOn('#0a64eb')).toBe('#ffffff');
  });

  it('pushes colors to a minimum contrast', () => {
    const fixed = ensureContrast('#202020', '#000000', 3);
    expect(contrastRatio(fixed, '#000000')).toBeGreaterThanOrEqual(3);
    expect(ensureContrast('#ffffff', '#000000', 3)).toBe('#ffffff');
  });
});

describe('built-in themes', () => {
  it('has the 8 themes from the brief, unique ids, EN and DE names', () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      'neon-night',
      'synthwave',
      'matrix',
      'blade',
      'deep-ocean',
      'arctic-light',
      'paper',
      'high-contrast',
    ]);
    for (const t of THEMES) expect(t.name.en && t.name.de).toBeTruthy();
  });

  // WCAG AA in every theme: text ≥ 4.5:1 on every background it sits on; accent ≥ 3:1 (UI).
  it.each(THEMES.map((t) => [t.id, t]))('%s meets WCAG AA contrast', (_id, theme) => {
    const c = theme.colors;
    for (const bg of [c.bg, c.surface1, c.surface2, c.surface3]) {
      for (const [role, fg] of Object.entries({ text1: c.text1, text2: c.text2, text3: c.text3 })) {
        expect(contrastRatio(fg, bg), `${role} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const [role, fg] of Object.entries({
        accent: c.accent,
        success: c.success,
        warning: c.warning,
        danger: c.danger,
        info: c.info,
      })) {
        expect(contrastRatio(fg, bg), `${role} ${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    }
    expect(contrastRatio(readableOn(c.accent), c.accent)).toBeGreaterThanOrEqual(4.5);
  });

  // Accent and status colors also appear as small text (links, selected tabs, error and
  // status messages) on the page and on cards, so there they need text contrast (skill nexus-ui
  // rule 7). surface3 is for controls and hover states, not for colored text.
  it.each(THEMES.map((t) => [t.id, t]))('%s accent and status colors are readable as text', (_id, theme) => {
    const c = theme.colors;
    for (const [bgRole, bg] of Object.entries({ bg: c.bg, surface1: c.surface1, surface2: c.surface2 })) {
      for (const role of /** @type {const} */ (['accent', 'success', 'warning', 'danger', 'info'])) {
        expect(contrastRatio(c[role], bg), `${role} ${c[role]} on ${bgRole} ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('computeTokens', () => {
  it('maps the theme to CSS variables', () => {
    const { vars, theme, motion } = computeTokens({ themeId: 'arctic-light' });
    expect(theme.scheme).toBe('light');
    expect(vars['--bg']).toBe('#f3f6fb');
    expect(vars['--accent-contrast']).toBe('#ffffff');
    expect(vars['--dur-med']).toBe('220ms');
    expect(motion).toBe('full');
  });

  it('applies accent, font scale, transparency, motion and battery saver', () => {
    const { vars, motion } = computeTokens({
      themeId: 'neon-night',
      accent: '#ff00aa',
      fontScale: 3,
      transparency: 0,
      motion: 'off',
      batterySaver: true,
    });
    expect(vars['--accent']).toBe('#ff00aa');
    expect(vars['--font-scale']).toBe('1.5');
    expect(vars['--blur-glass']).toBe('0px');
    expect(vars['--glow-accent']).toBe('none');
    expect(vars['--dur-slow']).toBe('0ms');
    expect(motion).toBe('off');
  });

  it('adjusts an unreadable accent and reports it', () => {
    const result = computeTokens({ themeId: 'paper', accent: '#fff8e0' });
    expect(result.accentAdjusted).toBe(true);
    expect(contrastRatio(result.vars['--accent'], '#f6f1e7')).toBeGreaterThanOrEqual(3);
    expect(accentContrast('#fff8e0', 'paper').ok).toBe(false);
    expect(accentContrast('#a84a12', 'paper').ok).toBe(true);
  });

  it('falls back to the default theme for unknown ids', () => {
    expect(computeTokens({ themeId: 'removed-theme' }).theme.id).toBe('neon-night');
  });
});

describe('time-based theme schedule math', () => {
  it('parses HH:MM strings and rejects invalid values', () => {
    expect(parseTimeMinutes('00:00')).toBe(0);
    expect(parseTimeMinutes('07:30')).toBe(450);
    expect(parseTimeMinutes('23:59')).toBe(1439);
    expect(parseTimeMinutes('24:00')).toBeNull();
    expect(parseTimeMinutes('7:00')).toBeNull();
  });

  it('resolves daytime and overnight windows inclusively on start', () => {
    const at = (h, m) => new Date(2026, 10, 14, h, m, 0, 0);
    expect(resolveScheduledScheme(at(6, 59), '07:00', '19:00')).toBe('dark');
    expect(resolveScheduledScheme(at(7, 0), '07:00', '19:00')).toBe('light');
    expect(resolveScheduledScheme(at(18, 59), '07:00', '19:00')).toBe('light');
    expect(resolveScheduledScheme(at(19, 0), '07:00', '19:00')).toBe('dark');

    // Overnight light window (20:00 -> 06:00)
    expect(resolveScheduledScheme(at(22, 0), '20:00', '06:00')).toBe('light');
    expect(resolveScheduledScheme(at(5, 59), '20:00', '06:00')).toBe('light');
    expect(resolveScheduledScheme(at(6, 0), '20:00', '06:00')).toBe('dark');

    // Equal start times fall back safely to dark with no scheduled transitions
    expect(resolveScheduledScheme(at(12, 0), '08:00', '08:00')).toBe('dark');
    expect(msUntilNextScheduleChange(at(12, 0), '08:00', '08:00')).toBeNull();
  });

  it('computes milliseconds to the next boundary across midnight', () => {
    const at1859 = new Date(2026, 10, 14, 18, 59, 45, 0);
    expect(msUntilNextScheduleChange(at1859, '07:00', '19:00')).toBe(15_000);
    const at2350 = new Date(2026, 10, 14, 23, 50, 0, 0);
    expect(msUntilNextScheduleChange(at2350, '07:00', '19:00')).toBe((7 * 60 + 10) * 60_000);
  });
});

describe('theme service', () => {
  function mediaQueries({ light = false, reduced = false } = {}) {
    const lists = {};
    const make = (query, matches) => {
      const listeners = [];
      lists[query] = {
        matches,
        addEventListener: (_t, fn) => listeners.push(fn),
        removeEventListener: (_t, fn) => {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) listeners.splice(idx, 1);
        },
        fire: () => listeners.forEach((f) => f()),
      };
      return lists[query];
    };
    make('(prefers-color-scheme: light)', light);
    make('(prefers-reduced-motion: reduce)', reduced);
    return { matchMedia: (q) => lists[q], lists };
  }

  async function setup(media = {}, nowFn) {
    const bus = createEventBus();
    const db = await createMemoryEngine().open('p', SETTINGS_STORE_SCHEMA);
    const settings = createSettings({ db, bus, log: createLogger().child('s') });
    settings.register('system', SYSTEM_SETTINGS);
    await settings.load();
    const { matchMedia, lists } = mediaQueries(media);
    const root = document.documentElement;
    const theme = createThemeService({ settings, bus, root, matchMedia, now: nowFn });
    theme.apply();
    return { bus, settings, theme, root, lists };
  }

  it('applies variables and data attributes to :root', async () => {
    const { root, theme } = await setup();
    expect(root.style.getPropertyValue('--bg')).toBe('#05060d');
    expect(root.dataset.theme).toBe('neon-night');
    expect(root.dataset.scheme).toBe('dark');
    expect(theme.token('accent')).toBe('#3ef0ff');
  });

  it('switches live when settings change, with a short transition', async () => {
    vi.useFakeTimers();
    const { root, settings, bus } = await setup();
    const changed = vi.fn();
    bus.on('theme:changed', changed);
    await settings.set('system', 'theme', 'matrix');
    expect(root.dataset.theme).toBe('matrix');
    expect(root.classList.contains('nx-theme-transition')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(root.classList.contains('nx-theme-transition')).toBe(false);
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'matrix', themeSwitched: true }),
      'theme:changed',
    );
    await settings.set('system', 'soundMaster', 0.1); // unrelated: no re-apply
    expect(changed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('follows the system light/dark preference in Auto', async () => {
    const { root, settings, lists, theme } = await setup({ light: true });
    await settings.set('system', 'theme', 'auto');
    expect(root.dataset.theme).toBe('arctic-light');
    lists['(prefers-color-scheme: light)'].matches = false;
    lists['(prefers-color-scheme: light)'].fire();
    expect(root.dataset.theme).toBe('neon-night');
    expect(theme.current).toBe('neon-night');
    await settings.set('system', 'themeAutoDark', 'deep-ocean');
    expect(root.dataset.theme).toBe('deep-ocean');
  });

  it('switches themes automatically by time of day in schedule mode', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 18, 59, 50, 0));
    const { root, settings, theme, bus } = await setup({}, () => new Date());
    const changed = vi.fn();
    bus.on('theme:changed', changed);

    await settings.set('system', 'themeAutoLight', 'paper');
    await settings.set('system', 'themeAutoDark', 'blade');
    await settings.set('system', 'theme', 'schedule');
    expect(root.dataset.theme).toBe('paper');
    expect(theme.current).toBe('paper');

    // Advance across 19:00 boundary -> switches automatically to dark theme.
    await vi.advanceTimersByTimeAsync(11_000);
    expect(root.dataset.theme).toBe('blade');
    expect(theme.current).toBe('blade');
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: 'blade', scheme: 'dark', themeSwitched: true }),
      'theme:changed',
    );

    // Updating the dark cutoff later than current time switches back to light immediately.
    await settings.set('system', 'themeScheduleDarkStart', '21:00');
    expect(root.dataset.theme).toBe('paper');

    // Stop detaches timers cleanly.
    theme.stop();
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(root.dataset.theme).toBe('paper');
    vi.useRealTimers();
  });

  it('respects prefers-reduced-motion when animation is Auto', async () => {
    const { root, settings } = await setup({ reduced: true });
    expect(root.dataset.motion).toBe('reduced');
    await settings.set('system', 'animation', 'full');
    expect(root.dataset.motion).toBe('full');
  });
});
