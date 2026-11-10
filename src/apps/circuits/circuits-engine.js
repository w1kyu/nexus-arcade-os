// @ts-check

/**
 * @typedef {object} CircuitComponent
 * @property {string} id
 * @property {'switch' | 'clock' | 'led' | 'display7' | 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | 'xnor' | 'buffer'} type
 * @property {string} label
 * @property {number} x
 * @property {number} y
 * @property {number} state - 0 or 1 (for switch / clock / led)
 * @property {number[]} [inPins] - Input signal states
 * @property {number[]} [outPins] - Output signal states
 */

/**
 * @typedef {object} CircuitWire
 * @property {string} id
 * @property {string} fromComp
 * @property {number} fromPin
 * @property {string} toComp
 * @property {number} toPin
 * @property {number} state - 0 or 1
 */

/**
 * Calculates gate outputs given input signals.
 * @param {string} type
 * @param {number[]} inPins
 * @param {number} compState
 */
export function evalGate(type, inPins, compState = 0) {
  const a = inPins[0] ?? 0;
  const b = inPins[1] ?? 0;
  switch (type) {
    case 'switch':
    case 'clock':
      return [compState];
    case 'buffer':
      return [a];
    case 'not':
      return [a ? 0 : 1];
    case 'and':
      return [a && b ? 1 : 0];
    case 'or':
      return [a || b ? 1 : 0];
    case 'nand':
      return [a && b ? 0 : 1];
    case 'nor':
      return [a || b ? 0 : 1];
    case 'xor':
      return [a ^ b ? 1 : 0];
    case 'xnor':
      return [a ^ b ? 0 : 1];
    case 'led':
    case 'display7':
      return [a];
    default:
      return [0];
  }
}

/**
 * Runs one simulation pass on circuit components and wires.
 * @param {CircuitComponent[]} components
 * @param {CircuitWire[]} wires
 * @param {number} iterations
 */
export function simulateCircuit(components, wires, iterations = 6) {
  const compMap = new Map(components.map((c) => [c.id, c]));

  for (let iter = 0; iter < iterations; iter++) {
    // 1. Evaluate component outputs
    for (const c of components) {
      if (!c.inPins) c.inPins = [0, 0];
      c.outPins = evalGate(c.type, c.inPins, c.state);
      if (c.type === 'led') {
        c.state = c.inPins[0] ?? 0;
      }
    }

    // 2. Propagate signals through wires
    for (const w of wires) {
      const src = compMap.get(w.fromComp);
      const dst = compMap.get(w.toComp);
      if (src && dst && src.outPins) {
        const val = src.outPins[w.fromPin] ?? 0;
        w.state = val;
        if (!dst.inPins) dst.inPins = [0, 0];
        dst.inPins[w.toPin] = val;
      }
    }
  }
}

/**
 * Generates truth table for all switches and LEDs in circuit.
 * @param {CircuitComponent[]} components
 * @param {CircuitWire[]} wires
 */
export function generateTruthTable(components, wires) {
  const switches = components.filter((c) => c.type === 'switch');
  const leds = components.filter((c) => c.type === 'led');
  if (switches.length === 0 || leds.length === 0) return null;

  const n = switches.length;
  const numRows = Math.pow(2, n);
  const rows = [];

  // Backup states
  const backup = components.map((c) => ({
    id: c.id,
    state: c.state,
    inPins: c.inPins ? [...c.inPins] : [0, 0],
    outPins: c.outPins ? [...c.outPins] : [0],
  }));

  for (let r = 0; r < numRows; r++) {
    const inputs = [];
    for (let bit = 0; bit < n; bit++) {
      const val = (r >> (n - 1 - bit)) & 1;
      switches[bit].state = val;
      inputs.push(val);
    }

    simulateCircuit(components, wires, 6);
    const outputs = leds.map((l) => l.state ?? 0);
    rows.push({ inputs, outputs });
  }

  // Restore states
  for (const b of backup) {
    const c = components.find((comp) => comp.id === b.id);
    if (c) {
      c.state = b.state;
      c.inPins = b.inPins;
      c.outPins = b.outPins;
    }
  }
  simulateCircuit(components, wires, 6);

  return {
    inputLabels: switches.map((s) => s.label || s.id),
    outputLabels: leds.map((l) => l.label || l.id),
    rows,
  };
}

/**
 * Circuit Presets
 */
export const CIRCUIT_PRESETS = {
  halfAdder: {
    name: { en: 'Half Adder', de: 'Halbaddierer' },
    components: [
      { id: 'in_A', type: 'switch', label: 'A', x: 100, y: 120, state: 1 },
      { id: 'in_B', type: 'switch', label: 'B', x: 100, y: 220, state: 1 },
      { id: 'gate_xor', type: 'xor', label: 'XOR', x: 260, y: 130, state: 0 },
      { id: 'gate_and', type: 'and', label: 'AND', x: 260, y: 230, state: 0 },
      { id: 'out_sum', type: 'led', label: 'Sum (S)', x: 420, y: 130, state: 0 },
      { id: 'out_carry', type: 'led', label: 'Carry (C)', x: 420, y: 230, state: 0 },
    ],
    wires: [
      { id: 'w1', fromComp: 'in_A', fromPin: 0, toComp: 'gate_xor', toPin: 0, state: 1 },
      { id: 'w2', fromComp: 'in_B', fromPin: 0, toComp: 'gate_xor', toPin: 1, state: 1 },
      { id: 'w3', fromComp: 'in_A', fromPin: 0, toComp: 'gate_and', toPin: 0, state: 1 },
      { id: 'w4', fromComp: 'in_B', fromPin: 0, toComp: 'gate_and', toPin: 1, state: 1 },
      { id: 'w5', fromComp: 'gate_xor', fromPin: 0, toComp: 'out_sum', toPin: 0, state: 0 },
      { id: 'w6', fromComp: 'gate_and', fromPin: 0, toComp: 'out_carry', toPin: 0, state: 1 },
    ],
  },
  fullAdder: {
    name: { en: 'Full Adder', de: 'Volladdierer' },
    components: [
      { id: 'in_A', type: 'switch', label: 'A', x: 80, y: 100, state: 1 },
      { id: 'in_B', type: 'switch', label: 'B', x: 80, y: 180, state: 0 },
      { id: 'in_Cin', type: 'switch', label: 'Cin', x: 80, y: 260, state: 1 },
      { id: 'xor1', type: 'xor', label: 'XOR1', x: 200, y: 120, state: 0 },
      { id: 'xor2', type: 'xor', label: 'XOR2', x: 330, y: 140, state: 0 },
      { id: 'and1', type: 'and', label: 'AND1', x: 260, y: 220, state: 0 },
      { id: 'and2', type: 'and', label: 'AND2', x: 330, y: 270, state: 0 },
      { id: 'or1', type: 'or', label: 'OR', x: 420, y: 250, state: 0 },
      { id: 'out_S', type: 'led', label: 'Sum (S)', x: 480, y: 140, state: 0 },
      { id: 'out_Cout', type: 'led', label: 'Cout', x: 520, y: 250, state: 0 },
    ],
    wires: [
      { id: 'w1', fromComp: 'in_A', fromPin: 0, toComp: 'xor1', toPin: 0, state: 1 },
      { id: 'w2', fromComp: 'in_B', fromPin: 0, toComp: 'xor1', toPin: 1, state: 0 },
      { id: 'w3', fromComp: 'xor1', fromPin: 0, toComp: 'xor2', toPin: 0, state: 1 },
      { id: 'w4', fromComp: 'in_Cin', fromPin: 0, toComp: 'xor2', toPin: 1, state: 1 },
      { id: 'w5', fromComp: 'xor2', fromPin: 0, toComp: 'out_S', toPin: 0, state: 0 },
      { id: 'w6', fromComp: 'xor1', fromPin: 0, toComp: 'and1', toPin: 0, state: 1 },
      { id: 'w7', fromComp: 'in_Cin', fromPin: 0, toComp: 'and1', toPin: 1, state: 1 },
      { id: 'w8', fromComp: 'in_A', fromPin: 0, toComp: 'and2', toPin: 0, state: 1 },
      { id: 'w9', fromComp: 'in_B', fromPin: 0, toComp: 'and2', toPin: 1, state: 0 },
      { id: 'w10', fromComp: 'and1', fromPin: 0, toComp: 'or1', toPin: 0, state: 1 },
      { id: 'w11', fromComp: 'and2', fromPin: 0, toComp: 'or1', toPin: 1, state: 0 },
      { id: 'w12', fromComp: 'or1', fromPin: 0, toComp: 'out_Cout', toPin: 0, state: 1 },
    ],
  },
  srLatch: {
    name: { en: 'SR Latch (NOR)', de: 'SR-Flipflop (NOR)' },
    components: [
      { id: 'in_R', type: 'switch', label: 'Reset (R)', x: 100, y: 120, state: 0 },
      { id: 'in_S', type: 'switch', label: 'Set (S)', x: 100, y: 240, state: 1 },
      { id: 'nor1', type: 'nor', label: 'NOR1', x: 260, y: 130, state: 0 },
      { id: 'nor2', type: 'nor', label: 'NOR2', x: 260, y: 230, state: 0 },
      { id: 'out_Q', type: 'led', label: 'Q', x: 420, y: 130, state: 1 },
      { id: 'out_Qnot', type: 'led', label: 'Q_not', x: 420, y: 230, state: 0 },
    ],
    wires: [
      { id: 'w1', fromComp: 'in_R', fromPin: 0, toComp: 'nor1', toPin: 0, state: 0 },
      { id: 'w2', fromComp: 'in_S', fromPin: 0, toComp: 'nor2', toPin: 1, state: 1 },
      { id: 'w3', fromComp: 'nor1', fromPin: 0, toComp: 'out_Q', toPin: 0, state: 1 },
      { id: 'w4', fromComp: 'nor2', fromPin: 0, toComp: 'out_Qnot', toPin: 0, state: 0 },
      { id: 'w5', fromComp: 'nor1', fromPin: 0, toComp: 'nor2', toPin: 0, state: 1 },
      { id: 'w6', fromComp: 'nor2', fromPin: 0, toComp: 'nor1', toPin: 1, state: 0 },
    ],
  },
};
