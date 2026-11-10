// @ts-check
import { describe, expect, it } from 'vitest';
import {
  CIRCUIT_PRESETS,
  evalGate,
  generateTruthTable,
  simulateCircuit,
} from '../../src/apps/circuits/circuits-engine.js';
import {
  buildKarnaughMap,
  checkEquivalence,
  evaluateBoolean,
  extractVariables,
  generateExpressionTruthTable,
  quineMcCluskey,
  standardizeExpression,
} from '../../src/apps/circuits/boolean-engine.js';

describe('Logic Circuit Simulator Engine', () => {
  it('correctly evaluates individual logic gates', () => {
    expect(evalGate('buffer', [1])).toEqual([1]);
    expect(evalGate('not', [1])).toEqual([0]);
    expect(evalGate('not', [0])).toEqual([1]);

    expect(evalGate('and', [1, 1])).toEqual([1]);
    expect(evalGate('and', [1, 0])).toEqual([0]);

    expect(evalGate('or', [0, 0])).toEqual([0]);
    expect(evalGate('or', [1, 0])).toEqual([1]);

    expect(evalGate('nand', [1, 1])).toEqual([0]);
    expect(evalGate('nand', [1, 0])).toEqual([1]);

    expect(evalGate('nor', [0, 0])).toEqual([1]);
    expect(evalGate('nor', [1, 0])).toEqual([0]);

    expect(evalGate('xor', [1, 0])).toEqual([1]);
    expect(evalGate('xor', [1, 1])).toEqual([0]);

    expect(evalGate('xnor', [1, 1])).toEqual([1]);
    expect(evalGate('xnor', [1, 0])).toEqual([0]);
  });

  it('simulates Half Adder preset correctly', () => {
    const preset = CIRCUIT_PRESETS.halfAdder;
    const comps = JSON.parse(JSON.stringify(preset.components));
    const wires = JSON.parse(JSON.stringify(preset.wires));

    const inA = comps.find((c) => c.id === 'in_A');
    const inB = comps.find((c) => c.id === 'in_B');
    const outS = comps.find((c) => c.id === 'out_sum');
    const outC = comps.find((c) => c.id === 'out_carry');

    // Case 1: A=0, B=0 -> S=0, C=0
    inA.state = 0;
    inB.state = 0;
    simulateCircuit(comps, wires);
    expect(outS.state).toBe(0);
    expect(outC.state).toBe(0);

    // Case 2: A=1, B=0 -> S=1, C=0
    inA.state = 1;
    inB.state = 0;
    simulateCircuit(comps, wires);
    expect(outS.state).toBe(1);
    expect(outC.state).toBe(0);

    // Case 3: A=1, B=1 -> S=0, C=1
    inA.state = 1;
    inB.state = 1;
    simulateCircuit(comps, wires);
    expect(outS.state).toBe(0);
    expect(outC.state).toBe(1);
  });

  it('generates exhaustive truth table for circuit', () => {
    const preset = CIRCUIT_PRESETS.halfAdder;
    const comps = JSON.parse(JSON.stringify(preset.components));
    const wires = JSON.parse(JSON.stringify(preset.wires));

    const table = generateTruthTable(comps, wires);
    expect(table).not.toBeNull();
    expect(table?.rows.length).toBe(4); // 2 inputs -> 4 rows
    expect(table?.rows[0]).toEqual({ inputs: [0, 0], outputs: [0, 0] });
    expect(table?.rows[1]).toEqual({ inputs: [0, 1], outputs: [1, 0] });
    expect(table?.rows[2]).toEqual({ inputs: [1, 0], outputs: [1, 0] });
    expect(table?.rows[3]).toEqual({ inputs: [1, 1], outputs: [0, 1] });
  });
});

describe('Boolean Algebra & Karnaugh Map Engine', () => {
  it('standardizes and evaluates expressions', () => {
    expect(standardizeExpression('A ∧ B ∨ ¬C')).toContain('&&');
    const vars = extractVariables('A ∧ B ∨ ¬C');
    expect(vars).toEqual(['A', 'B', 'C']);

    expect(evaluateBoolean('A & B', { A: 1, B: 1 })).toBe(1);
    expect(evaluateBoolean('A & B', { A: 1, B: 0 })).toBe(0);
    expect(evaluateBoolean('A | B', { A: 0, B: 1 })).toBe(1);
    expect(evaluateBoolean('!A', { A: 1 })).toBe(0);
  });

  it('detects tautology, contradiction and contingency', () => {
    const taut = generateExpressionTruthTable('A | !A');
    expect(taut?.classification).toBe('tautology');

    const cont = generateExpressionTruthTable('A & !A');
    expect(cont?.classification).toBe('contradiction');

    const con = generateExpressionTruthTable('A & B');
    expect(con?.classification).toBe('contingency');
  });

  it('checks boolean equivalence (De Morgan)', () => {
    // !(A & B) == !A | !B
    const eq1 = checkEquivalence('!(A & B)', '!A | !B');
    expect(eq1.equivalent).toBe(true);

    const eq2 = checkEquivalence('A & B', 'A | B');
    expect(eq2.equivalent).toBe(false);
    expect(eq2.counterExample).not.toBeNull();
  });

  it('builds Karnaugh Map grid for 2 and 3 variables', () => {
    const kv2 = buildKarnaughMap('A & B');
    expect(kv2?.rowVars).toBe('A');
    expect(kv2?.colVars).toBe('B');
    expect(kv2?.grid.length).toBe(2);
    expect(kv2?.grid[0].length).toBe(2);

    const kv3 = buildKarnaughMap('(A & B) | C');
    expect(kv3?.rowVars).toBe('A');
    expect(kv3?.colVars).toBe('BC');
    expect(kv3?.grid.length).toBe(2);
    expect(kv3?.grid[0].length).toBe(4);
  });

  it('performs Quine-McCluskey minimization', () => {
    // minterms for A & B on 2 variables [A, B] is m(3)
    const res = quineMcCluskey([3], ['A', 'B']);
    expect(res.dnf).toBe('AB');

    // minterms for A | B on 2 variables is m(1, 2, 3) -> A + B
    const res2 = quineMcCluskey([1, 2, 3], ['A', 'B']);
    expect(res2.primeImplicants.length).toBeGreaterThan(0);
  });
});
