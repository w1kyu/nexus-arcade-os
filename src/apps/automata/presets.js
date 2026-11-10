// @ts-check

/**
 * Automata Presets
 */
export const AUTOMATA_PRESETS = {
  div3: {
    name: { en: 'Binary Divisible by 3 (DFA)', de: 'Binär teilbar durch 3 (DFA)' },
    isDfa: true,
    alphabet: ['0', '1'],
    states: [
      { id: 's0', label: 'mod 0', isStart: true, isAccepting: true, x: 120, y: 150 },
      { id: 's1', label: 'mod 1', isStart: false, isAccepting: false, x: 280, y: 80 },
      { id: 's2', label: 'mod 2', isStart: false, isAccepting: false, x: 280, y: 220 },
    ],
    transitions: [
      { id: 't1', from: 's0', to: 's0', symbol: '0' },
      { id: 't2', from: 's0', to: 's1', symbol: '1' },
      { id: 't3', from: 's1', to: 's2', symbol: '0' },
      { id: 't4', from: 's1', to: 's0', symbol: '1' },
      { id: 't5', from: 's2', to: 's1', symbol: '0' },
      { id: 't6', from: 's2', to: 's2', symbol: '1' },
    ],
  },
  endsAb: {
    name: { en: 'Strings ending with "ab" (NFA)', de: 'Wörter die auf "ab" enden (NFA)' },
    isDfa: false,
    alphabet: ['a', 'b'],
    states: [
      { id: 'q0', label: 'q0', isStart: true, isAccepting: false, x: 120, y: 150 },
      { id: 'q1', label: 'q1', isStart: false, isAccepting: false, x: 260, y: 150 },
      { id: 'q2', label: 'q2', isStart: false, isAccepting: true, x: 400, y: 150 },
    ],
    transitions: [
      { id: 't1', from: 'q0', to: 'q0', symbol: 'a' },
      { id: 't2', from: 'q0', to: 'q0', symbol: 'b' },
      { id: 't3', from: 'q0', to: 'q1', symbol: 'a' },
      { id: 't4', from: 'q1', to: 'q2', symbol: 'b' },
    ],
  },
  evenZeros: {
    name: { en: 'Even number of 0s (DFA)', de: 'Gerade Anzahl Nullen (DFA)' },
    isDfa: true,
    alphabet: ['0', '1'],
    states: [
      { id: 'even', label: 'Even', isStart: true, isAccepting: true, x: 160, y: 150 },
      { id: 'odd', label: 'Odd', isStart: false, isAccepting: false, x: 360, y: 150 },
    ],
    transitions: [
      { id: 't1', from: 'even', to: 'odd', symbol: '0' },
      { id: 't2', from: 'even', to: 'even', symbol: '1' },
      { id: 't3', from: 'odd', to: 'even', symbol: '0' },
      { id: 't4', from: 'odd', to: 'odd', symbol: '1' },
    ],
  },
};
