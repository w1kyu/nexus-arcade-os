// @ts-check

export const BLANK = '_';

/**
 * @typedef {object} TMTransition
 * @property {string} state - Current state
 * @property {string} read - Symbol read
 * @property {string} nextState - State to transition to
 * @property {string} write - Symbol to write
 * @property {'L' | 'R' | 'N'} move - Direction to move head
 */

/**
 * @typedef {object} TuringMachine
 * @property {string} startState
 * @property {string[]} acceptStates
 * @property {string[]} rejectStates
 * @property {TMTransition[]} transitions
 * @property {string} defaultInput
 */

/**
 * Runs a Turing Machine step by step as a generator.
 * @param {TuringMachine} tm
 * @param {string} inputString
 * @param {number} [stepLimit]
 */
export function* runTuringMachine(tm, inputString = '', stepLimit = 5000) {
  /** @type {Map<number, string>} */
  const tape = new Map();
  for (let i = 0; i < inputString.length; i++) {
    tape.set(i, inputString[i]);
  }

  let head = 0;
  let currentState = tm.startState;
  let stepCount = 0;

  // Transition map: key = `${state}:${read}`
  const transMap = new Map();
  for (const tr of tm.transitions) {
    transMap.set(`${tr.state}:${tr.read}`, tr);
  }

  const acceptSet = new Set(tm.acceptStates || ['accept', 'halt']);
  const rejectSet = new Set(tm.rejectStates || ['reject']);

  yield {
    type: 'init',
    state: currentState,
    head,
    tape: new Map(tape),
    stepCount: 0,
    message: `Initial state: ${currentState}, Head at index 0`,
  };

  while (stepCount < stepLimit) {
    if (acceptSet.has(currentState)) {
      yield {
        type: 'halt',
        status: 'accepted',
        state: currentState,
        head,
        tape: new Map(tape),
        stepCount,
        message: `Halted in accepting state '${currentState}' after ${stepCount} steps.`,
      };
      return 'accepted';
    }

    if (rejectSet.has(currentState)) {
      yield {
        type: 'halt',
        status: 'rejected',
        state: currentState,
        head,
        tape: new Map(tape),
        stepCount,
        message: `Halted in rejecting state '${currentState}' after ${stepCount} steps.`,
      };
      return 'rejected';
    }

    const readSymbol = tape.get(head) ?? BLANK;
    const transition = transMap.get(`${currentState}:${readSymbol}`);

    if (!transition) {
      // No transition defined -> implicit halt
      const isAccepted = acceptSet.has(currentState);
      const status = isAccepted ? 'accepted' : 'halted';
      yield {
        type: 'halt',
        status,
        state: currentState,
        head,
        tape: new Map(tape),
        stepCount,
        message: `No transition from (${currentState}, '${readSymbol}'). Halted.`,
      };
      return status;
    }

    // Write symbol to tape
    tape.set(head, transition.write);
    const prevState = currentState;
    const prevHead = head;
    currentState = transition.nextState;

    if (transition.move === 'L') head--;
    else if (transition.move === 'R') head++;

    stepCount++;

    yield {
      type: 'step',
      state: currentState,
      prevState,
      readSymbol,
      wroteSymbol: transition.write,
      move: transition.move,
      prevHead,
      head,
      tape: new Map(tape),
      stepCount,
      message: `Step ${stepCount}: (${prevState}, '${readSymbol}') → (${currentState}, '${transition.write}', ${transition.move})`,
    };
  }

  yield {
    type: 'halt',
    status: 'limit',
    state: currentState,
    head,
    tape: new Map(tape),
    stepCount,
    message: `Step limit (${stepLimit}) reached. Stopped.`,
  };
  return 'limit';
}

/**
 * Gets tape contents as an array with min and max bounds around head.
 * @param {Map<number, string>} tape
 * @param {number} head
 * @param {number} padding
 */
export function getVisibleTape(tape, head, padding = 10) {
  let minIdx = head - padding;
  let maxIdx = head + padding;

  for (const idx of tape.keys()) {
    if (tape.get(idx) !== BLANK) {
      minIdx = Math.min(minIdx, idx - 2);
      maxIdx = Math.max(maxIdx, idx + 2);
    }
  }

  const result = [];
  for (let i = minIdx; i <= maxIdx; i++) {
    result.push({
      index: i,
      symbol: tape.get(i) ?? BLANK,
      isHead: i === head,
    });
  }
  return result;
}

/**
 * Turing Machine Presets
 */
export const TURING_PRESETS = {
  binaryIncrement: {
    name: { en: 'Binary Increment', de: 'Binäre Inkrementierung' },
    startState: 'findEnd',
    acceptStates: ['halt'],
    rejectStates: [],
    defaultInput: '1011',
    transitions: [
      { state: 'findEnd', read: '0', nextState: 'findEnd', write: '0', move: 'R' },
      { state: 'findEnd', read: '1', nextState: 'findEnd', write: '1', move: 'R' },
      { state: 'findEnd', read: BLANK, nextState: 'add', write: BLANK, move: 'L' },
      { state: 'add', read: '1', nextState: 'add', write: '0', move: 'L' },
      { state: 'add', read: '0', nextState: 'rewind', write: '1', move: 'L' },
      { state: 'add', read: BLANK, nextState: 'rewind', write: '1', move: 'L' },
      { state: 'rewind', read: '0', nextState: 'rewind', write: '0', move: 'L' },
      { state: 'rewind', read: '1', nextState: 'rewind', write: '1', move: 'L' },
      { state: 'rewind', read: BLANK, nextState: 'halt', write: BLANK, move: 'R' },
    ],
  },
  palindrome: {
    name: { en: 'Palindrome Check', de: 'Palindrom-Prüfung' },
    startState: 'q0',
    acceptStates: ['accept'],
    rejectStates: ['reject'],
    defaultInput: '1001',
    transitions: [
      { state: 'q0', read: '0', nextState: 'match0', write: BLANK, move: 'R' },
      { state: 'q0', read: '1', nextState: 'match1', write: BLANK, move: 'R' },
      { state: 'q0', read: BLANK, nextState: 'accept', write: BLANK, move: 'N' },

      { state: 'match0', read: '0', nextState: 'match0', write: '0', move: 'R' },
      { state: 'match0', read: '1', nextState: 'match0', write: '1', move: 'R' },
      { state: 'match0', read: BLANK, nextState: 'check0', write: BLANK, move: 'L' },

      { state: 'match1', read: '0', nextState: 'match1', write: '0', move: 'R' },
      { state: 'match1', read: '1', nextState: 'match1', write: '1', move: 'R' },
      { state: 'match1', read: BLANK, nextState: 'check1', write: BLANK, move: 'L' },

      { state: 'check0', read: '0', nextState: 'rewind', write: BLANK, move: 'L' },
      { state: 'check0', read: '1', nextState: 'reject', write: '1', move: 'N' },
      { state: 'check0', read: BLANK, nextState: 'accept', write: BLANK, move: 'N' },

      { state: 'check1', read: '1', nextState: 'rewind', write: BLANK, move: 'L' },
      { state: 'check1', read: '0', nextState: 'reject', write: '0', move: 'N' },
      { state: 'check1', read: BLANK, nextState: 'accept', write: BLANK, move: 'N' },

      { state: 'rewind', read: '0', nextState: 'rewind', write: '0', move: 'L' },
      { state: 'rewind', read: '1', nextState: 'rewind', write: '1', move: 'L' },
      { state: 'rewind', read: BLANK, nextState: 'q0', write: BLANK, move: 'R' },
    ],
  },
  unaryAddition: {
    name: { en: 'Unary Addition (111#11 = 11111)', de: 'Unäre Addition (111#11 = 11111)' },
    startState: 'scan',
    acceptStates: ['halt'],
    rejectStates: [],
    defaultInput: '111#11',
    transitions: [
      { state: 'scan', read: '1', nextState: 'scan', write: '1', move: 'R' },
      { state: 'scan', read: '#', nextState: 'fill', write: '1', move: 'R' },
      { state: 'fill', read: '1', nextState: 'fill', write: '1', move: 'R' },
      { state: 'fill', read: BLANK, nextState: 'eraseLast', write: BLANK, move: 'L' },
      { state: 'eraseLast', read: '1', nextState: 'halt', write: BLANK, move: 'L' },
    ],
  },
  busyBeaver2: {
    name: { en: 'Busy Beaver (2-State, 6 steps, 4 ones)', de: 'Fleißiger Biber (2 Zustände, 6 Schritte, 4 Einsen)' },
    startState: 'A',
    acceptStates: ['halt'],
    rejectStates: [],
    defaultInput: '',
    transitions: [
      { state: 'A', read: BLANK, nextState: 'B', write: '1', move: 'R' },
      { state: 'A', read: '1', nextState: 'B', write: '1', move: 'L' },
      { state: 'B', read: BLANK, nextState: 'A', write: '1', move: 'L' },
      { state: 'B', read: '1', nextState: 'halt', write: '1', move: 'R' },
    ],
  },
  busyBeaver3: {
    name: { en: 'Busy Beaver (3-State, 14 steps, 6 ones)', de: 'Fleißiger Biber (3 Zustände, 14 Schritte, 6 Einsen)' },
    startState: 'A',
    acceptStates: ['halt'],
    rejectStates: [],
    defaultInput: '',
    transitions: [
      { state: 'A', read: BLANK, nextState: 'B', write: '1', move: 'R' },
      { state: 'A', read: '1', nextState: 'halt', write: '1', move: 'R' },
      { state: 'B', read: BLANK, nextState: 'C', write: '0', move: 'R' },
      { state: 'B', read: '1', nextState: 'B', write: '1', move: 'R' },
      { state: 'C', read: BLANK, nextState: 'C', write: '1', move: 'L' },
      { state: 'C', read: '1', nextState: 'A', write: '1', move: 'L' },
      { state: 'B', read: '0', nextState: 'B', write: '1', move: 'R' },
      { state: 'C', read: '0', nextState: 'A', write: '1', move: 'L' },
    ],
  },
};
