// @ts-check

/**
 * @typedef {'unsigned' | 'sign_magnitude' | 'ones_complement' | 'twos_complement'} IntegerFormat
 */

/**
 * Calculates integer representations across different bit widths.
 * @param {bigint | number} num
 * @param {number} bits - 4, 8, 16, 32, 64
 */
export function formatInteger(num, bits = 8) {
  const n = BigInt(num);
  const maxUnsigned = (1n << BigInt(bits)) - 1n;
  const maxSigned = (1n << BigInt(bits - 1)) - 1n;
  const minSigned = -(1n << BigInt(bits - 1));

  // 1. Two's complement bit pattern
  let twosCompVal = n;
  if (twosCompVal < 0n) {
    twosCompVal = (1n << BigInt(bits)) + twosCompVal;
  }
  twosCompVal = twosCompVal & maxUnsigned;
  const twosCompBin = twosCompVal.toString(2).padStart(bits, '0');

  // 2. Unsigned
  const unsignedVal = n >= 0n && n <= maxUnsigned ? n : null;

  // 3. Sign-Magnitude
  let signMagBin = '';
  const isNegative = n < 0n;
  const absVal = isNegative ? -n : n;
  if (absVal <= maxSigned) {
    const magBits = absVal.toString(2).padStart(bits - 1, '0');
    signMagBin = (isNegative ? '1' : '0') + magBits;
  }

  // 4. One's complement
  let onesCompBin = '';
  if (n >= -maxSigned && n <= maxSigned) {
    if (n >= 0n) {
      onesCompBin = n.toString(2).padStart(bits, '0');
    } else {
      // Invert positive bits
      const posBin = absVal.toString(2).padStart(bits, '0');
      onesCompBin = posBin
        .split('')
        .map((b) => (b === '1' ? '0' : '1'))
        .join('');
    }
  }

  return {
    bits,
    input: n.toString(),
    hex:
      '0x' +
      twosCompVal
        .toString(16)
        .toUpperCase()
        .padStart(Math.ceil(bits / 4), '0'),
    twosComplement: {
      binary: twosCompBin,
      inRange: n >= minSigned && n <= maxSigned,
      min: minSigned.toString(),
      max: maxSigned.toString(),
    },
    unsigned: {
      value: unsignedVal !== null ? unsignedVal.toString() : 'Overflow',
      inRange: unsignedVal !== null,
      max: maxUnsigned.toString(),
    },
    signMagnitude: {
      binary: signMagBin || 'Overflow',
      inRange: absVal <= maxSigned,
    },
    onesComplement: {
      binary: onesCompBin || 'Overflow',
      inRange: n >= -maxSigned && n <= maxSigned,
    },
  };
}

/**
 * Simulates bitwise binary addition with flags (C, V, Z, S).
 * @param {number} a
 * @param {number} b
 * @param {number} bits
 */
export function simulateIntegerAddition(a, b, bits = 8) {
  const mask = (1 << bits) - 1;
  const signBit = 1 << (bits - 1);

  const rawSum = (a + b) & mask;
  const carry = a + b > mask ? 1 : 0;
  const zero = rawSum === 0 ? 1 : 0;
  const sign = (rawSum & signBit) !== 0 ? 1 : 0;

  // Overflow occurs in 2's complement when:
  // operands have same sign, but result has different sign
  const aSign = (a & signBit) !== 0;
  const bSign = (b & signBit) !== 0;
  const resSign = (rawSum & signBit) !== 0;
  const overflow = aSign === bSign && aSign !== resSign ? 1 : 0;

  // Step-by-step bit additions
  const bitSteps = [];
  let c = 0;
  for (let i = 0; i < bits; i++) {
    const bitA = (a >> i) & 1;
    const bitB = (b >> i) & 1;
    const s = bitA ^ bitB ^ c;
    const nextC = (bitA & bitB) | (bitA & c) | (bitB & c);
    bitSteps.push({ bit: i, bitA, bitB, carryIn: c, sumBit: s, carryOut: nextC });
    c = nextC;
  }

  return {
    a,
    b,
    sum: rawSum,
    flags: { C: carry, V: overflow, Z: zero, S: sign },
    bitSteps,
    binaryA: a.toString(2).padStart(bits, '0'),
    binaryB: b.toString(2).padStart(bits, '0'),
    binarySum: rawSum.toString(2).padStart(bits, '0'),
  };
}

/**
 * Step-by-step division method for integer base conversion.
 * @param {number} n
 * @param {number} base
 */
export function getStepByStepDivision(n, base) {
  const steps = [];
  let current = Math.abs(Math.floor(n));
  if (current === 0) {
    return [{ quotient: 0, remainder: 0, division: `0 ÷ ${base} = 0, R 0` }];
  }

  while (current > 0) {
    const q = Math.floor(current / base);
    const r = current % base;
    steps.push({
      input: current,
      quotient: q,
      remainder: r,
      division: `${current} ÷ ${base} = ${q}, remainder ${r.toString(base).toUpperCase()}`,
    });
    current = q;
  }

  return steps;
}

/**
 * Step-by-step multiplication method for fractional base conversion.
 * @param {number} frac - 0 < frac < 1
 * @param {number} base
 * @param {number} maxSteps
 */
export function getStepByStepMultiplication(frac, base, maxSteps = 8) {
  const steps = [];
  let current = frac - Math.floor(frac);
  let count = 0;

  while (current > 0 && count < maxSteps) {
    const prod = current * base;
    const intPart = Math.floor(prod);
    const nextFrac = prod - intPart;
    steps.push({
      input: current,
      product: prod,
      digit: intPart.toString(base).toUpperCase(),
      next: nextFrac,
      formula: `${current.toFixed(4)} × ${base} = ${prod.toFixed(4)} -> digit ${intPart}`,
    });
    current = nextFrac;
    count++;
  }

  return steps;
}

/**
 * IEEE 754 Floating-Point Inspector
 * Supports: 'half' (16-bit), 'single' (32-bit), 'double' (64-bit)
 */
export const IEEE_SPECS = {
  half: { totalBits: 16, expBits: 5, mantissaBits: 10, bias: 15 },
  single: { totalBits: 32, expBits: 8, mantissaBits: 23, bias: 127 },
  double: { totalBits: 64, expBits: 11, mantissaBits: 52, bias: 1023 },
};

/**
 * Decomposes a standard JS number (IEEE-754 double/single/half) into its binary components.
 * @param {number} val
 * @param {'half' | 'single' | 'double'} precision
 */
export function encodeIEEE754(val, precision = 'single') {
  const spec = IEEE_SPECS[precision] || IEEE_SPECS.single;

  // Handle special cases
  const isNaN = Number.isNaN(val);
  const isInfinity = !Number.isFinite(val);
  const isNegative = Object.is(val, -0) || val < 0;
  const signBit = isNegative ? '1' : '0';

  if (isNaN) {
    return {
      precision,
      value: val,
      signBit: '0',
      expBits: '1'.repeat(spec.expBits),
      mantissaBits: '1' + '0'.repeat(spec.mantissaBits - 1),
      type: 'NaN',
      formula: 'NaN',
    };
  }

  if (isInfinity) {
    return {
      precision,
      value: val,
      signBit,
      expBits: '1'.repeat(spec.expBits),
      mantissaBits: '0'.repeat(spec.mantissaBits),
      type: isNegative ? '-Infinity' : '+Infinity',
      formula: `${isNegative ? '-' : '+'}Infinity`,
    };
  }

  if (val === 0) {
    return {
      precision,
      value: val,
      signBit,
      expBits: '0'.repeat(spec.expBits),
      mantissaBits: '0'.repeat(spec.mantissaBits),
      type: isNegative ? '-0' : '+0',
      formula: '(-1)^s × 0 = 0',
    };
  }

  // Decompose via DataView buffer
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, val, false);

  // Read 64-bit double binary representation
  let bitStr = '';
  for (let i = 0; i < 8; i++) {
    bitStr += view.getUint8(i).toString(2).padStart(8, '0');
  }

  if (precision === 'double') {
    const s = bitStr[0];
    const e = bitStr.slice(1, 12);
    const m = bitStr.slice(12);
    const expVal = parseInt(e, 2) - spec.bias;
    return {
      precision,
      value: val,
      signBit: s,
      expBits: e,
      mantissaBits: m,
      type: 'Normal',
      expVal,
      formula: `(-1)^${s} × 2^(${parseInt(e, 2)} - ${spec.bias}) × (1 + fraction)`,
    };
  }

  // For single precision, use setFloat32
  const buf32 = new ArrayBuffer(4);
  const view32 = new DataView(buf32);
  view32.setFloat32(0, val, false);
  let bitStr32 = '';
  for (let i = 0; i < 4; i++) {
    bitStr32 += view32.getUint8(i).toString(2).padStart(8, '0');
  }

  const s32 = bitStr32[0];
  const e32 = bitStr32.slice(1, 9);
  const m32 = bitStr32.slice(9);
  const eNum = parseInt(e32, 2);
  const isSubnormal = eNum === 0;

  return {
    precision,
    value: val,
    signBit: s32,
    expBits: e32,
    mantissaBits: m32,
    type: isSubnormal ? 'Subnormal' : 'Normal',
    expVal: isSubnormal ? 1 - spec.bias : eNum - spec.bias,
    formula: isSubnormal
      ? `(-1)^${s32} × 2^(1 - ${spec.bias}) × (0 + fraction)`
      : `(-1)^${s32} × 2^(${eNum} - ${spec.bias}) × (1 + fraction)`,
  };
}

/**
 * Explains why 0.1 + 0.2 !== 0.3 in IEEE-754.
 */
export function explainFloatProblem() {
  const a = 0.1;
  const b = 0.2;
  const sum = a + b;
  const expected = 0.3;
  const diff = Math.abs(sum - expected);

  return {
    a: { val: a, exact: a.toPrecision(20) },
    b: { val: b, exact: b.toPrecision(20) },
    sum: { val: sum, exact: sum.toPrecision(20) },
    expected: { val: expected, exact: expected.toPrecision(20) },
    diff: diff.toExponential(10),
    equal: sum === expected,
    explanation:
      'In binary floating point (base 2), 0.1 (1/10) and 0.2 (1/5) are repeating fractions, analogous to 1/3 in decimal. Rounding them to 53 mantissa bits produces a tiny inexactness, resulting in 0.30000000000000004.',
  };
}
