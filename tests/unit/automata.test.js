// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  batchTestWords,
  complementDfa,
  convertNfaToDfa,
  getEpsilonClosure,
  minimizeDfa,
  productAutomaton,
  regexToNfa,
  simulateWord,
  validateAutomaton,
} from '../../src/apps/automata/engine.js';
import { AUTOMATA_PRESETS } from '../../src/apps/automata/presets.js';

describe('Automata Engine', () => {
  const div3 = AUTOMATA_PRESETS.div3;
  const endsAb = AUTOMATA_PRESETS.endsAb;

  function runSim(aut, word) {
    const gen = simulateWord(aut, word);
    let last = null;
    let step = gen.next();
    while (!step.done) {
      last = step.value;
      step = gen.next();
    }
    return last ? Boolean(last.accepted) : false;
  }

  it('simulates DFA for binary divisible by 3', () => {
    // 0 is divisible by 3 (0 in decimal)
    expect(runSim(div3, '0')).toBe(true);
    // 11 is 3 in decimal (divisible by 3)
    expect(runSim(div3, '11')).toBe(true);
    // 110 is 6 in decimal (divisible by 3)
    expect(runSim(div3, '110')).toBe(true);
    // 1001 is 9 in decimal (divisible by 3)
    expect(runSim(div3, '1001')).toBe(true);
    // 10 is 2 in decimal (not divisible by 3)
    expect(runSim(div3, '10')).toBe(false);
    // 100 is 4 in decimal (not divisible by 3)
    expect(runSim(div3, '100')).toBe(false);
  });

  it('simulates NFA for strings ending with "ab"', () => {
    expect(runSim(endsAb, 'ab')).toBe(true);
    expect(runSim(endsAb, 'aab')).toBe(true);
    expect(runSim(endsAb, 'babab')).toBe(true);
    expect(runSim(endsAb, 'aba')).toBe(false);
    expect(runSim(endsAb, 'b')).toBe(false);
  });

  it('runs batch test words', () => {
    const res = batchTestWords(endsAb, ['ab', 'ba', 'aab', 'xyz']);
    expect(res).toEqual([
      { word: 'ab', accepted: true },
      { word: 'ba', accepted: false },
      { word: 'aab', accepted: true },
      { word: 'xyz', accepted: false },
    ]);
  });

  it('computes epsilon closure', () => {
    const transitions = [
      { id: 't1', from: 'q0', to: 'q1', symbol: 'ε' },
      { id: 't2', from: 'q1', to: 'q2', symbol: 'ε' },
      { id: 't3', from: 'q2', to: 'q3', symbol: 'a' },
    ];
    const closure = getEpsilonClosure(new Set(['q0']), transitions);
    expect(closure.has('q0')).toBe(true);
    expect(closure.has('q1')).toBe(true);
    expect(closure.has('q2')).toBe(true);
    expect(closure.has('q3')).toBe(false);
  });

  it('converts NFA to DFA using subset construction', () => {
    const dfa = convertNfaToDfa(endsAb);
    expect(dfa.isDfa).toBe(true);
    expect(dfa.states.length).toBeGreaterThan(0);

    // Converted DFA must accept the same language
    expect(runSim(dfa, 'ab')).toBe(true);
    expect(runSim(dfa, 'aab')).toBe(true);
    expect(runSim(dfa, 'ba')).toBe(false);
  });

  it('minimizes a DFA', () => {
    const min = minimizeDfa(div3);
    expect(min.isDfa).toBe(true);
    expect(runSim(min, '11')).toBe(true);
    expect(runSim(min, '10')).toBe(false);
  });

  it('converts regex to NFA using Thompson construction', () => {
    const nfa = regexToNfa('(a|b)*abb');
    expect(nfa.states.length).toBeGreaterThan(0);
    expect(runSim(nfa, 'abb')).toBe(true);
    expect(runSim(nfa, 'aabb')).toBe(true);
    expect(runSim(nfa, 'babb')).toBe(true);
    expect(runSim(nfa, 'ab')).toBe(false);
  });

  it('computes complement and product automata', () => {
    const comp = complementDfa(div3);
    // Complement rejects words divisible by 3 and accepts words NOT divisible by 3
    expect(runSim(comp, '11')).toBe(false);
    expect(runSim(comp, '10')).toBe(true);

    const prod = productAutomaton(div3, div3, 'intersection');
    expect(runSim(prod, '11')).toBe(true);
    expect(runSim(prod, '10')).toBe(false);
  });

  it('validates automata completeness and unreachable states', () => {
    const val = validateAutomaton(div3);
    expect(val.isCompleteDfa).toBe(true);
    expect(val.hasStart).toBe(true);
    expect(val.hasAccepting).toBe(true);
    expect(val.unreachable.length).toBe(0);
  });
});
