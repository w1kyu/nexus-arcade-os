// @ts-check
// Shared color harmony & dominant color extraction helpers (used by Theme Editor and Wallpaper).
import { contrastRatio, ensureContrast, mix } from '../services/theme/color.js';

/** @param {number} n @param {number} min @param {number} max */
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/** @param {number} r @param {number} g @param {number} b */
export function rgbToHex(r, g, b) {
  const h = (/** @type {number} */ n) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** @param {string} hex */
export function hexToRgb(hex) {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** @param {number} r @param {number} g @param {number} b @returns {[number, number, number]} */
export function rgbToHsl(r, g, b) {
  const rd = r / 255;
  const gd = g / 255;
  const bd = b / 255;
  const max = Math.max(rd, gd, bd);
  const min = Math.min(rd, gd, bd);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rd) h = (gd - bd) / d + (gd < bd ? 6 : 0);
    else if (max === gd) h = (bd - rd) / d + 2;
    else h = (rd - gd) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** @param {number} h @param {number} s @param {number} l @returns {string} */
export function hslToHex(h, s, l) {
  const hd = ((h % 360) + 360) % 360;
  const sd = clamp(s, 0, 100) / 100;
  const ld = clamp(l, 0, 100) / 100;
  const k = (/** @type {number} */ n) => (n + hd / 30) % 12;
  const a = sd * Math.min(ld, 1 - ld);
  const f = (/** @type {number} */ n) => ld - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255));
}

/**
 * Extracts dominant hex colors from RGBA pixel data via K-Means.
 * @param {Uint8ClampedArray} data
 * @param {number} [k]
 * @param {number} [maxIter]
 * @returns {string[]}
 */
export function extractDominantColors(data, k = 5, maxIter = 8) {
  const step = Math.max(4, Math.floor(data.length / (4 * 1500)) * 4);
  /** @type {[number, number, number][]} */
  const points = [];
  for (let i = 0; i < data.length; i += step) {
    if ((data[i + 3] ?? 255) > 128) points.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!points.length) return ['#0b0e1a', '#3ef0ff', '#b36bff'];

  /** @type {[number, number, number][]} */
  const centroids = Array.from({ length: k }, (_, i) => [...points[Math.floor((i * points.length) / k)]]);
  for (let iter = 0; iter < maxIter; iter++) {
    /** @type {[number, number, number][][]} */
    const clusters = Array.from({ length: k }, () => []);
    for (const p of points) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = Math.hypot(p[0] - centroids[c][0], p[1] - centroids[c][1], p[2] - centroids[c][2]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      clusters[best].push(p);
    }
    let changed = false;
    for (let c = 0; c < k; c++) {
      const list = clusters[c];
      if (!list.length) continue;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (const p of list) {
        sr += p[0];
        sg += p[1];
        sb += p[2];
      }
      const next = /** @type {[number, number, number]} */ ([
        Math.round(sr / list.length),
        Math.round(sg / list.length),
        Math.round(sb / list.length),
      ]);
      if (next[0] !== centroids[c][0] || next[1] !== centroids[c][1] || next[2] !== centroids[c][2]) {
        centroids[c] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return centroids.map((c) => rgbToHex(c[0], c[1], c[2]));
}

/**
 * Generates a WCAG-compliant ThemePalette from extracted colors or a seed color + harmony.
 * @param {{ seed: string, secondary?: string, scheme: 'dark' | 'light', harmony?: 'complementary' | 'analogous' | 'triadic' | 'monochromatic' }} options
 */
export function buildThemeColors({ seed, secondary, scheme, harmony = 'complementary' }) {
  const [r, g, b] = hexToRgb(seed);
  const [h, s] = rgbToHsl(r, g, b);
  const sat = Math.max(s, 45);
  const secHue =
    harmony === 'triadic'
      ? (h + 120) % 360
      : harmony === 'analogous'
        ? (h + 36) % 360
        : harmony === 'monochromatic'
          ? h
          : (h + 180) % 360;

  const dark = scheme === 'dark';
  const bg = dark ? hslToHex(h, Math.min(sat, 36), 6) : hslToHex(h, Math.min(sat, 22), 96);
  const surface1 = dark ? hslToHex(h, Math.min(sat, 34), 10) : '#ffffff';
  const surface2 = dark ? hslToHex(h, Math.min(sat, 32), 14) : hslToHex(h, Math.min(sat, 20), 91);
  const surface3 = dark ? hslToHex(h, Math.min(sat, 30), 20) : hslToHex(h, Math.min(sat, 22), 85);
  const border = dark ? hslToHex(h, Math.min(sat, 45), 62) : hslToHex(h, Math.min(sat, 26), 44);
  const text1 = ensureContrast(dark ? '#eef2ff' : '#0f172a', bg, 7);
  const text2 = ensureContrast(dark ? mix('#eef2ff', border, 0.28) : mix('#0f172a', border, 0.25), surface2, 4.6);
  const text3 = ensureContrast(dark ? mix('#eef2ff', border, 0.45) : mix('#0f172a', border, 0.42), surface3, 4.5);

  const rawAccent = hslToHex(h, Math.max(sat, 65), dark ? 64 : 42);
  const accent = ensureContrast(rawAccent, surface3, 3.2);
  const rawAccent2 = secondary || hslToHex(secHue, Math.max(sat, 60), dark ? 68 : 46);
  const accent2 = ensureContrast(rawAccent2, surface3, 3.2);

  return {
    bg,
    surface1,
    surface2,
    surface3,
    border,
    text1,
    text2,
    text3,
    accent,
    accent2,
    success: ensureContrast(dark ? '#3ddc97' : '#157f4b', surface3, 3.1),
    warning: ensureContrast(dark ? '#ffc857' : '#9a5800', surface3, 3.1),
    danger: ensureContrast(dark ? '#ff5c7a' : '#c62839', surface3, 3.1),
    info: ensureContrast(dark ? '#6aa8ff' : '#1b5fd1', surface3, 3.1),
  };
}

/**
 * Evaluates contrast ratios across key foreground/background pairs (WCAG AA / AAA).
 * @param {import('../services/theme/themes.js').ThemePalette} colors
 */
export function auditThemeContrast(colors) {
  const bgs = [colors.bg, colors.surface1, colors.surface2, colors.surface3];
  const minRatio = (/** @type {string} */ fg) => Math.min(...bgs.map((bg) => contrastRatio(fg, bg)));
  const checks = [
    { id: 'text1', label: 'Primary text', fg: colors.text1, min: 4.5, aaa: 7, ratio: minRatio(colors.text1) },
    { id: 'text2', label: 'Secondary text', fg: colors.text2, min: 4.5, aaa: 7, ratio: minRatio(colors.text2) },
    { id: 'text3', label: 'Muted text', fg: colors.text3, min: 4.5, aaa: 7, ratio: minRatio(colors.text3) },
    { id: 'accent', label: 'Accent UI', fg: colors.accent, min: 3.0, aaa: 4.5, ratio: minRatio(colors.accent) },
    { id: 'success', label: 'Success UI', fg: colors.success, min: 3.0, aaa: 4.5, ratio: minRatio(colors.success) },
    { id: 'warning', label: 'Warning UI', fg: colors.warning, min: 3.0, aaa: 4.5, ratio: minRatio(colors.warning) },
    { id: 'danger', label: 'Danger UI', fg: colors.danger, min: 3.0, aaa: 4.5, ratio: minRatio(colors.danger) },
    { id: 'info', label: 'Info UI', fg: colors.info, min: 3.0, aaa: 4.5, ratio: minRatio(colors.info) },
  ].map((c) => ({
    ...c,
    passAA: c.ratio >= c.min,
    passAAA: c.ratio >= c.aaa,
  }));
  return {
    checks,
    allAA: checks.every((c) => c.passAA),
    allAAA: checks.every((c) => c.passAAA),
  };
}
