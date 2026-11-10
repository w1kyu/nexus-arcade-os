import { describe, expect, it } from 'vitest';
import { arabicToRoman, convertBase, convertUnit, romanToArabic } from '../../src/apps/converter/model.js';

describe('Unit Converter Model', () => {
  it('converts lengths accurately', () => {
    expect(convertUnit(1000, 'm', 'km', 'length')).toBe(1);
    expect(convertUnit(1, 'in', 'cm', 'length')).toBeCloseTo(2.54, 4);
    expect(convertUnit(1, 'mi', 'km', 'length')).toBeCloseTo(1.609344, 4);
  });

  it('correctly distinguishes SI and IEC data sizes', () => {
    // SI: 1 kB = 1000 B
    expect(convertUnit(1, 'kB', 'B', 'datasize')).toBe(1000);
    // IEC: 1 KiB = 1024 B
    expect(convertUnit(1, 'KiB', 'B', 'datasize')).toBe(1024);

    // 1 MiB (1,048,576 B) converted to kB (1000 B) = 1048.576 kB
    expect(convertUnit(1, 'MiB', 'kB', 'datasize')).toBeCloseTo(1048.576, 2);

    // 1 GiB = 1024 MiB
    expect(convertUnit(1, 'GiB', 'MiB', 'datasize')).toBe(1024);
  });

  it('converts temperatures (Celsius, Fahrenheit, Kelvin)', () => {
    expect(convertUnit(0, 'C', 'F', 'temperature')).toBe(32);
    expect(convertUnit(100, 'C', 'F', 'temperature')).toBe(212);
    expect(convertUnit(32, 'F', 'C', 'temperature')).toBe(0);
    expect(convertUnit(0, 'C', 'K', 'temperature')).toBe(273.15);
  });

  it('converts cooking units', () => {
    expect(convertUnit(1, 'tbsp', 'ml', 'cooking')).toBe(15);
    expect(convertUnit(1, 'tsp', 'ml', 'cooking')).toBe(5);
    expect(convertUnit(1, 'cup', 'ml', 'cooking')).toBe(240);
  });

  it('converts Arabic and Roman numerals both ways', () => {
    expect(arabicToRoman(2026)).toBe('MMXXVI');
    expect(romanToArabic('MMXXVI')).toBe(2026);

    expect(arabicToRoman(1999)).toBe('MCMXCIX');
    expect(romanToArabic('MCMXCIX')).toBe(1999);

    expect(arabicToRoman(4)).toBe('IV');
    expect(romanToArabic('IV')).toBe(4);

    expect(arabicToRoman(9)).toBe('IX');
    expect(romanToArabic('IX')).toBe(9);
  });

  it('converts across number bases (2, 8, 10, 16)', () => {
    expect(convertBase('42', 10, 2)).toBe('101010');
    expect(convertBase('42', 10, 16)).toBe('2A');
    expect(convertBase('42', 10, 8)).toBe('52');
    expect(convertBase('2A', 16, 10)).toBe('42');
  });
});
