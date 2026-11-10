// @ts-check
import { describe, expect, it } from 'vitest';
import {
  encodeIEEE754,
  explainFloatProblem,
  formatInteger,
  getStepByStepDivision,
  getStepByStepMultiplication,
  simulateIntegerAddition,
} from '../../src/apps/archlab/number-engine.js';
import { Nexus8Cpu, assembleNexus8, runCpu } from '../../src/apps/archlab/cpu-engine.js';

describe('Number Representation Engine', () => {
  it('formats positive and negative integers in 8-bit and 4-bit', () => {
    // 42 in 8-bit: 00101010, hex 0x2A
    const rep42 = formatInteger(42, 8);
    expect(rep42.twosComplement.binary).toBe('00101010');
    expect(rep42.hex).toBe('0x2A');
    expect(rep42.signMagnitude.binary).toBe('00101010');
    expect(rep42.onesComplement.binary).toBe('00101010');

    // -42 in 8-bit: 2's complement is 256 - 42 = 214 = 11010110
    const repNeg42 = formatInteger(-42, 8);
    expect(repNeg42.twosComplement.binary).toBe('11010110');
    // Sign-magnitude has 1 at MSB followed by 42: 10101010
    expect(repNeg42.signMagnitude.binary).toBe('10101010');
    // One's complement is inversion of 00101010: 11010101
    expect(repNeg42.onesComplement.binary).toBe('11010101');

    // 4-bit max signed is 7
    const rep7 = formatInteger(7, 4);
    expect(rep7.twosComplement.binary).toBe('0111');
    expect(rep7.twosComplement.inRange).toBe(true);

    const rep8 = formatInteger(8, 4);
    expect(rep8.twosComplement.inRange).toBe(false); // 8 exceeds signed 4-bit range [-8, 7]
  });

  it('simulates binary addition with carry, overflow, zero, and sign flags', () => {
    // Normal addition: 10 + 20 = 30
    const res1 = simulateIntegerAddition(10, 20, 8);
    expect(res1.sum).toBe(30);
    expect(res1.flags).toEqual({ C: 0, V: 0, Z: 0, S: 0 });

    // Zero flag: 0 + 0 = 0
    const resZero = simulateIntegerAddition(0, 0, 8);
    expect(resZero.flags.Z).toBe(1);

    // Carry flag: 200 + 100 = 300 (> 255)
    const resCarry = simulateIntegerAddition(200, 100, 8);
    expect(resCarry.flags.C).toBe(1);

    // Signed overflow: 100 + 50 = 150 (> 127, bit 7 set -> negative in 2s comp)
    const resOver = simulateIntegerAddition(100, 50, 8);
    expect(resOver.flags.V).toBe(1);
    expect(resOver.flags.S).toBe(1);
  });

  it('performs step-by-step division and multiplication base conversion', () => {
    // 13 in binary: 13 / 2 = 6 r 1, 6 / 2 = 3 r 0, 3 / 2 = 1 r 1, 1 / 2 = 0 r 1
    const steps = getStepByStepDivision(13, 2);
    expect(steps.length).toBe(4);
    expect(steps[0].remainder).toBe(1);
    expect(steps[1].remainder).toBe(0);
    expect(steps[2].remainder).toBe(1);
    expect(steps[3].remainder).toBe(1);

    // 0.625 in binary: 0.625 * 2 = 1.25 (1), 0.25 * 2 = 0.5 (0), 0.5 * 2 = 1.0 (1)
    const fracSteps = getStepByStepMultiplication(0.625, 2);
    expect(fracSteps.length).toBe(3);
    expect(fracSteps.map((s) => s.digit)).toEqual(['1', '0', '1']);
  });

  it('encodes numbers in IEEE 754 precision formats', () => {
    // 0.15625 = 5/32 = 0.00101_2 = 1.01 * 2^-3
    const ieee = encodeIEEE754(0.15625, 'single');
    expect(ieee.signBit).toBe('0');
    expect(ieee.expVal).toBe(-3);
    expect(ieee.type).toBe('Normal');

    // Special values
    expect(encodeIEEE754(Infinity, 'single').type).toBe('+Infinity');
    expect(encodeIEEE754(-Infinity, 'single').type).toBe('-Infinity');
    expect(encodeIEEE754(NaN, 'single').type).toBe('NaN');
    expect(encodeIEEE754(0, 'single').type).toBe('+0');
  });

  it('explains why 0.1 + 0.2 !== 0.3', () => {
    const prob = explainFloatProblem();
    expect(prob.equal).toBe(false);
    expect(prob.sum.exact).toContain('0.30000000000000004');
  });
});

describe('Nexus-8 CPU Engine & Mini-Assembler', () => {
  it('assembles and executes a counter loop program', () => {
    const code = `
      MOV A, 0
      loop:
        OUT A
        ADD A, 1
        CMP A, 4
        JNZ loop
      HLT
    `;
    const bin = assembleNexus8(code);
    expect(bin.binary.length).toBe(256);

    const cpu = new Nexus8Cpu();
    cpu.memory.set(bin.binary);

    const runner = runCpu(cpu, 200);
    let step = runner.next();
    while (!step.done) {
      step = runner.next();
    }

    expect(cpu.halted).toBe(true);
    // Program outputs 0, 1, 2, 3
    expect(cpu.output).toEqual([0, 1, 2, 3]);
  });

  it('stores to memory and loads from memory correctly', () => {
    const code = `
      MOV A, 77
      STR A, [0x50]
      MOV A, 0
      LDR A, [0x50]
      OUT A
      HLT
    `;
    const bin = assembleNexus8(code);
    const cpu = new Nexus8Cpu();
    cpu.memory.set(bin.binary);

    const runner = runCpu(cpu, 100);
    let step = runner.next();
    while (!step.done) {
      step = runner.next();
    }

    expect(cpu.output).toEqual([77]);
    expect(cpu.memory[0x50]).toBe(77);
  });
});
