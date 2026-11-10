// @ts-check
// Pure color math conversions: HEX, RGB, HSL, HSV, CMYK, OKLCH, Named CSS colors,
// WCAG 2.x and APCA contrast, color harmonies, color blindness simulation, and k-means image extraction.

export const CSS_NAMED_COLORS = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
  orange: '#ffa500',
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  blanchedalmond: '#ffebcd',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  greenyellow: '#adff2f',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  oldlace: '#fdf5e6',
  olivedrab: '#6b8e23',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  rebeccapurple: '#663399',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  whitesmoke: '#f5f5f5',
  yellowgreen: '#9acd32',
};

/** @param {number} n @param {number} min @param {number} max */
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * Parses any valid color string into RGBA [0-255, 0-255, 0-255, 0-1].
 * @param {string} str
 * @returns {[number, number, number, number] | null}
 */
export function parseColor(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();

  // CSS named
  if (CSS_NAMED_COLORS[s]) {
    return parseColor(CSS_NAMED_COLORS[s]);
  }

  // Hex
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b, a];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b, a];
    }
    return null;
  }

  // rgb/rgba
  const rgbMatch = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    const r = clamp(parseFloat(rgbMatch[1]), 0, 255);
    const g = clamp(parseFloat(rgbMatch[2]), 0, 255);
    const b = clamp(parseFloat(rgbMatch[3]), 0, 255);
    const a = rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1;
    return [r, g, b, a];
  }

  // hsl/hsla
  const hslMatch = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const sat = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    const a = hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1;
    const [r, g, b] = hslToRgb(h, sat, l);
    return [r, g, b, a];
  }

  return null;
}

/**
 * Converts RGB [0-255] to Hex.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a=1]
 */
export function rgbToHex(r, g, b, a = 1) {
  const h = (/** @type {number} */ n) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  if (a < 1) {
    const aHex = Math.round(clamp(a, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${base}${aHex}`;
  }
  return base;
}

/**
 * Converts RGB [0-255] to HSL [H: 0-360, S: 0-100, L: 0-100].
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
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
    switch (max) {
      case rd:
        h = (gd - bd) / d + (gd < bd ? 6 : 0);
        break;
      case gd:
        h = (bd - rd) / d + 2;
        break;
      case bd:
        h = (rd - gd) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Converts HSL [H: 0-360, S: 0-100, L: 0-100] to RGB [0-255].
 * @param {number} h
 * @param {number} s
 * @param {number} l
 */
export function hslToRgb(h, s, l) {
  const hd = (((h % 360) + 360) % 360) / 360;
  const sd = clamp(s, 0, 100) / 100;
  const ld = clamp(l, 0, 100) / 100;

  if (sd === 0) {
    const val = Math.round(ld * 255);
    return [val, val, val];
  }

  const hue2rgb = (/** @type {number} */ p, /** @type {number} */ q, /** @type {number} */ t) => {
    let td = t;
    if (td < 0) td += 1;
    if (td > 1) td -= 1;
    if (td < 1 / 6) return p + (q - p) * 6 * td;
    if (td < 1 / 2) return q;
    if (td < 2 / 3) return p + (q - p) * (2 / 3 - td) * 6;
    return p;
  };

  const q = ld < 0.5 ? ld * (1 + sd) : ld + sd - ld * sd;
  const p = 2 * ld - q;
  const r = hue2rgb(p, q, hd + 1 / 3);
  const g = hue2rgb(p, q, hd);
  const b = hue2rgb(p, q, hd - 1 / 3);

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts RGB to HSV [H: 0-360, S: 0-100, V: 0-100].
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function rgbToHsv(r, g, b) {
  const rd = r / 255;
  const gd = g / 255;
  const bd = b / 255;
  const max = Math.max(rd, gd, bd);
  const min = Math.min(rd, gd, bd);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rd:
        h = (gd - bd) / d + (gd < bd ? 6 : 0);
        break;
      case gd:
        h = (bd - rd) / d + 2;
        break;
      case bd:
        h = (rd - gd) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

/**
 * Converts RGB to CMYK [C: 0-100, M: 0-100, Y: 0-100, K: 0-100].
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function rgbToCmyk(r, g, b) {
  const rd = r / 255;
  const gd = g / 255;
  const bd = b / 255;
  const k = 1 - Math.max(rd, gd, bd);
  if (k === 1) return [0, 0, 0, 100];
  const c = (1 - rd - k) / (1 - k);
  const m = (1 - gd - k) / (1 - k);
  const y = (1 - bd - k) / (1 - k);
  return [Math.round(c * 100), Math.round(m * 100), Math.round(y * 100), Math.round(k * 100)];
}

/**
 * Converts sRGB [0-255] to OKLCH [L: 0-1, C: 0-0.4, H: 0-360].
 * Standard Oklab conversion.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function rgbToOklch(r, g, b) {
  // sRGB to linear sRGB
  const toLinear = (/** @type {number} */ c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear sRGB to LMS
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  // LMS to Oklab
  const oklabL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const oklabA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const oklabB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  // Oklab to OKLCH
  const c = Math.sqrt(oklabA * oklabA + oklabB * oklabB);
  let h = (Math.atan2(oklabB, oklabA) * 180) / Math.PI;
  if (h < 0) h += 360;

  return [Math.round(oklabL * 1000) / 1000, Math.round(c * 1000) / 1000, Math.round(h * 10) / 10];
}

/**
 * Relative luminance for WCAG contrast.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function relativeLuminance(r, g, b) {
  const sRGB = [r, g, b].map((v) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * WCAG 2.x Contrast Ratio between two RGB colors.
 * @param {[number, number, number]} rgb1
 * @param {[number, number, number]} rgb2
 */
export function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Simplified APCA contrast evaluation.
 * @param {[number, number, number]} txtRgb
 * @param {[number, number, number]} bgRgb
 */
export function apcaContrast(txtRgb, bgRgb) {
  const yTxt = relativeLuminance(txtRgb[0], txtRgb[1], txtRgb[2]);
  const yBg = relativeLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
  // Simple perceptually-scaled APCA estimate
  const deltaY = Math.pow(yBg, 0.56) - Math.pow(yTxt, 0.56);
  const score = Math.round(deltaY * 114);
  return score;
}

/**
 * Simulates color blindness on an RGB color.
 * Types: 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'
 * @param {[number, number, number]} rgb
 * @param {'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'} type
 * @returns {[number, number, number]}
 */
export function simulateColorBlindness([r, g, b], type) {
  if (type === 'achromatopsia') {
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return [gray, gray, gray];
  }
  let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (type === 'protanopia') {
    m = [0.56667, 0.43333, 0, 0.55833, 0.44167, 0, 0, 0.24167, 0.75833];
  } else if (type === 'deuteranopia') {
    m = [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7];
  } else if (type === 'tritanopia') {
    m = [0.95, 0.05, 0, 0, 0.43333, 0.56667, 0, 0.475, 0.525];
  }
  const nr = clamp(Math.round(r * m[0] + g * m[1] + b * m[2]), 0, 255);
  const ng = clamp(Math.round(r * m[3] + g * m[4] + b * m[5]), 0, 255);
  const nb = clamp(Math.round(r * m[6] + g * m[7] + b * m[8]), 0, 255);
  return [nr, ng, nb];
}

/**
 * Generates harmonic palettes based on a base color (RGB).
 * @param {[number, number, number]} baseRgb
 * @param {'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'monochromatic' | 'shades'} harmony
 */
export function generatePalette(baseRgb, harmony) {
  const [h, s, l] = rgbToHsl(baseRgb[0], baseRgb[1], baseRgb[2]);
  /** @type {string[]} */
  const colors = [];

  const add = (/** @type {number} */ hue, /** @type {number} */ sat, /** @type {number} */ light) => {
    const [r, g, b] = hslToRgb(hue, sat, light);
    colors.push(rgbToHex(r, g, b));
  };

  if (harmony === 'complementary') {
    add(h, s, l);
    add((h + 180) % 360, s, l);
    add(h, s * 0.7, Math.min(l + 20, 90));
    add((h + 180) % 360, s * 0.7, Math.min(l + 20, 90));
    add(h, s * 0.5, Math.max(l - 20, 10));
  } else if (harmony === 'analogous') {
    add((h - 30 + 360) % 360, s, l);
    add(h, s, l);
    add((h + 30) % 360, s, l);
    add((h + 60) % 360, s, l);
    add((h - 60 + 360) % 360, s, l);
  } else if (harmony === 'triadic') {
    add(h, s, l);
    add((h + 120) % 360, s, l);
    add((h + 240) % 360, s, l);
    add(h, s * 0.6, Math.min(l + 25, 90));
    add((h + 120) % 360, s * 0.6, Math.max(l - 25, 10));
  } else if (harmony === 'tetradic') {
    add(h, s, l);
    add((h + 90) % 360, s, l);
    add((h + 180) % 360, s, l);
    add((h + 270) % 360, s, l);
    add(h, Math.max(s - 30, 10), Math.min(l + 30, 90));
  } else if (harmony === 'monochromatic') {
    add(h, s, 20);
    add(h, s, 35);
    add(h, s, 50);
    add(h, s, 65);
    add(h, s, 80);
  } else if (harmony === 'shades') {
    add(h, s, Math.max(l - 30, 10));
    add(h, s, Math.max(l - 15, 10));
    add(h, s, l);
    add(h, s, Math.min(l + 15, 90));
    add(h, s, Math.min(l + 30, 90));
  }

  return colors;
}

/**
 * Extracts dominant colors from an ImageData array using k-means clustering.
 * @param {Uint8ClampedArray} data
 * @param {number} k count
 * @param {number} [maxIter=10]
 * @returns {string[]}
 */
export function extractKMeansColors(data, k = 5, maxIter = 10) {
  // Sample pixels to keep performance snappy
  const step = Math.max(4, Math.floor(data.length / (4 * 2000)) * 4);
  /** @type {[number, number, number][]} */
  const points = [];
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] > 128) {
      // ignore transparent
      points.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  if (points.length === 0) return ['#000000'];

  // Initialize centroids
  /** @type {[number, number, number][]} */
  let centroids = [];
  for (let i = 0; i < k; i++) {
    const p = points[Math.floor((i * points.length) / k)];
    centroids.push([...p]);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const clusters = Array.from({ length: k }, () => /** @type {[number, number, number][]} */ ([]));
    for (const p of points) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < k; c++) {
        const d = Math.hypot(p[0] - centroids[c][0], p[1] - centroids[c][1], p[2] - centroids[c][2]);
        if (d < minDist) {
          minDist = d;
          minIdx = c;
        }
      }
      clusters[minIdx].push(p);
    }

    // Recompute centroids
    let changed = false;
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (const p of clusters[c]) {
        sumR += p[0];
        sumG += p[1];
        sumB += p[2];
      }
      const len = clusters[c].length;
      const newCentroid = [Math.round(sumR / len), Math.round(sumG / len), Math.round(sumB / len)];
      if (
        newCentroid[0] !== centroids[c][0] ||
        newCentroid[1] !== centroids[c][1] ||
        newCentroid[2] !== centroids[c][2]
      ) {
        changed = true;
        centroids[c] = /** @type {[number, number, number]} */ (newCentroid);
      }
    }
    if (!changed) break;
  }

  return centroids.map((c) => rgbToHex(c[0], c[1], c[2]));
}
