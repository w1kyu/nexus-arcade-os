// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TURING_PRESETS, getVisibleTape, runTuringMachine } from '../../src/apps/turing/engine.js';

describe('Turing Machine Engine', () => {
  function exhaust(gen) {
    let last = null;
    let step = gen.next();
    while (!step.done) {
      last = step.value;
      step = gen.next();
    }
    return last;
  }

  it('runs binary increment machine (1011 -> 1100)', () => {
    const tm = TURING_PRESETS.binaryIncrement;
    const res = exhaust(runTuringMachine(tm, '1011'));
    expect(res).not.toBeNull();
    expect(res.status).toBe('accepted');

    // Tape should have '1100'
    const tape = res.tape;
    expect(tape.get(0)).toBe('1');
    expect(tape.get(1)).toBe('1');
    expect(tape.get(2)).toBe('0');
    expect(tape.get(3)).toBe('0');
  });

  it('runs palindrome check machine', () => {
    const tm = TURING_PRESETS.palindrome;
    const resAccepted = exhaust(runTuringMachine(tm, '1001'));
    expect(resAccepted.status).toBe('accepted');

    const resRejected = exhaust(runTuringMachine(tm, '1010'));
    expect(resRejected.status).toBe('rejected');
  });

  it('runs unary addition machine (111#11 -> 11111)', () => {
    const tm = TURING_PRESETS.unaryAddition;
    const res = exhaust(runTuringMachine(tm, '111#11'));
    expect(res.status).toBe('accepted');

    // Should contain five 1s
    const tape = res.tape;
    let ones = 0;
    for (const val of tape.values()) {
      if (val === '1') ones++;
    }
    expect(ones).toBe(5);
  });

  it('runs 2-state Busy Beaver machine (writes 4 ones in 6 steps)', () => {
    const tm = TURING_PRESETS.busyBeaver2;
    const res = exhaust(runTuringMachine(tm, ''));
    expect(res.status).toBe('accepted');
    expect(res.stepCount).toBe(6);

    let ones = 0;
    for (const val of res.tape.values()) {
      if (val === '1') ones++;
    }
    expect(ones).toBe(4);
  });

  it('computes visible tape window properly', () => {
    const tape = new Map();
    tape.set(0, 'A');
    tape.set(1, 'B');
    const visible = getVisibleTape(tape, 0, 3);
    expect(visible.some((c) => c.symbol === 'A')).toBe(true);
    expect(visible.some((c) => c.symbol === 'B')).toBe(true);
    expect(visible.some((c) => c.isHead)).toBe(true);
  });
});
