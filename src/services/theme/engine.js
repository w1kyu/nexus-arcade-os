// @ts-check
// Theme engine: turns the theme + user options into CSS custom properties on :root.
// `computeTokens` is pure (tested without a DOM); `createThemeService` applies it and keeps it
// in sync with settings and with the system's light/dark and reduced-motion preferences.
import { contrastRatio, ensureContrast, mix, readableOn, rgba } from './color.js';
import { allThemes, getTheme, registerDynamicThemes, THEMES, unregisterDynamicThemes } from './themes.js';

/** @typedef {'full' | 'reduced' | 'off'} MotionLevel */
/** @typedef {'inter' | 'jetbrains' | 'system'} FontChoice */
/** @typedef {'windows' | 'macos'} TitlebarStyle */
/** @typedef {'outline' | 'filled'} IconStyle */

/**
 * @typedef {object} ThemeOptions
 * @property {string} themeId
 * @property {import('./themes.js').Theme | null} [customTheme]
 * @property {string} [accent]          '' or hex override
 * @property {number} [fontScale]       0.8–1.5
 * @property {FontChoice} [fontFamily]
 * @property {number} [windowRadius]    0–24
 * @property {number} [transparency]    0 (opaque) – 1 (full glass)
 * @property {MotionLevel} [motion]
 * @property {boolean} [batterySaver]   no blur, glow or particles
 */

/** Status roles that get a tinted background (`--x-soft`) and a readable text color on it (`--x-on-soft`). */
const SOFT_ROLES = /** @type {const} */ (['accent', 'success', 'warning', 'danger', 'info']);
/** High Contrast keeps fully saturated, distinct chart colors instead of derived ones. */
const HC_CHART = ['#ffff00', '#00ffff', '#00ff00', '#ff8cff', '#ffa94d', '#ffffff', '#8fb8ff', '#ff6b6b'];

const MOTION = {
  full: { fast: '120ms', med: '220ms', slow: '420ms' },
  reduced: { fast: '0ms', med: '80ms', slow: '120ms' },
  off: { fast: '0ms', med: '0ms', slow: '0ms' },
};

const FONTS = {
  inter: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  jetbrains: "'JetBrains Mono Variable', ui-monospace, 'Cascadia Code', Consolas, monospace",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

/**
 * Parses a serialized custom theme override safely.
 * @param {unknown} raw
 * @returns {import('./themes.js').Theme | null}
 */
export function parseCustomThemeJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.colors || typeof obj.colors !== 'object') return null;
    if (typeof obj.colors.bg !== 'string' || typeof obj.colors.text1 !== 'string') return null;
    const base = getTheme('neon-night');
    return {
      id: typeof obj.id === 'string' && obj.id ? obj.id : 'custom',
      name:
        obj.name && typeof obj.name === 'object'
          ? { en: String(obj.name.en || 'Custom'), de: String(obj.name.de || obj.name.en || 'Eigenes') }
          : { en: String(obj.name || 'Custom'), de: String(obj.name || 'Eigenes') },
      scheme: obj.scheme === 'light' ? 'light' : 'dark',
      glow: typeof obj.glow === 'number' ? Math.min(1, Math.max(0, obj.glow)) : 0.7,
      colors: { ...base.colors, ...obj.colors },
    };
  } catch {
    return null;
  }
}

/**
 * @param {ThemeOptions} options
 * @returns {{ vars: Record<string, string>, theme: import('./themes.js').Theme, motion: MotionLevel, accentAdjusted: boolean }}
 */
export function computeTokens({
  themeId,
  customTheme = null,
  accent = '',
  fontScale = 1,
  fontFamily = 'inter',
  windowRadius = 16,
  transparency = 1,
  motion = 'full',
  batterySaver = false,
}) {
  const theme = customTheme ?? getTheme(themeId);
  const c = theme.colors;
  const dark = theme.scheme === 'dark';
  // Accent must stay visible as a UI element on the background (WCAG 1.4.11: 3:1).
  const wantedAccent = accent || c.accent;
  const finalAccent = ensureContrast(wantedAccent, c.bg, 3);
  const glow = batterySaver ? 0 : theme.glow;
  const glass = Math.min(1, Math.max(0, transparency));
  const level = /** @type {MotionLevel} */ (MOTION[motion] ? motion : 'full');
  const radiusLg = Math.min(24, Math.max(0, Number.isFinite(windowRadius) ? windowRadius : 16));
  const radiusMd = Math.max(0, Math.round(radiusLg * 0.625));
  const radiusSm = Math.max(0, Math.round(radiusLg * 0.375));
  const hc = theme.id === 'high-contrast';
  const focus = ensureContrast(c.focus || finalAccent, c.bg, 3);
  /** @type {Record<string, string>} */
  const roleColor = { accent: finalAccent, success: c.success, warning: c.warning, danger: c.danger, info: c.info };
  /** @type {Record<string, string>} */
  const soft = {};
  for (const role of SOFT_ROLES) {
    const tint = mix(c.surface1, roleColor[role], hc ? 0.18 : dark ? 0.16 : 0.12);
    soft[`--${role}-soft`] = tint;
    soft[`--${role}-on-soft`] = ensureContrast(roleColor[role], tint, 4.5);
  }
  const chartBase = hc
    ? HC_CHART
    : [finalAccent, c.accent2, c.info, c.success, c.warning, c.danger, mix(finalAccent, c.accent2, 0.5), c.text2];
  /** @type {Record<string, string>} */
  const chart = {};
  chartBase.forEach((color, i) => (chart[`--chart-${i + 1}`] = ensureContrast(color, c.surface1, 3)));
  const borderStrong = hc ? c.border : rgba(c.border, dark ? 0.4 : 0.5);

  /** @type {Record<string, string>} */
  const vars = {
    '--bg': c.bg,
    '--surface-1': c.surface1,
    '--surface-2': c.surface2,
    '--surface-3': c.surface3,
    '--glass': rgba(c.surface2, batterySaver ? 0.97 : 1 - 0.4 * glass),
    '--border': theme.id === 'high-contrast' ? c.border : rgba(c.border, dark ? 0.22 : 0.3),
    '--text-1': c.text1,
    '--text-2': c.text2,
    '--text-3': c.text3,
    '--accent': finalAccent,
    '--accent-2': c.accent2,
    '--accent-contrast': readableOn(finalAccent),
    '--success': c.success,
    '--warning': c.warning,
    '--danger': c.danger,
    '--danger-contrast': readableOn(c.danger),
    '--info': c.info,
    '--radius-lg': `${radiusLg}px`,
    '--radius-md': `${radiusMd}px`,
    '--radius-sm': `${radiusSm}px`,
    '--font-sans': FONTS[fontFamily] ?? FONTS.inter,
    '--blur-glass': `${batterySaver ? 0 : Math.round(18 * glass)}px`,
    '--surface-sunken': hc ? c.bg : mix(c.surface1, c.bg, dark ? 0.35 : 0.5),
    '--surface-hover': hc ? c.surface3 : rgba(c.text1, dark ? 0.06 : 0.05),
    '--surface-active': mix(c.surface1, finalAccent, hc ? 0.18 : dark ? 0.14 : 0.1),
    '--border-strong': borderStrong,
    // Shell frame (window border, dock, palette): accent-tinted in glowing themes.
    '--frame': hc ? c.border : dark && glow > 0 ? rgba(finalAccent, 0.2 + 0.16 * glow) : borderStrong,
    '--focus': focus,
    // Base color for shadows and dark overlays mixed with transparency in app CSS.
    '--shadow-ink': dark || hc ? '#000000' : '#101828',
    '--scrim': hc ? 'rgb(0 0 0 / 0.75)' : dark ? 'rgb(2 4 10 / 0.6)' : 'rgb(20 30 50 / 0.28)',
    ...soft,
    ...chart,
    '--bevel': `${Math.round(radiusLg * 0.75)}px`,
    '--bevel-sm': `${Math.round(radiusLg * 0.5)}px`,
    '--glow-accent': glow > 0 ? `0 0 24px ${rgba(finalAccent, 0.25 * glow)}` : 'none',
    // The glow budget (skill nexus-ui rule 3): focused window, primary button, active selection.
    '--glow-window': hc
      ? `0 0 0 1px ${finalAccent}`
      : glow > 0
        ? `0 0 0 1px ${rgba(finalAccent, 0.3 + 0.12 * glow)}, 0 0 36px -8px ${rgba(finalAccent, 0.4 * glow)}`
        : `0 0 0 1px ${rgba(finalAccent, 0.3)}`,
    '--glow-btn': glow >= 0.5 ? `0 0 18px -6px ${rgba(finalAccent, 0.65 * glow)}` : 'none',
    '--glow-strength': String(glow),
    '--shadow-1': hc
      ? 'none'
      : dark
        ? '0 1px 2px rgb(0 0 0 / 0.4), 0 4px 12px -4px rgb(0 0 0 / 0.4)'
        : '0 1px 2px rgb(16 24 40 / 0.08), 0 2px 8px -2px rgb(16 24 40 / 0.1)',
    '--shadow-2': hc
      ? 'none'
      : dark
        ? '0 8px 20px -8px rgb(0 0 0 / 0.55), 0 30px 70px -20px rgb(0 0 0 / 0.7)'
        : '0 1px 2px rgb(16 24 40 / 0.06), 0 12px 32px -8px rgb(16 24 40 / 0.18), 0 32px 64px -24px rgb(16 24 40 / 0.2)',
    '--font-scale': String(Math.min(1.5, Math.max(0.8, fontScale))),
    '--dur-fast': MOTION[level].fast,
    '--dur-med': MOTION[level].med,
    '--dur-slow': MOTION[level].slow,
  };
  return { vars, theme, motion: level, accentAdjusted: finalAccent !== wantedAccent };
}

/**
 * Contrast of a custom accent against a theme's background (for the settings UI warning).
 * @param {string} accent
 * @param {string} themeId
 */
export function accentContrast(accent, themeId) {
  const ratio = contrastRatio(accent, getTheme(themeId).colors.bg);
  return { ratio, ok: ratio >= 3 };
}

/**
 * Parses an `HH:MM` (24-hour) string into minutes since midnight (`0`–`1439`).
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseTimeMinutes(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Determines whether `'light'` or `'dark'` applies at `now` for the configured daily schedule.
 * Supports both daytime (`07:00`→`19:00`) and overnight (`20:00`→`06:00`) light windows.
 * @param {Date} now
 * @param {string} [lightStart]
 * @param {string} [darkStart]
 * @returns {'light' | 'dark'}
 */
export function resolveScheduledScheme(now, lightStart = '07:00', darkStart = '19:00') {
  const lightMin = parseTimeMinutes(lightStart) ?? 7 * 60;
  const darkMin = parseTimeMinutes(darkStart) ?? 19 * 60;
  if (lightMin === darkMin) return 'dark';
  const current = now.getHours() * 60 + now.getMinutes();
  if (lightMin < darkMin) return current >= lightMin && current < darkMin ? 'light' : 'dark';
  return current >= lightMin || current < darkMin ? 'light' : 'dark';
}

/**
 * Milliseconds until the next scheduled light/dark boundary, or `null` when both times match.
 * @param {Date} now
 * @param {string} [lightStart]
 * @param {string} [darkStart]
 * @returns {number | null}
 */
export function msUntilNextScheduleChange(now, lightStart = '07:00', darkStart = '19:00') {
  const lightMin = parseTimeMinutes(lightStart) ?? 7 * 60;
  const darkMin = parseTimeMinutes(darkStart) ?? 19 * 60;
  if (lightMin === darkMin) return null;
  const DAY = 86_400_000;
  const nowMs = ((now.getHours() * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000 + now.getMilliseconds();
  const nextDelta = (/** @type {number} */ targetMin) => {
    const targetMs = targetMin * 60_000;
    return targetMs > nowMs ? targetMs - nowMs : targetMs + DAY - nowMs;
  };
  return Math.min(nextDelta(lightMin), nextDelta(darkMin));
}

/**
 * @param {object} options
 * @param {import('../settings/settings.js').Settings} options.settings
 * @param {import('../../kernel/bus.js').EventBus} options.bus
 * @param {HTMLElement} options.root                document.documentElement
 * @param {(query: string) => MediaQueryList} [options.matchMedia]
 * @param {() => boolean} [options.isSafeMode]
 * @param {() => Date} [options.now]
 */
export function createThemeService({
  settings,
  bus,
  root,
  matchMedia = globalThis.matchMedia?.bind(globalThis),
  isSafeMode = () => false,
  now = () => new Date(),
}) {
  const prefersLight = matchMedia?.('(prefers-color-scheme: light)');
  const prefersReduced = matchMedia?.('(prefers-reduced-motion: reduce)');
  /** @type {ReturnType<typeof computeTokens> | null} */
  let applied = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let transitionTimer;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let scheduleTimer;
  /** @type {CSSStyleSheet | null} */
  let customSheet = null;
  let stopped = false;

  const sys = (/** @type {string} */ key) => {
    try {
      return settings.get('system', key);
    } catch {
      return undefined;
    }
  };

  function resolveThemeId() {
    const chosen = /** @type {string} */ (sys('theme'));
    if (chosen === 'auto') {
      return /** @type {string} */ (prefersLight?.matches ? sys('themeAutoLight') : sys('themeAutoDark'));
    }
    if (chosen === 'schedule') {
      const scheme = resolveScheduledScheme(
        now(),
        String(sys('themeScheduleLightStart') ?? '07:00'),
        String(sys('themeScheduleDarkStart') ?? '19:00'),
      );
      return /** @type {string} */ (scheme === 'light' ? sys('themeAutoLight') : sys('themeAutoDark'));
    }
    return chosen;
  }

  function resolveMotion() {
    const chosen = /** @type {string} */ (sys('animation'));
    if (chosen === 'auto') return prefersReduced?.matches ? 'reduced' : 'full';
    return /** @type {MotionLevel} */ (chosen);
  }

  function syncScheduleTimer() {
    clearTimeout(scheduleTimer);
    scheduleTimer = undefined;
    if (stopped || sys('theme') !== 'schedule') return;
    const ms = msUntilNextScheduleChange(
      now(),
      String(sys('themeScheduleLightStart') ?? '07:00'),
      String(sys('themeScheduleDarkStart') ?? '19:00'),
    );
    if (ms === null) return;
    // Wake at the exact boundary (+50 ms) or at most hourly so sleep/DST shifts stay accurate.
    const delay = Math.max(250, Math.min(ms + 50, 3_600_000));
    scheduleTimer = setTimeout(() => {
      if (stopped || sys('theme') !== 'schedule') return;
      if (resolveThemeId() !== applied?.theme.id) apply({ animate: true });
      else syncScheduleTimer();
    }, delay);
  }

  /** Applies or clears Custom CSS safely using Constructed Stylesheets when available. */
  function applyCustomCss() {
    const doc = root?.ownerDocument;
    if (!doc) return;
    const rawCss = String(sys('customCss') ?? '');
    const disabled = Boolean(sys('customCssSafeMode')) || isSafeMode() || !rawCss.trim();
    const cssText = disabled ? '' : rawCss;

    if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in doc) {
      if (!customSheet) {
        try {
          customSheet = new CSSStyleSheet();
          doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, customSheet];
        } catch {
          customSheet = null;
        }
      }
      if (customSheet) {
        try {
          customSheet.replaceSync(cssText);
          return;
        } catch {
          return;
        }
      }
    }
  }

  /** @param {{ animate?: boolean }} [options] */
  function apply({ animate = false } = {}) {
    const customTheme = parseCustomThemeJson(sys('customTheme'));
    const next = computeTokens({
      themeId: resolveThemeId(),
      customTheme,
      accent: /** @type {string} */ (sys('accent')),
      fontScale: /** @type {number} */ (sys('fontScale')),
      fontFamily: /** @type {FontChoice} */ (sys('fontFamily') ?? 'inter'),
      windowRadius: /** @type {number} */ (sys('windowRadius') ?? 16),
      transparency: /** @type {number} */ (sys('transparency')),
      motion: resolveMotion(),
      batterySaver: /** @type {boolean} */ (sys('batterySaver')),
    });
    if (animate && next.motion !== 'off') {
      root.classList.add('nx-theme-transition');
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => root.classList.remove('nx-theme-transition'), 450);
    }
    for (const [name, value] of Object.entries(next.vars)) root.style.setProperty(name, value);
    root.dataset.theme = next.theme.id;
    root.dataset.scheme = next.theme.scheme;
    root.dataset.motion = next.motion;
    root.dataset.batterySaver = String(!!sys('batterySaver'));
    root.dataset.focusRing = String(sys('focusRing'));
    root.dataset.largeTargets = String(!!sys('largeTargets'));
    root.dataset.titlebar = String(sys('titlebarStyle') ?? 'windows');
    root.dataset.iconStyle = String(sys('iconStyle') ?? 'outline');
    root.dataset.corners = String(sys('cornerStyle') ?? 'bevel');
    root.dataset.density = String(sys('density') ?? 'comfortable');
    root.style.colorScheme = next.theme.scheme;
    root.ownerDocument?.querySelector('meta[name="theme-color"]')?.setAttribute('content', next.theme.colors.bg);
    applyCustomCss();
    const changed = applied?.theme.id !== next.theme.id;
    applied = next;
    syncScheduleTimer();
    bus.emit('theme:changed', {
      theme: next.theme.id,
      scheme: next.theme.scheme,
      motion: next.motion,
      themeSwitched: changed,
    });
  }

  const THEME_KEYS = new Set([
    'theme',
    'themeAutoLight',
    'themeAutoDark',
    'themeScheduleLightStart',
    'themeScheduleDarkStart',
    'customTheme',
    'accent',
    'fontScale',
    'fontFamily',
    'windowRadius',
    'titlebarStyle',
    'iconStyle',
    'cornerStyle',
    'density',
    'customCss',
    'customCssSafeMode',
    'transparency',
    'animation',
    'batterySaver',
    'focusRing',
    'largeTargets',
  ]);
  const unsubSettings = settings.onChange('system', '*', (_value, key) => {
    if (key === 'theme' && _value && String(sys('customTheme') || '')) {
      // Clear custom override when switching explicitly to a built-in preset
      void settings.set('system', 'customTheme', '').catch(() => {});
    }
    if (THEME_KEYS.has(key)) apply({ animate: true });
  });
  const onLightChange = () => {
    if (sys('theme') === 'auto') apply({ animate: true });
  };
  const onReducedChange = () => {
    if (sys('animation') === 'auto') apply();
  };
  const doc = root?.ownerDocument;
  const onVisibilityChange = () => {
    if (stopped || doc?.hidden || sys('theme') !== 'schedule') return;
    if (resolveThemeId() !== applied?.theme.id) apply({ animate: true });
    else syncScheduleTimer();
  };
  prefersLight?.addEventListener?.('change', onLightChange);
  prefersReduced?.addEventListener?.('change', onReducedChange);
  doc?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    apply,
    stop() {
      stopped = true;
      clearTimeout(transitionTimer);
      clearTimeout(scheduleTimer);
      unsubSettings?.();
      prefersLight?.removeEventListener?.('change', onLightChange);
      prefersReduced?.removeEventListener?.('change', onReducedChange);
      doc?.removeEventListener?.('visibilitychange', onVisibilityChange);
    },
    themes: () => allThemes(),
    builtInThemes: () => THEMES,
    /** Registers dynamic plugin themes; returns unregister callback. */
    registerThemes(/** @type {string} */ source, /** @type {import('./themes.js').Theme[]} */ list) {
      const unsub = registerDynamicThemes(source, list);
      bus.emit('theme:list-changed', { source });
      return () => {
        unsub();
        bus.emit('theme:list-changed', { source });
      };
    },
    unregisterThemes(/** @type {string} */ source) {
      unregisterDynamicThemes(source);
      bus.emit('theme:list-changed', { source });
    },
    /** Activates a custom or plugin theme object live via system settings. */
    async activateCustomTheme(/** @type {import('./themes.js').Theme | null} */ themeObj) {
      if (!themeObj) {
        await settings.set('system', 'customTheme', '');
        return;
      }
      await settings.set('system', 'customTheme', JSON.stringify(themeObj));
    },
    /** Resolved theme id (never 'auto' or 'schedule'). */
    get current() {
      return applied?.theme.id ?? resolveThemeId();
    },
    get currentTheme() {
      return applied?.theme ?? getTheme(resolveThemeId());
    },
    get scheme() {
      return applied?.theme.scheme ?? getTheme(resolveThemeId()).scheme;
    },
    get motion() {
      return applied?.motion ?? resolveMotion();
    },
    /** @param {string} name token without '--', e.g. 'accent' */
    token: (name) => applied?.vars[`--${name}`] ?? '',
    /** True if the user's accent had to be adjusted for contrast. */
    get accentAdjusted() {
      return applied?.accentAdjusted ?? false;
    },
    /** @param {(info: { theme: string, scheme: string, motion: string }) => void} fn */
    onChange: (fn) => bus.on('theme:changed', fn),
  };
}

/** @typedef {ReturnType<typeof createThemeService>} ThemeService */
