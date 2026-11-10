// @ts-check

export const EPSILON = 'ε';

/**
 * @typedef {object} AutomatonState
 * @property {string} id
 * @property {string} label
 * @property {boolean} isStart
 * @property {boolean} isAccepting
 * @property {number} [x]
 * @property {number} [y]
 */

/**
 * @typedef {object} AutomatonTransition
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} symbol - Single character or 'ε'
 */

/**
 * @typedef {object} Automaton
 * @property {boolean} isDfa
 * @property {string[]} alphabet
 * @property {AutomatonState[]} states
 * @property {AutomatonTransition[]} transitions
 */

/**
 * Computes epsilon-closure of a set of states.
 * @param {Set<string>} stateIds
 * @param {AutomatonTransition[]} transitions
 * @returns {Set<string>}
 */
export function getEpsilonClosure(stateIds, transitions) {
  const closure = new Set(stateIds);
  const stack = Array.from(stateIds);

  while (stack.length > 0) {
    const curr = stack.pop();
    for (const tr of transitions) {
      if (tr.from === curr && (tr.symbol === EPSILON || tr.symbol === 'eps' || tr.symbol === '')) {
        if (!closure.has(tr.to)) {
          closure.add(tr.to);
          stack.push(tr.to);
        }
      }
    }
  }
  return closure;
}

/**
 * Moves from a set of states using a symbol, then returns epsilon-closure.
 * @param {Set<string>} currentStates
 * @param {string} symbol
 * @param {AutomatonTransition[]} transitions
 */
export function transitionStep(currentStates, symbol, transitions) {
  const nextStates = new Set();
  for (const s of currentStates) {
    for (const tr of transitions) {
      if (tr.from === s && tr.symbol === symbol) {
        nextStates.add(tr.to);
      }
    }
  }
  return getEpsilonClosure(nextStates, transitions);
}

/**
 * Simulates word step by step as a generator.
 * @param {Automaton} aut
 * @param {string} word
 */
export function* simulateWord(aut, word) {
  const startState = aut.states.find((s) => s.isStart);
  if (!startState) {
    yield { type: 'error', message: 'No start state defined' };
    return false;
  }

  let activeStates = getEpsilonClosure(new Set([startState.id]), aut.transitions);
  yield {
    type: 'step',
    charIndex: -1,
    char: null,
    activeStates: Array.from(activeStates),
    message: `Initial states: {${Array.from(activeStates).join(', ')}}`,
  };

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    activeStates = transitionStep(activeStates, ch, aut.transitions);
    yield {
      type: 'step',
      charIndex: i,
      char: ch,
      activeStates: Array.from(activeStates),
      message: `Read '${ch}' → {${Array.from(activeStates).join(', ')}}`,
    };
    if (activeStates.size === 0) {
      yield { type: 'rejected', message: `Word rejected: stuck at character '${ch}'` };
      return false;
    }
  }

  const acceptingSet = new Set(aut.states.filter((s) => s.isAccepting).map((s) => s.id));
  const accepted = Array.from(activeStates).some((s) => acceptingSet.has(s));

  yield {
    type: accepted ? 'accepted' : 'rejected',
    activeStates: Array.from(activeStates),
    accepted,
    message: accepted ? `Word '${word}' Accepted!` : `Word '${word}' Rejected! (no final state reached)`,
  };
  return accepted;
}

/**
 * Batch test multiple words against an automaton.
 * @param {Automaton} aut
 * @param {string[]} words
 */
export function batchTestWords(aut, words) {
  return words.map((w) => {
    const word = w.trim();
    const gen = simulateWord(aut, word);
    let last = null;
    let step = gen.next();
    while (!step.done) {
      last = step.value;
      step = gen.next();
    }
    return { word, accepted: Boolean(last && last.accepted) };
  });
}

/**
 * Validates automaton: checks alphabet, completeness (if DFA), unreachable states.
 * @param {Automaton} aut
 */
export function validateAutomaton(aut) {
  const alphabet = Array.from(
    new Set(aut.transitions.map((t) => t.symbol).filter((s) => s && s !== EPSILON && s !== 'eps')),
  ).sort();

  const startState = aut.states.find((s) => s.isStart);
  const reachable = new Set();
  if (startState) {
    const q = [startState.id];
    reachable.add(startState.id);
    while (q.length > 0) {
      const u = q.shift();
      for (const tr of aut.transitions) {
        if (tr.from === u && !reachable.has(tr.to)) {
          reachable.add(tr.to);
          q.push(tr.to);
        }
      }
    }
  }

  const unreachable = aut.states.filter((s) => !reachable.has(s.id)).map((s) => s.label || s.id);

  // Check DFA completeness
  let isCompleteDfa = true;
  for (const s of aut.states) {
    for (const a of alphabet) {
      const count = aut.transitions.filter((t) => t.from === s.id && t.symbol === a).length;
      if (count !== 1) {
        isCompleteDfa = false;
        break;
      }
    }
    // Check for epsilon transitions
    if (aut.transitions.some((t) => t.from === s.id && (t.symbol === EPSILON || t.symbol === 'eps'))) {
      isCompleteDfa = false;
    }
  }

  return {
    alphabet,
    hasStart: Boolean(startState),
    hasAccepting: aut.states.some((s) => s.isAccepting),
    unreachable,
    isCompleteDfa,
  };
}

/**
 * Converts an NFA to a DFA using Subset Construction.
 * @param {Automaton} nfa
 * @returns {Automaton}
 */
export function convertNfaToDfa(nfa) {
  const startState = nfa.states.find((s) => s.isStart);
  if (!startState) throw new Error('NFA has no start state');

  const alphabet = Array.from(
    new Set(nfa.transitions.map((t) => t.symbol).filter((s) => s && s !== EPSILON && s !== 'eps')),
  ).sort();

  const acceptingSet = new Set(nfa.states.filter((s) => s.isAccepting).map((s) => s.id));
  const q0Closure = Array.from(getEpsilonClosure(new Set([startState.id]), nfa.transitions)).sort();

  function stateKey(arr) {
    return arr.slice().sort().join(',');
  }

  const dfaStateMap = new Map();
  const queue = [q0Closure];
  const q0Key = stateKey(q0Closure);
  dfaStateMap.set(q0Key, {
    id: `q_0`,
    label: `{${q0Closure.join(',')}}`,
    isStart: true,
    isAccepting: q0Closure.some((s) => acceptingSet.has(s)),
  });

  const dfaTransitions = [];
  let stateIdCounter = 1;

  while (queue.length > 0) {
    const currentSubset = queue.shift();
    if (!currentSubset) break;
    const currKey = stateKey(currentSubset);
    const currDfaState = dfaStateMap.get(currKey);

    for (const a of alphabet) {
      const nextSubset = Array.from(transitionStep(new Set(currentSubset), a, nfa.transitions)).sort();
      if (nextSubset.length === 0) continue; // Trap state omitted or created
      const nextKey = stateKey(nextSubset);

      if (!dfaStateMap.has(nextKey)) {
        dfaStateMap.set(nextKey, {
          id: `q_${stateIdCounter++}`,
          label: `{${nextSubset.join(',')}}`,
          isStart: false,
          isAccepting: nextSubset.some((s) => acceptingSet.has(s)),
        });
        queue.push(nextSubset);
      }

      const nextDfaState = dfaStateMap.get(nextKey);
      dfaTransitions.push({
        id: `tr_${dfaTransitions.length + 1}`,
        from: currDfaState.id,
        to: nextDfaState.id,
        symbol: a,
      });
    }
  }

  // Layout states in grid/circle
  const dfaStates = Array.from(dfaStateMap.values()).map((s, idx) => ({
    ...s,
    x: 140 + (idx % 4) * 140,
    y: 100 + Math.floor(idx / 4) * 110,
  }));

  return {
    isDfa: true,
    alphabet,
    states: dfaStates,
    transitions: dfaTransitions,
  };
}

/**
 * Minimizes a DFA using the Table-Filling (Myhill-Nerode) algorithm.
 * @param {Automaton} dfa
 * @returns {Automaton}
 */
export function minimizeDfa(dfa) {
  const states = dfa.states;
  const n = states.length;
  if (n <= 1) return dfa;

  const alphabet = Array.from(new Set(dfa.transitions.map((t) => t.symbol).filter((s) => s && s !== EPSILON))).sort();

  // Step 1: transition table delta[stateId][char]
  const delta = new Map();
  for (const s of states) delta.set(s.id, new Map());
  for (const tr of dfa.transitions) {
    delta.get(tr.from)?.set(tr.symbol, tr.to);
  }

  // Step 2: Table filling distinguishable matrix
  const marked = Array.from({ length: n }, () => new Array(n).fill(false));
  const acceptingSet = new Set(states.filter((s) => s.isAccepting).map((s) => s.id));

  // Mark pairs where one is accepting and the other is not
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const a = acceptingSet.has(states[i].id);
      const b = acceptingSet.has(states[j].id);
      if (a !== b) {
        marked[i][j] = true;
      }
    }
  }

  // Iterate until fixed point
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (!marked[i][j]) {
          for (const ch of alphabet) {
            const nextI = delta.get(states[i].id)?.get(ch);
            const nextJ = delta.get(states[j].id)?.get(ch);
            if (nextI && nextJ) {
              const idxI = states.findIndex((s) => s.id === nextI);
              const idxJ = states.findIndex((s) => s.id === nextJ);
              const maxIdx = Math.max(idxI, idxJ);
              const minIdx = Math.min(idxI, idxJ);
              if (maxIdx !== minIdx && marked[maxIdx][minIdx]) {
                marked[i][j] = true;
                changed = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  // Step 3: Group equivalent states
  const parent = new Map();
  for (const s of states) parent.set(s.id, s.id);
  function find(i) {
    if (parent.get(i) === i) return i;
    const r = find(parent.get(i));
    parent.set(i, r);
    return r;
  }
  function union(i, j) {
    parent.set(find(i), find(j));
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (!marked[i][j]) {
        union(states[i].id, states[j].id);
      }
    }
  }

  const groups = new Map();
  for (const s of states) {
    const root = find(s.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)?.push(s);
  }

  const minStates = [];
  const minTransitions = [];
  let gIdx = 0;
  const oldToNewState = new Map();

  for (const group of groups.values()) {
    const newId = `m_${gIdx++}`;
    for (const s of group) oldToNewState.set(s.id, newId);
    minStates.push({
      id: newId,
      label: group.map((s) => s.label || s.id).join(','),
      isStart: group.some((s) => s.isStart),
      isAccepting: group.some((s) => s.isAccepting),
      x: 120 + ((gIdx - 1) % 4) * 140,
      y: 100 + Math.floor((gIdx - 1) / 4) * 110,
    });
  }

  const seenTransitions = new Set();
  for (const tr of dfa.transitions) {
    const fromNew = oldToNewState.get(tr.from);
    const toNew = oldToNewState.get(tr.to);
    const key = `${fromNew}->${toNew}:${tr.symbol}`;
    if (!seenTransitions.has(key)) {
      seenTransitions.add(key);
      minTransitions.push({
        id: `mtr_${minTransitions.length + 1}`,
        from: fromNew,
        to: toNew,
        symbol: tr.symbol,
      });
    }
  }

  return {
    isDfa: true,
    alphabet,
    states: minStates,
    transitions: minTransitions,
  };
}

/**
 * Converts regular expression to epsilon-NFA using Thompson's Construction.
 * Supports: letters/digits, '|' (union), '.' (concatenation implicit or explicit), '*' (Kleene), '+' (plus), '?' (optional), '()'
 * @param {string} regex
 * @returns {Automaton}
 */
export function regexToNfa(regex) {
  let stateCounter = 0;
  function newState() {
    return `q${stateCounter++}`;
  }

  // Insert explicit concatenation operators '.'
  const formatted = [];
  for (let i = 0; i < regex.length; i++) {
    const c1 = regex[i];
    formatted.push(c1);
    if (i + 1 < regex.length) {
      const c2 = regex[i + 1];
      if (c1 !== '(' && c1 !== '|' && c2 !== ')' && c2 !== '|' && c2 !== '*' && c2 !== '+' && c2 !== '?') {
        formatted.push('.');
      }
    }
  }

  // Shunting-yard to convert infix regex to postfix
  const prec = { '|': 1, '.': 2, '*': 3, '+': 3, '?': 3 };
  const postfix = [];
  const opStack = [];

  for (const token of formatted) {
    if (token === '(') {
      opStack.push(token);
    } else if (token === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        postfix.push(opStack.pop());
      }
      opStack.pop(); // pop '('
    } else if (prec[token]) {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1] !== '(' &&
        prec[opStack[opStack.length - 1]] >= prec[token]
      ) {
        postfix.push(opStack.pop());
      }
      opStack.push(token);
    } else {
      postfix.push(token);
    }
  }
  while (opStack.length > 0) postfix.push(opStack.pop());

  // Build Thompson fragments
  const stack = [];
  /** @type {AutomatonTransition[]} */
  const allTransitions = [];
  let trId = 1;

  for (const token of postfix) {
    if (token === '*') {
      const frag = stack.pop();
      const s = newState();
      const a = newState();
      allTransitions.push({ id: `t${trId++}`, from: s, to: frag.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: s, to: a, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: frag.accept, to: frag.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: frag.accept, to: a, symbol: EPSILON });
      stack.push({ start: s, accept: a });
    } else if (token === '+') {
      const frag = stack.pop();
      const s = newState();
      const a = newState();
      allTransitions.push({ id: `t${trId++}`, from: s, to: frag.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: frag.accept, to: frag.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: frag.accept, to: a, symbol: EPSILON });
      stack.push({ start: s, accept: a });
    } else if (token === '?') {
      const frag = stack.pop();
      const s = newState();
      const a = newState();
      allTransitions.push({ id: `t${trId++}`, from: s, to: frag.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: s, to: a, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: frag.accept, to: a, symbol: EPSILON });
      stack.push({ start: s, accept: a });
    } else if (token === '|') {
      const f2 = stack.pop();
      const f1 = stack.pop();
      const s = newState();
      const a = newState();
      allTransitions.push({ id: `t${trId++}`, from: s, to: f1.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: s, to: f2.start, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: f1.accept, to: a, symbol: EPSILON });
      allTransitions.push({ id: `t${trId++}`, from: f2.accept, to: a, symbol: EPSILON });
      stack.push({ start: s, accept: a });
    } else if (token === '.') {
      const f2 = stack.pop();
      const f1 = stack.pop();
      allTransitions.push({ id: `t${trId++}`, from: f1.accept, to: f2.start, symbol: EPSILON });
      stack.push({ start: f1.start, accept: f2.accept });
    } else {
      // Literal character
      const s = newState();
      const a = newState();
      allTransitions.push({ id: `t${trId++}`, from: s, to: a, symbol: token });
      stack.push({ start: s, accept: a });
    }
  }

  const finalFrag = stack.pop() || { start: newState(), accept: newState() };
  const allStateIds = new Set();
  for (const tr of allTransitions) {
    allStateIds.add(tr.from);
    allStateIds.add(tr.to);
  }
  allStateIds.add(finalFrag.start);
  allStateIds.add(finalFrag.accept);

  const states = Array.from(allStateIds).map((id, i) => ({
    id,
    label: id,
    isStart: id === finalFrag.start,
    isAccepting: id === finalFrag.accept,
    x: 80 + (i % 6) * 90,
    y: 80 + Math.floor(i / 6) * 90,
  }));

  const alphabet = Array.from(new Set(allTransitions.map((t) => t.symbol).filter((s) => s !== EPSILON))).sort();

  return {
    isDfa: false,
    alphabet,
    states,
    transitions: allTransitions,
  };
}

/**
 * Computes complement automaton (Sigma* \ L).
 * Requires DFA.
 * @param {Automaton} dfa
 */
export function complementDfa(dfa) {
  return {
    ...dfa,
    states: dfa.states.map((s) => ({
      ...s,
      isAccepting: !s.isAccepting,
    })),
  };
}

/**
 * Computes product automaton for Union or Intersection.
 * @param {Automaton} a1
 * @param {Automaton} a2
 * @param {'union' | 'intersection'} op
 */
export function productAutomaton(a1, a2, op = 'union') {
  const alphabet = Array.from(new Set([...a1.alphabet, ...a2.alphabet])).sort();
  const prodStates = [];
  const prodTransitions = [];
  let trId = 1;

  for (const s1 of a1.states) {
    for (const s2 of a2.states) {
      const isAccepting = op === 'union' ? s1.isAccepting || s2.isAccepting : s1.isAccepting && s2.isAccepting;
      prodStates.push({
        id: `(${s1.id},${s2.id})`,
        label: `${s1.label || s1.id},${s2.label || s2.id}`,
        isStart: s1.isStart && s2.isStart,
        isAccepting,
      });
    }
  }

  for (const s1 of a1.states) {
    for (const s2 of a2.states) {
      const fromId = `(${s1.id},${s2.id})`;
      for (const a of alphabet) {
        const tr1 = a1.transitions.find((t) => t.from === s1.id && t.symbol === a);
        const tr2 = a2.transitions.find((t) => t.from === s2.id && t.symbol === a);
        if (tr1 && tr2) {
          prodTransitions.push({
            id: `ptr_${trId++}`,
            from: fromId,
            to: `(${tr1.to},${tr2.to})`,
            symbol: a,
          });
        }
      }
    }
  }

  return {
    isDfa: true,
    alphabet,
    states: prodStates,
    transitions: prodTransitions,
  };
}
