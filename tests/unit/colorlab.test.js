// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  apcaContrast,
  contrastRatio,
  extractKMeansColors,
  generatePalette,
  hslToRgb,
  parseColor,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  simulateColorBlindness,
} from '../../src/apps/colorlab/color-math.js';

describe('color-math', () => {
  it('parses hex, rgb, hsl and css named colors', () => {
    expect(parseColor('#ff0000')).toEqual([255, 0, 0, 1]);
    expect(parseColor('#00ff0080')).toEqual([0, 255, 0, 0.5019607843137255]);
    expect(parseColor('rgb(0, 0, 255)')).toEqual([0, 0, 255, 1]);
    expect(parseColor('hsl(120, 100%, 50%)')).toEqual([0, 255, 0, 1]);
    expect(parseColor('rebeccapurple')).toEqual([102, 51, 153, 1]);
  });

  it('converts RGB to HEX and back', () => {
    const hex = rgbToHex(255, 128, 0);
    expect(hex).toBe('#ff8000');
    expect(parseColor(hex)).toEqual([255, 128, 0, 1]);
  });

  it('converts RGB to HSL and back', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect([h, s, l]).toEqual([0, 100, 50]);
    const [r, g, b] = hslToRgb(h, s, l);
    expect([r, g, b]).toEqual([255, 0, 0]);
  });

  it('converts RGB to HSV and CMYK', () => {
    const [h, s, v] = rgbToHsv(0, 255, 0);
    expect([h, s, v]).toEqual([120, 100, 100]);
    const [c, m, y, k] = rgbToCmyk(255, 0, 255);
    expect([c, m, y, k]).toEqual([0, 100, 0, 0]);
  });

  it('converts to OKLCH', () => {
    const [l, c] = rgbToOklch(255, 255, 255);
    expect(l).toBe(1);
    expect(c).toBe(0);
  });

  it('calculates WCAG contrast ratio and APCA', () => {
    const black = [0, 0, 0];
    const white = [255, 255, 255];
    const ratio = contrastRatio(
      /** @type {[number, number, number]} */ (black),
      /** @type {[number, number, number]} */ (white),
    );
    expect(ratio).toBeCloseTo(21, 0);

    const apca = apcaContrast(
      /** @type {[number, number, number]} */ (black),
      /** @type {[number, number, number]} */ (white),
    );
    expect(apca).toBeGreaterThan(90);
  });

  it('generates harmonic palettes', () => {
    const palette = generatePalette([255, 0, 0], 'complementary');
    expect(palette.length).toBeGreaterThanOrEqual(2);
    expect(palette[0]).toBe('#ff0000');
  });

  it('simulates color blindness', () => {
    const sim = simulateColorBlindness([255, 0, 0], 'protanopia');
    expect(sim[0]).toBeLessThan(255);
  });

  it('extracts k-means colors from image data', () => {
    // 10x10 red image data
    const data = new Uint8ClampedArray(10 * 10 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const colors = extractKMeansColors(data, 2);
    expect(colors[0]).toBe('#ff0000');
  });
});
