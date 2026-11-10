import { describe, expect, it } from 'vitest';
import {
  applyBlur,
  applyBrightnessContrast,
  applyGrayscale,
  applyHueSaturation,
  applyInvert,
  createPaintDoc,
  floodFill,
  parseColorToRgba,
  parsePaintDoc,
  serializePaintDoc,
} from '../../src/apps/paint/model.js';

describe('Nexus Paint Model & Image Adjustments', () => {
  describe('Document Creation & Serialization', () => {
    it('creates a new paint document with default layers and dimensions', () => {
      const doc = createPaintDoc('Artwork 1', 1024, 768);
      expect(doc.title).toBe('Artwork 1');
      expect(doc.width).toBe(1024);
      expect(doc.height).toBe(768);
      expect(doc.layers.length).toBe(1);
      expect(doc.layers[0].name).toBe('Background');
      expect(doc.metadata.created).toBeGreaterThan(0);
    });

    it('serializes and parses .npaint JSON document', () => {
      const doc = createPaintDoc('Concept Art', 800, 600);
      doc.layers.push({
        id: 'layer_2',
        name: 'Inking',
        visible: true,
        opacity: 0.8,
        blendMode: 'multiply',
        dataUrl: 'data:image/png;base64,sample',
      });
      const json = serializePaintDoc(doc);
      const parsed = parsePaintDoc(json);

      expect(parsed.title).toBe('Concept Art');
      expect(parsed.width).toBe(800);
      expect(parsed.layers.length).toBe(2);
      expect(parsed.layers[1].blendMode).toBe('multiply');
    });

    it('recovers cleanly from corrupted JSON', () => {
      const parsed = parsePaintDoc('corrupted');
      expect(parsed.title).toBe('Untitled Painting');
      expect(parsed.width).toBe(800);
      expect(parsed.layers.length).toBe(1);
    });
  });

  describe('Color Helpers', () => {
    it('parses hex colors to RGBA objects', () => {
      expect(parseColorToRgba('#ff0000', 1)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
      expect(parseColorToRgba('#00ff00', 0.5)).toEqual({ r: 0, g: 255, b: 0, a: 128 });
      expect(parseColorToRgba('#00f')).toEqual({ r: 0, g: 0, b: 255, a: 255 });
    });
  });

  describe('Image Adjustment Filters', () => {
    function createMockImageData(width, height, fill = [100, 150, 200, 255]) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = fill[0];
        data[i + 1] = fill[1];
        data[i + 2] = fill[2];
        data[i + 3] = fill[3];
      }
      return { width, height, data };
    }

    it('inverts color channels correctly', () => {
      const img = createMockImageData(2, 2, [50, 100, 200, 255]);
      // @ts-ignore
      applyInvert(img);

      expect(img.data[0]).toBe(205);
      expect(img.data[1]).toBe(155);
      expect(img.data[2]).toBe(55);
      expect(img.data[3]).toBe(255); // Alpha preserved
    });

    it('converts pixels to grayscale using standard luminance weights', () => {
      const img = createMockImageData(2, 2, [100, 100, 100, 255]);
      // @ts-ignore
      applyGrayscale(img);

      const expected = Math.round(0.299 * 100 + 0.587 * 100 + 0.114 * 100);
      expect(Math.round(img.data[0])).toBe(expected);
      expect(Math.round(img.data[1])).toBe(expected);
      expect(Math.round(img.data[2])).toBe(expected);
    });

    it('adjusts brightness and contrast', () => {
      const img = createMockImageData(2, 2, [100, 100, 100, 255]);
      // @ts-ignore
      applyBrightnessContrast(img, 20, 0);

      expect(img.data[0]).toBeGreaterThan(100);
      expect(img.data[1]).toBeGreaterThan(100);
    });

    it('adjusts hue and saturation', () => {
      const img = createMockImageData(2, 2, [255, 0, 0, 255]); // Pure red
      // @ts-ignore
      applyHueSaturation(img, 120, 0); // Rotate hue to green

      expect(img.data[1]).toBeGreaterThan(img.data[0]); // Green is now dominant
    });

    it('blurs adjacent pixels', () => {
      const img = createMockImageData(4, 4, [0, 0, 0, 255]);
      // Put a bright spot in middle
      const centerIdx = (1 * 4 + 1) * 4;
      img.data[centerIdx] = 255;
      img.data[centerIdx + 1] = 255;
      img.data[centerIdx + 2] = 255;

      // @ts-ignore
      applyBlur(img, 1);
      // Brightness should have spread to neighboring pixel
      const neighborIdx = (1 * 4 + 2) * 4;
      expect(img.data[neighborIdx]).toBeGreaterThan(0);
    });
  });

  describe('Flood Fill Algorithm', () => {
    it('fills contiguous pixels with new color', () => {
      const width = 4;
      const height = 4;
      const data = new Uint8ClampedArray(width * height * 4);
      // Fill all with white
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
      const img = { width, height, data };

      // @ts-ignore
      floodFill(img, 0, 0, { r: 255, g: 0, b: 0, a: 255 }, 20);

      // All pixels should now be red
      for (let i = 0; i < data.length; i += 4) {
        expect(data[i]).toBe(255);
        expect(data[i + 1]).toBe(0);
        expect(data[i + 2]).toBe(0);
        expect(data[i + 3]).toBe(255);
      }
    });
  });
});
