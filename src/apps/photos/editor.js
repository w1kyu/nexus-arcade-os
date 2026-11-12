// @ts-check
import { stripExif } from './exif.js';

/**
 * Image editor operations on HTMLCanvasElement.
 */

/**
 * @typedef {object} Adjustments
 * @property {number} brightness - -100 to +100 (default 0)
 * @property {number} contrast - -100 to +100 (default 0)
 * @property {number} saturation - -100 to +100 (default 0)
 * @property {number} warmth - -100 to +100 (default 0)
 * @property {number} vignette - 0 to 100 (default 0)
 * @property {number} blur - 0 to 20 (default 0)
 */

export const DEFAULT_ADJUSTMENTS = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  vignette: 0,
  blur: 0,
};

export const PHOTO_PRESETS = {
  original: { ...DEFAULT_ADJUSTMENTS },
  vivid: { brightness: 5, contrast: 25, saturation: 35, warmth: 0, vignette: 0, blur: 0 },
  bw: { brightness: 0, contrast: 20, saturation: -100, warmth: 0, vignette: 10, blur: 0 },
  vintage: { brightness: -5, contrast: -10, saturation: -20, warmth: 35, vignette: 45, blur: 0 },
  cool: { brightness: 0, contrast: 15, saturation: 10, warmth: -40, vignette: 0, blur: 0 },
  warm: { brightness: 5, contrast: 15, saturation: 20, warmth: 40, vignette: 15, blur: 0 },
  cyberpunk: { brightness: 10, contrast: 45, saturation: 60, warmth: -20, vignette: 30, blur: 0 },
};

/**
 * Rotates an image canvas by 90 degrees clockwise.
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement}
 */
export function rotateCanvas(canvas) {
  const next = document.createElement('canvas');
  next.width = canvas.height;
  next.height = canvas.width;
  const ctx = next.getContext('2d');
  if (!ctx) return canvas;

  ctx.translate(next.width / 2, next.height / 2);
  ctx.rotate((90 * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return next;
}

/**
 * Flips canvas horizontally or vertically.
 * @param {HTMLCanvasElement} canvas
 * @param {'h' | 'v'} dir
 * @returns {HTMLCanvasElement}
 */
export function flipCanvas(canvas, dir = 'h') {
  const next = document.createElement('canvas');
  next.width = canvas.width;
  next.height = canvas.height;
  const ctx = next.getContext('2d');
  if (!ctx) return canvas;

  if (dir === 'h') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, 0);
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(canvas, 0, 0);
  return next;
}

/**
 * Crops a canvas region.
 * @param {HTMLCanvasElement} canvas
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
export function cropCanvas(canvas, x, y, w, h) {
  const next = document.createElement('canvas');
  next.width = Math.max(1, Math.round(w));
  next.height = Math.max(1, Math.round(h));
  const ctx = next.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(canvas, x, y, w, h, 0, 0, next.width, next.height);
  return next;
}

/**
 * Resizes canvas to target dimensions.
 * @param {HTMLCanvasElement} canvas
 * @param {number} targetW
 * @param {number} targetH
 * @returns {HTMLCanvasElement}
 */
export function resizeCanvas(canvas, targetW, targetH) {
  const next = document.createElement('canvas');
  next.width = Math.max(1, Math.round(targetW));
  next.height = Math.max(1, Math.round(targetH));
  const ctx = next.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, next.width, next.height);
  return next;
}

/**
 * Applies color adjustments and vignette to canvas.
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {Adjustments} adj
 * @returns {HTMLCanvasElement}
 */
export function applyAdjustments(sourceCanvas, adj) {
  const dest = document.createElement('canvas');
  dest.width = sourceCanvas.width;
  dest.height = sourceCanvas.height;
  const ctx = dest.getContext('2d');
  if (!ctx) return sourceCanvas;

  // Build CSS filter for brightness, contrast, saturation, blur
  const b = 1 + adj.brightness / 100;
  const c = 1 + adj.contrast / 100;
  const s = 1 + adj.saturation / 100;
  const blurPx = Math.max(0, adj.blur);

  ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) blur(${blurPx}px)`;
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none';

  // Warmth (color temperature: red vs blue shift)
  if (adj.warmth !== 0) {
    const imgData = ctx.getImageData(0, 0, dest.width, dest.height);
    const data = imgData.data;
    const shift = (adj.warmth / 100) * 30;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + shift)); // Red
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - shift)); // Blue
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Vignette effect
  if (adj.vignette > 0) {
    const w = dest.width;
    const h = dest.height;
    const radius = Math.sqrt(w * w + h * h) / 2;
    const grad = ctx.createRadialGradient(w / 2, h / 2, radius * 0.4, w / 2, h / 2, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, `rgba(0, 0, 0, ${adj.vignette / 100})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  return dest;
}

/**
 * Pixelates a rectangular area on a canvas for privacy redaction.
 * @param {HTMLCanvasElement} canvas
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [blockSize]
 */
export function pixelateArea(canvas, x, y, w, h, blockSize = 12) {
  const ctx = canvas.getContext('2d');
  if (!ctx || w <= 0 || h <= 0) return;

  const rx = Math.max(0, Math.round(x));
  const ry = Math.max(0, Math.round(y));
  const rw = Math.min(canvas.width - rx, Math.round(w));
  const rh = Math.min(canvas.height - ry, Math.round(h));

  const sub = cropCanvas(canvas, rx, ry, rw, rh);
  const tinyW = Math.max(1, Math.round(rw / blockSize));
  const tinyH = Math.max(1, Math.round(rh / blockSize));

  const tiny = resizeCanvas(sub, tinyW, tinyH);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, rx, ry, rw, rh);
  ctx.imageSmoothingEnabled = true;
}

/**
 * Draws an annotation arrow on canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {string} [color]
 * @param {number} [width]
 */
export function drawArrow(canvas, fromX, fromY, toX, toY, color = '#f43f5e', width = 4) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const headlen = 16;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draws text label on canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} [color]
 * @param {number} [fontSize]
 */
export function drawTextAnnotation(canvas, text, x, y, color = '#facc15', fontSize = 24) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !text) return;

  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Exports canvas to Blob, optionally stripping EXIF data.
 * @param {HTMLCanvasElement} canvas
 * @param {string} [mimeType]
 * @param {number} [quality]
 * @param {boolean} [stripExifData]
 * @returns {Promise<Blob>}
 */
export async function exportPhoto(canvas, mimeType = 'image/jpeg', quality = 0.92, stripExifData = false) {
  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        if (stripExifData && mimeType === 'image/jpeg') {
          const buffer = await blob.arrayBuffer();
          const cleanBuf = stripExif(buffer);
          resolve(new Blob([cleanBuf], { type: mimeType }));
        } else {
          resolve(blob);
        }
      },
      mimeType,
      quality,
    );
  });
}
