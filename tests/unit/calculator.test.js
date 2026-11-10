import { describe, expect, it } from 'vitest';
import {
  computeStatistics,
  findRoot,
  formatProgrammerValues,
  performBitwiseOp,
  sampleGraphPoints,
  solveLinear2x2,
  solveQuadratic,
  toggleBit,
} from '../../src/apps/calculator/model.js';

describe('Calculator Model', () => {
  describe('Programmer Mode', () => {
    it('formats values across hex, dec, oct, bin correctly', () => {
      const formatted = formatProgrammerValues(255n, 16);
      expect(formatted.hex).toBe('FF');
      expect(formatted.dec).toBe('255');
      expect(formatted.oct).toBe('377');
      expect(formatted.bin).toBe('0000000011111111');
      expect(formatted.bits[0]).toBe(true);
      expect(formatted.bits[8]).toBe(false);
    });

    it('toggles bits accurately', () => {
      // 0n -> bit 3 on = 8n
      const val = toggleBit(0n, 3, 64);
      expect(val).toBe(8n);

      // 8n -> bit 3 off = 0n
      const toggledBack = toggleBit(val, 3, 64);
      expect(toggledBack).toBe(0n);
    });

    it('performs bitwise operations', () => {
      expect(performBitwiseOp('AND', 0b1100n, 0b1010n, 8)).toBe(0b1000n);
      expect(performBitwiseOp('OR', 0b1100n, 0b1010n, 8)).toBe(0b1110n);
      expect(performBitwiseOp('XOR', 0b1100n, 0b1010n, 8)).toBe(0b0110n);
      expect(performBitwiseOp('SHL', 1n, 4n, 8)).toBe(16n);
      expect(performBitwiseOp('SHR', 16n, 2n, 8)).toBe(4n);
    });
  });

  describe('Graphing & Root Finding', () => {
    it('samples points across range', () => {
      const points = sampleGraphPoints('x^2', -2, 2, 4);
      expect(points.length).toBe(5);
      expect(points[0].y).toBeCloseTo(4, 5); // (-2)^2 = 4
      expect(points[2].y).toBeCloseTo(0, 5); // 0^2 = 0
      expect(points[4].y).toBeCloseTo(4, 5); // 2^2 = 4
    });

    it('finds numerical root of f(x) = 0 using bisection', () => {
      // x^2 - 4 = 0 has a root at x = 2 in [0, 4]
      const root = findRoot('x^2 - 4', 0, 4);
      expect(root).toBeCloseTo(2, 4);
    });
  });

  describe('Equation Solvers', () => {
    it('solves 2x2 linear system', () => {
      // 2x + 3y = 8
      // 1x - 1y = 1
      // Solution: x = 2.2, y = 1.2
      const sol = solveLinear2x2(2, 3, 8, 1, -1, 1);
      expect(sol).not.toBeNull();
      expect(sol?.x).toBeCloseTo(2.2, 5);
      expect(sol?.y).toBeCloseTo(1.2, 5);
    });

    it('solves quadratic equation', () => {
      // x^2 - 5x + 6 = 0 -> roots 3 and 2
      const q = solveQuadratic(1, -5, 6);
      expect(q.isComplex).toBe(false);
      expect([q.real1, q.real2].sort()).toEqual([2, 3]);
    });
  });

  describe('Statistics Mode', () => {
    it('computes mean, median, variance, and standard deviation', () => {
      const nums = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = computeStatistics(nums);
      expect(stats.count).toBe(8);
      expect(stats.sum).toBe(40);
      expect(stats.mean).toBe(5);
      expect(stats.median).toBe(4.5);
      expect(stats.min).toBe(2);
      expect(stats.max).toBe(9);
      expect(stats.stdDev).toBeCloseTo(2, 1);
    });
  });
});
