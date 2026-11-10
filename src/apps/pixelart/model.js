// @ts-check
import { encodeGif } from './gif.js';

export const GRID_SIZES = [8, 16, 24, 32, 48, 64, 128];

export const RETRO_PALETTES = {
  pico8: {
    id: 'pico8',
    name: 'PICO-8',
    colors: [
      '#000000',
      '#1D2B53',
      '#7E2553',
      '#008751',
      '#AB5236',
      '#5F574F',
      '#C2C3C7',
      '#FFF1E8',
      '#FF004D',
      '#FFA300',
      '#FFEC27',
      '#00E436',
      '#29ADFF',
      '#83769C',
      '#FF77A8',
      '#FFCCAA',
    ],
  },
  gameboy: {
    id: 'gameboy',
    name: 'Game Boy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  c64: {
    id: 'c64',
    name: 'Commodore 64',
    colors: [
      '#000000',
      '#ffffff',
      '#880000',
      '#aaffee',
      '#cc44cc',
      '#00cc55',
      '#0000aa',
      '#eeee77',
      '#dd8855',
      '#664400',
      '#ff7777',
      '#333333',
      '#777777',
      '#aaff66',
      '#0088ff',
      '#bbbbbb',
    ],
  },
  nes: {
    id: 'nes',
    name: 'NES Classic',
    colors: [
      '#000000',
      '#fc9838',
      '#80d010',
      '#388800',
      '#0058f8',
      '#6844fc',
      '#d800cc',
      '#e40058',
      '#f83800',
      '#e45c10',
      '#ac7c00',
      '#00b800',
      '#00a844',
      '#008888',
      '#bcbcbc',
      '#ffffff',
    ],
  },
};

let nextFrameId = 1;
export function generateFrameId() {
  return `frame_${Date.now()}_${nextFrameId++}`;
}

/**
 * @typedef {object} PixelFrame
 * @property {string} id
 * @property {number} durationMs
 * @property {number[]} pixels   array of color indices (0 for transparent or palette index)
 */

/**
 * @typedef {object} PixelDoc
 * @property {number} version
 * @property {string} title
 * @property {number} width
 * @property {number} height
 * @property {number} fps
 * @property {string[]} palette
 * @property {PixelFrame[]} frames
 * @property {{ created: number, modified: number }} metadata
 */

/**
 * Create a new pixel art document.
 * @param {string} [title='Untitled Sprite']
 * @param {number} [width=16]
 * @param {number} [height=16]
 * @param {string[]} [palette=RETRO_PALETTES.pico8.colors]
 * @returns {PixelDoc}
 */
export function createPixelDoc(
  title = 'Untitled Sprite',
  width = 16,
  height = 16,
  palette = RETRO_PALETTES.pico8.colors,
) {
  const now = Date.now();
  const initialFrame = createBlankFrame(width, height, 125);
  return {
    version: 1,
    title,
    width,
    height,
    fps: 8,
    palette: [...palette],
    frames: [initialFrame],
    metadata: {
      created: now,
      modified: now,
    },
  };
}

/**
 * Create a blank frame initialized to -1 (transparent).
 * @param {number} width
 * @param {number} height
 * @param {number} [durationMs=125]
 * @returns {PixelFrame}
 */
export function createBlankFrame(width, height, durationMs = 125) {
  return {
    id: generateFrameId(),
    durationMs,
    pixels: new Array(width * height).fill(-1),
  };
}

/**
 * Clone a frame.
 * @param {PixelFrame} frame
 * @returns {PixelFrame}
 */
export function cloneFrame(frame) {
  return {
    id: generateFrameId(),
    durationMs: frame.durationMs,
    pixels: [...frame.pixels],
  };
}

/**
 * Serialize document to JSON string.
 * @param {PixelDoc} doc
 * @returns {string}
 */
export function serializePixelDoc(doc) {
  return JSON.stringify(doc, null, 2);
}

/**
 * Parse document from JSON string.
 * @param {string} jsonStr
 * @returns {PixelDoc}
 */
export function parsePixelDoc(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return createPixelDoc();
    const w = typeof data.width === 'number' && data.width > 0 ? data.width : 16;
    const h = typeof data.height === 'number' && data.height > 0 ? data.height : 16;
    return {
      version: typeof data.version === 'number' ? data.version : 1,
      title: typeof data.title === 'string' ? data.title : 'Untitled Sprite',
      width: w,
      height: h,
      fps: typeof data.fps === 'number' ? data.fps : 8,
      palette: Array.isArray(data.palette) && data.palette.length > 0 ? data.palette : RETRO_PALETTES.pico8.colors,
      frames:
        Array.isArray(data.frames) && data.frames.length > 0
          ? data.frames.map((f, i) => ({
              id: typeof f.id === 'string' ? f.id : `frame_${i}`,
              durationMs: typeof f.durationMs === 'number' ? f.durationMs : 125,
              pixels: Array.isArray(f.pixels) ? f.pixels : new Array(w * h).fill(-1),
            }))
          : [createBlankFrame(w, h)],
      metadata: {
        created: typeof data.metadata?.created === 'number' ? data.metadata.created : Date.now(),
        modified: typeof data.metadata?.modified === 'number' ? data.metadata.modified : Date.now(),
      },
    };
  } catch {
    return createPixelDoc();
  }
}

// ─── Drawing Algorithms ──────────────────────────────────────────────────

/**
 * Bresenham's Line Algorithm.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {{ x: number, y: number }[]}
 */
export function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let curX = x0;
  let curY = y0;

  while (true) {
    points.push({ x: curX, y: curY });
    if (curX === x1 && curY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      curX += sx;
    }
    if (e2 < dx) {
      err += dx;
      curY += sy;
    }
  }
  return points;
}

/**
 * Midpoint Circle Algorithm.
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {{ x: number, y: number }[]}
 */
export function bresenhamCircle(cx, cy, radius) {
  const points = [];
  let x = radius;
  let y = 0;
  let err = 0;

  while (x >= y) {
    points.push(
      { x: cx + x, y: cy + y },
      { x: cx + y, y: cy + x },
      { x: cx - y, y: cy + x },
      { x: cx - x, y: cy + y },
      { x: cx - x, y: cy - y },
      { x: cx - y, y: cy - x },
      { x: cx + y, y: cy - x },
      { x: cx + x, y: cy - y },
    );

    if (err <= 0) {
      y += 1;
      err += 2 * y + 1;
    }
    if (err > 0) {
      x -= 1;
      err -= 2 * x + 1;
    }
  }
  return points;
}

/**
 * 4-Way Queue-based Grid Flood Fill.
 * @param {number[]} pixels
 * @param {number} width
 * @param {number} height
 * @param {number} startX
 * @param {number} startY
 * @param {number} targetColorIndex
 */
export function floodFillGrid(pixels, width, height, startX, startY, targetColorIndex) {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
  const startPos = startY * width + startX;
  const originalColor = pixels[startPos];
  if (originalColor === targetColorIndex) return;

  const queue = [startX, startY];
  const visited = new Uint8Array(width * height);
  visited[startPos] = 1;

  while (queue.length > 0) {
    const cy = /** @type {number} */ (queue.pop());
    const cx = /** @type {number} */ (queue.pop());
    const pos = cy * width + cx;
    pixels[pos] = targetColorIndex;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nPos = ny * width + nx;
        if (!visited[nPos] && pixels[nPos] === originalColor) {
          visited[nPos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }
}

// ─── Export Functions ────────────────────────────────────────────────────

/**
 * Generate animated GIF bytes from PixelDoc.
 * @param {PixelDoc} doc
 * @returns {Uint8Array}
 */
export function generateAnimatedGif(doc) {
  // Convert hex palette to [R, G, B]
  const rgbPalette = doc.palette.map((hex) => {
    const num = parseInt(hex.replace('#', ''), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  });

  // Reserve index for transparency
  const transparentIndex = rgbPalette.length;
  rgbPalette.push([0, 0, 0]); // Background transparent sentinel

  const frames = doc.frames.map((frame) => {
    const indexedPixels = new Uint8Array(doc.width * doc.height);
    for (let i = 0; i < frame.pixels.length; i++) {
      const colIdx = frame.pixels[i];
      indexedPixels[i] = colIdx === -1 ? transparentIndex : colIdx;
    }
    return {
      pixels: indexedPixels,
      delayMs: frame.durationMs || 125,
    };
  });

  return encodeGif({
    width: doc.width,
    height: doc.height,
    frames,
    palette: rgbPalette,
    transparentIndex,
    loopCount: 0,
  });
}
