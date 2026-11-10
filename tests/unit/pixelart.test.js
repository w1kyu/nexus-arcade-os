import { describe, expect, it } from 'vitest';
import { encodeGif } from '../../src/apps/pixelart/gif.js';
import {
  bresenhamCircle,
  bresenhamLine,
  cloneFrame,
  createBlankFrame,
  createPixelDoc,
  floodFillGrid,
  generateAnimatedGif,
  parsePixelDoc,
  RETRO_PALETTES,
  serializePixelDoc,
} from '../../src/apps/pixelart/model.js';

describe('Pixel Art Studio Model & Algorithms', () => {
  describe('Document Creation & Serialization', () => {
    it('creates a new pixel art document with default frames and palette', () => {
      const doc = createPixelDoc('Player Sprite', 16, 16);
      expect(doc.title).toBe('Player Sprite');
      expect(doc.width).toBe(16);
      expect(doc.height).toBe(16);
      expect(doc.frames.length).toBe(1);
      expect(doc.frames[0].pixels.length).toBe(256);
      expect(doc.frames[0].pixels[0]).toBe(-1); // Transparent
      expect(doc.palette).toEqual(RETRO_PALETTES.pico8.colors);
    });

    it('clones and creates blank frames properly', () => {
      const blank = createBlankFrame(8, 8, 200);
      expect(blank.pixels.length).toBe(64);
      expect(blank.durationMs).toBe(200);

      blank.pixels[0] = 5;
      const cloned = cloneFrame(blank);
      expect(cloned.pixels[0]).toBe(5);
      expect(cloned.id).not.toBe(blank.id);
      cloned.pixels[0] = 9;
      expect(blank.pixels[0]).toBe(5); // independent copy
    });

    it('serializes and parses .npixel document', () => {
      const doc = createPixelDoc('Coin Animation', 8, 8);
      doc.frames[0].pixels[10] = 2;
      doc.frames.push(createBlankFrame(8, 8));

      const json = serializePixelDoc(doc);
      const parsed = parsePixelDoc(json);

      expect(parsed.title).toBe('Coin Animation');
      expect(parsed.width).toBe(8);
      expect(parsed.height).toBe(8);
      expect(parsed.frames.length).toBe(2);
      expect(parsed.frames[0].pixels[10]).toBe(2);
    });

    it('recovers gracefully from corrupted JSON', () => {
      const parsed = parsePixelDoc('not valid json');
      expect(parsed.title).toBe('Untitled Sprite');
      expect(parsed.width).toBe(16);
      expect(parsed.frames.length).toBe(1);
    });
  });

  describe('Drawing Algorithms', () => {
    it('computes Bresenham line for diagonal and straight lines', () => {
      const horizontal = bresenhamLine(0, 5, 4, 5);
      expect(horizontal).toEqual([
        { x: 0, y: 5 },
        { x: 1, y: 5 },
        { x: 2, y: 5 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
      ]);

      const diagonal = bresenhamLine(1, 1, 3, 3);
      expect(diagonal).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]);
    });

    it('computes Bresenham circle points', () => {
      const circlePts = bresenhamCircle(5, 5, 2);
      expect(circlePts.length).toBeGreaterThan(0);
      // Ensure all points lie near radius 2
      circlePts.forEach((p) => {
        const dist = Math.hypot(p.x - 5, p.y - 5);
        expect(Math.abs(dist - 2)).toBeLessThanOrEqual(0.7);
      });
    });

    it('performs 4-way flood fill on grid pixels', () => {
      const width = 4;
      const height = 4;
      // 4x4 grid: all 0
      const pixels = new Array(width * height).fill(0);
      // Place a barrier of color 1 at row 1
      pixels[1 * 4 + 0] = 1;
      pixels[1 * 4 + 1] = 1;
      pixels[1 * 4 + 2] = 1;
      pixels[1 * 4 + 3] = 1;

      // Fill top row with color 3
      floodFillGrid(pixels, width, height, 0, 0, 3);
      expect(pixels[0]).toBe(3);
      expect(pixels[1]).toBe(3);
      expect(pixels[2]).toBe(3);
      expect(pixels[3]).toBe(3);
      // Barrier remains 1
      expect(pixels[4]).toBe(1);
      // Bottom rows remained 0
      expect(pixels[8]).toBe(0);
      expect(pixels[15]).toBe(0);
    });
  });

  describe('Animated GIF Encoding', () => {
    it('encodes a valid GIF89a header and application loop extension', () => {
      const palette = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ];
      const frame1 = {
        pixels: new Uint8Array([0, 1, 2, 0]),
        delayMs: 100,
      };
      const gifBytes = encodeGif({
        width: 2,
        height: 2,
        frames: [frame1],
        palette,
        transparentIndex: 3,
        loopCount: 0,
      });

      expect(gifBytes instanceof Uint8Array).toBe(true);
      expect(gifBytes.length).toBeGreaterThan(50);
      // GIF89a header
      const header = String.fromCharCode(...gifBytes.slice(0, 6));
      expect(header).toBe('GIF89a');
      // Trailer byte 0x3B
      expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);
    });

    it('generates multi-frame animated GIF from PixelDoc', () => {
      const doc = createPixelDoc('Animated Heart', 4, 4);
      // Frame 1
      doc.frames[0].pixels[5] = 8; // Pico-8 red
      // Frame 2
      const f2 = createBlankFrame(4, 4, 150);
      f2.pixels[5] = 8;
      f2.pixels[6] = 8;
      doc.frames.push(f2);

      const gifBytes = generateAnimatedGif(doc);
      expect(gifBytes.length).toBeGreaterThan(60);
      const header = String.fromCharCode(...gifBytes.slice(0, 6));
      expect(header).toBe('GIF89a');
      expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);
    });
  });
});
