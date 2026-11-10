// @ts-check
// Calculator model: Programmer mode (8/16/32/64-bit BigInt math, bitwise ops, bases),
// Graphing mode point sampling & root finding, Matrix & Equation solvers, and Statistics.
import { evaluateWith } from '../../ui/calc.js';

/** @typedef {8 | 16 | 32 | 64} WordSize */

const WORD_MASKS = {
  8: 0xffn,
  16: 0xffffn,
  32: 0xffffffffn,
  64: 0xffffffffffffffffn,
};

/**
 * Truncates a BigInt value to the specified word size.
 * @param {bigint} val
 * @param {WordSize} wordSize
 * @returns {bigint}
 */
export function maskToWordSize(val, wordSize) {
  const mask = WORD_MASKS[wordSize];
  return val & mask;
}

/**
 * Formats a BigInt into programmer representations across all 4 bases.
 * @param {bigint} val
 * @param {WordSize} wordSize
 * @param {boolean} [isSigned]
 * @returns {{
 *   hex: string,
 *   dec: string,
 *   oct: string,
 *   bin: string,
 *   bits: boolean[]
 * }}
 */
export function formatProgrammerValues(val, wordSize, isSigned = false) {
  const unsigned = maskToWordSize(val, wordSize);
  let decStr;

  if (isSigned) {
    const signBit = 1n << BigInt(wordSize - 1);
    if ((unsigned & signBit) !== 0n) {
      // Negative
      const signedVal = unsigned - (1n << BigInt(wordSize));
      decStr = signedVal.toString(10);
    } else {
      decStr = unsigned.toString(10);
    }
  } else {
    decStr = unsigned.toString(10);
  }

  const hexStr = unsigned.toString(16).toUpperCase();
  const octStr = unsigned.toString(8);
  const binStr = unsigned.toString(2).padStart(wordSize, '0');

  // Array of bits from bit 0 to bit wordSize-1
  const bits = [];
  for (let i = 0; i < wordSize; i++) {
    bits.push(((unsigned >> BigInt(i)) & 1n) === 1n);
  }

  return {
    hex: hexStr,
    dec: decStr,
    oct: octStr,
    bin: binStr,
    bits,
  };
}

/**
 * Toggles bit at position `bitIndex` in a BigInt value.
 * @param {bigint} val
 * @param {number} bitIndex
 * @param {WordSize} wordSize
 * @returns {bigint}
 */
export function toggleBit(val, bitIndex, wordSize) {
  const bit = 1n << BigInt(bitIndex);
  const masked = maskToWordSize(val ^ bit, wordSize);
  return masked;
}

/**
 * Performs a bitwise operation on BigInts within word size.
 * @param {'AND' | 'OR' | 'XOR' | 'NOT' | 'SHL' | 'SHR'} op
 * @param {bigint} a
 * @param {bigint} [b]
 * @param {WordSize} wordSize
 * @returns {bigint}
 */
export function performBitwiseOp(op, a, b = 0n, wordSize = 64) {
  let res = 0n;
  if (op === 'NOT') res = ~a;
  else if (op === 'AND') res = a & b;
  else if (op === 'OR') res = a | b;
  else if (op === 'XOR') res = a ^ b;
  else if (op === 'SHL') res = a << (b & 63n);
  else if (op === 'SHR') res = a >> (b & 63n);
  return maskToWordSize(res, wordSize);
}

/**
 * Samples points of f(x) for graphing across [xMin, xMax].
 * @param {string} expr
 * @param {number} xMin
 * @param {number} xMax
 * @param {number} [steps]
 * @returns {Array<{ x: number, y: number | null }>}
 */
export function sampleGraphPoints(expr, xMin, xMax, steps = 200) {
  const points = [];
  const dx = (xMax - xMin) / steps;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    const y = evaluateWith(expr, { x });
    points.push({ x, y: y !== null && Number.isFinite(y) ? y : null });
  }
  return points;
}

/**
 * Finds a numerical root for f(x) = 0 in [a, b] using bisection.
 * @param {string} expr
 * @param {number} a
 * @param {number} b
 * @param {number} [tolerance]
 * @returns {number | null}
 */
export function findRoot(expr, a, b, tolerance = 1e-6) {
  let fa = evaluateWith(expr, { x: a });
  let fb = evaluateWith(expr, { x: b });
  if (fa === null || fb === null) return null;
  if (Math.abs(fa) < tolerance) return a;
  if (Math.abs(fb) < tolerance) return b;
  if (fa * fb > 0) return null; // no guaranteed root with bisection

  for (let iter = 0; iter < 100; iter++) {
    const mid = (a + b) / 2;
    const fmid = evaluateWith(expr, { x: mid });
    if (fmid === null) return null;
    if (Math.abs(fmid) < tolerance || (b - a) / 2 < tolerance) {
      return Number(mid.toFixed(6));
    }
    if (fa * fmid < 0) {
      b = mid;
    } else {
      a = mid;
      fa = fmid;
    }
  }
  return Number(((a + b) / 2).toFixed(6));
}

/**
 * Solves a 2x2 linear equation system:
 * a1*x + b1*y = c1
 * a2*x + b2*y = c2
 * @returns {{ x: number, y: number } | null}
 */
export function solveLinear2x2(a1, b1, c1, a2, b2, c2) {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return null; // singular
  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  return { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
}

/**
 * Solves a quadratic equation: a*x^2 + b*x + c = 0.
 * @returns {{ real1: number, real2: number, isComplex: boolean }}
 */
export function solveQuadratic(a, b, c) {
  if (a === 0) {
    const root = -c / b;
    return { real1: root, real2: root, isComplex: false };
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    return { real1: -b / (2 * a), real2: Math.sqrt(-disc) / (2 * a), isComplex: true };
  }
  const sqrtD = Math.sqrt(disc);
  return {
    real1: Number(((-b + sqrtD) / (2 * a)).toFixed(6)),
    real2: Number(((-b - sqrtD) / (2 * a)).toFixed(6)),
    isComplex: false,
  };
}

/**
 * Computes descriptive statistics on a list of numbers.
 * @param {number[]} nums
 * @returns {{
 *   count: number,
 *   sum: number,
 *   mean: number,
 *   median: number,
 *   min: number,
 *   max: number,
 *   variance: number,
 *   stdDev: number
 * }}
 */
export function computeStatistics(nums) {
  if (nums.length === 0) {
    return { count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, variance: 0, stdDev: 0 };
  }
  const count = nums.length;
  const sum = nums.reduce((acc, n) => acc + n, 0);
  const mean = sum / count;

  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const min = sorted[0];
  const max = sorted[count - 1];

  const variance = nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    sum: Number(sum.toFixed(6)),
    mean: Number(mean.toFixed(6)),
    median: Number(median.toFixed(6)),
    min,
    max,
    variance: Number(variance.toFixed(6)),
    stdDev: Number(stdDev.toFixed(6)),
  };
}
