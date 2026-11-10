// @ts-check

/**
 * @typedef {object} SerializedLayer
 * @property {string} id
 * @property {string} name
 * @property {boolean} visible
 * @property {number} opacity
 * @property {GlobalCompositeOperation} blendMode
 * @property {string} dataUrl
 */

/**
 * @typedef {object} SerializedPaintDoc
 * @property {number} version
 * @property {string} title
 * @property {number} width
 * @property {number} height
 * @property {SerializedLayer[]} layers
 * @property {{ created: number, modified: number }} metadata
 */

export const PRESET_PALETTES = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#78350f',
];

let nextLayerId = 1;
export function generateLayerId(prefix = 'layer') {
  return `${prefix}_${Date.now()}_${nextLayerId++}`;
}

/**
 * Create a new paint document structure.
 * @param {string} [title='Untitled Painting']
 * @param {number} [width=800]
 * @param {number} [height=600]
 * @returns {SerializedPaintDoc}
 */
export function createPaintDoc(title = 'Untitled Painting', width = 800, height = 600) {
  const now = Date.now();
  return {
    version: 1,
    title,
    width,
    height,
    layers: [
      {
        id: 'layer_bg',
        name: 'Background',
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        dataUrl: '', // Will be filled with white background
      },
    ],
    metadata: {
      created: now,
      modified: now,
    },
  };
}

/**
 * Serialize document to JSON string.
 * @param {SerializedPaintDoc} doc
 * @returns {string}
 */
export function serializePaintDoc(doc) {
  return JSON.stringify(doc, null, 2);
}

/**
 * Parse paint doc from JSON string.
 * @param {string} jsonStr
 * @returns {SerializedPaintDoc}
 */
export function parsePaintDoc(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return createPaintDoc();
    return {
      version: typeof data.version === 'number' ? data.version : 1,
      title: typeof data.title === 'string' ? data.title : 'Untitled Painting',
      width: typeof data.width === 'number' && data.width > 0 ? data.width : 800,
      height: typeof data.height === 'number' && data.height > 0 ? data.height : 600,
      layers: Array.isArray(data.layers) ? data.layers : [],
      metadata: {
        created: typeof data.metadata?.created === 'number' ? data.metadata.created : Date.now(),
        modified: typeof data.metadata?.modified === 'number' ? data.metadata.modified : Date.now(),
      },
    };
  } catch {
    return createPaintDoc();
  }
}

// ─── Image Adjustments & Pixel Processing ─────────────────────────────────

/**
 * Apply Brightness and Contrast adjustments.
 * @param {ImageData} imageData
 * @param {number} brightness -100 to 100
 * @param {number} contrast -100 to 100
 * @returns {ImageData}
 */
export function applyBrightnessContrast(imageData, brightness, contrast) {
  const d = imageData.data;
  // contrast factor: -100..100 -> factor
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const b = brightness * (255 / 100);

  for (let i = 0; i < d.length; i += 4) {
    // RGB
    d[i] = Math.max(0, Math.min(255, factor * (d[i] - 128) + 128 + b));
    d[i + 1] = Math.max(0, Math.min(255, factor * (d[i + 1] - 128) + 128 + b));
    d[i + 2] = Math.max(0, Math.min(255, factor * (d[i + 2] - 128) + 128 + b));
  }
  return imageData;
}

/**
 * Apply Invert filter.
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function applyInvert(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  return imageData;
}

/**
 * Apply Grayscale filter.
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function applyGrayscale(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }
  return imageData;
}

/**
 * Apply Hue and Saturation adjustments.
 * @param {ImageData} imageData
 * @param {number} hueShift -180 to 180 degrees
 * @param {number} satShift -100 to 100
 * @returns {ImageData}
 */
export function applyHueSaturation(imageData, hueShift, satShift) {
  const d = imageData.data;
  const satFactor = 1 + satShift / 100;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;

    // RGB to HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / delta + 2) / 6;
      else h = ((r - g) / delta + 4) / 6;
    }

    // Shift
    h = (h + hueShift / 360 + 1) % 1;
    s = Math.max(0, Math.min(1, s * satFactor));

    // HSL to RGB
    let nr, ng, nb;
    if (s === 0) {
      nr = ng = nb = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      nr = hueToRgb(p, q, h + 1 / 3);
      ng = hueToRgb(p, q, h);
      nb = hueToRgb(p, q, h - 1 / 3);
    }

    d[i] = Math.round(nr * 255);
    d[i + 1] = Math.round(ng * 255);
    d[i + 2] = Math.round(nb * 255);
  }
  return imageData;
}

function hueToRgb(p, q, t) {
  let v = t;
  if (v < 0) v += 1;
  if (v > 1) v -= 1;
  if (v < 1 / 6) return p + (q - p) * 6 * v;
  if (v < 1 / 2) return q;
  if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
  return p;
}

/**
 * Apply Box Blur filter.
 * @param {ImageData} imageData
 * @param {number} radius (e.g. 1 to 5)
 * @returns {ImageData}
 */
export function applyBlur(imageData, radius = 2) {
  if (radius <= 0) return imageData;
  const w = imageData.width;
  const h = imageData.height;
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;

  // Horizontal blur pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;
      for (let kx = -radius; kx <= radius; kx++) {
        const px = Math.min(w - 1, Math.max(0, x + kx));
        const idx = (y * w + px) * 4;
        r += src[idx];
        g += src[idx + 1];
        b += src[idx + 2];
        a += src[idx + 3];
        count++;
      }
      const didx = (y * w + x) * 4;
      dst[didx] = Math.round(r / count);
      dst[didx + 1] = Math.round(g / count);
      dst[didx + 2] = Math.round(b / count);
      dst[didx + 3] = Math.round(a / count);
    }
  }

  return imageData;
}

// ─── Flood Fill Algorithm ────────────────────────────────────────────────

/**
 * 4-Way Queue-based Flood Fill.
 * @param {ImageData} imageData
 * @param {number} startX
 * @param {number} startY
 * @param {{ r: number, g: number, b: number, a: number }} fillColor
 * @param {number} [tolerance=20] 0 to 255
 */
export function floodFill(imageData, startX, startY, fillColor, tolerance = 20) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

  const startIdx = (startY * w + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  if (
    colorDistance(targetR, targetG, targetB, targetA, fillColor.r, fillColor.g, fillColor.b, fillColor.a) <= tolerance
  ) {
    return;
  }

  const queue = [startX, startY];
  const visited = new Uint8Array(w * h);
  visited[startY * w + startX] = 1;

  while (queue.length > 0) {
    const cy = /** @type {number} */ (queue.pop());
    const cx = /** @type {number} */ (queue.pop());

    const idx = (cy * w + cx) * 4;
    data[idx] = fillColor.r;
    data[idx + 1] = fillColor.g;
    data[idx + 2] = fillColor.b;
    data[idx + 3] = fillColor.a;

    // Check 4 neighbours
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nPos = ny * w + nx;
        if (!visited[nPos]) {
          visited[nPos] = 1;
          const nIdx = nPos * 4;
          if (
            colorDistance(
              data[nIdx],
              data[nIdx + 1],
              data[nIdx + 2],
              data[nIdx + 3],
              targetR,
              targetG,
              targetB,
              targetA,
            ) <= tolerance
          ) {
            queue.push(nx, ny);
          }
        }
      }
    }
  }
}

function colorDistance(r1, g1, b1, a1, r2, g2, b2, a2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2 + (a1 - a2) ** 2) / 2;
}

/**
 * Parse hex color '#rrggbb' or rgb into RGBA object.
 * @param {string} hex
 * @param {number} [opacity=1]
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function parseColorToRgba(hex, opacity = 1) {
  let c = hex.replace(/^#/, '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: Math.round(opacity * 255),
  };
}
