// @ts-check

/**
 * Standardizes boolean expression symbols into JavaScript operators.
 * @param {string} expr
 */
export function standardizeExpression(expr) {
  let s = expr.trim();
  // Replace boolean operators
  s = s.replace(/∧|·|\*|&+/g, ' && ');
  s = s.replace(/∨|\+|\|+/g, ' || ');
  s = s.replace(/¬|!+|~/g, ' ! ');
  s = s.replace(/⊕/g, ' !== ');

  // Handle postfix prime notation: A' -> !A, (A+B)' -> !(A+B)
  s = s.replace(/([A-Za-z0-9_]+)'/g, '!$1');
  s = s.replace(/\)'/g, ') !');

  // Handle adjacent letters (implied AND): AB -> A && B
  s = s.replace(/([A-Za-z0-9_])\s*([A-Za-z0-9_])/g, '$1 && $2');
  s = s.replace(/([A-Za-z0-9_])\s*\(/g, '$1 && (');
  s = s.replace(/\)\s*([A-Za-z0-9_])/g, ') && $1');

  return s;
}

/**
 * Extracts unique variable names sorted alphabetically.
 * @param {string} expr
 * @returns {string[]}
 */
export function extractVariables(expr) {
  const matches = expr.match(/\b[A-Za-z][A-Za-z0-9_]*\b/g) || [];
  const reserved = new Set(['true', 'false', 'and', 'or', 'not', 'xor']);
  const vars = Array.from(new Set(matches.filter((m) => !reserved.has(m.toLowerCase())))).sort();
  return vars;
}

/**
 * Evaluates expression with variable assignments using a safe recursive descent parser.
 * @param {string} expr
 * @param {Record<string, number>} vars
 */
export function evaluateBoolean(expr, vars) {
  const std = standardizeExpression(expr);
  let pos = 0;

  function skipWhitespace() {
    while (pos < std.length && /\s/.test(std[pos])) pos++;
  }

  function parsePrimary() {
    skipWhitespace();
    if (pos >= std.length) return false;

    if (std[pos] === '(') {
      pos++; // consume '('
      const val = parseOr();
      skipWhitespace();
      if (std[pos] === ')') pos++; // consume ')'
      return val;
    }

    if (std[pos] === '!') {
      pos++;
      return !parsePrimary();
    }

    // Match identifier or literal
    let token = '';
    while (pos < std.length && /[A-Za-z0-9_]/.test(std[pos])) {
      token += std[pos++];
    }

    if (token === '1' || token.toLowerCase() === 'true') return true;
    if (token === '0' || token.toLowerCase() === 'false') return false;
    if (token in vars) return Boolean(vars[token]);

    return false;
  }

  function parseAnd() {
    let left = parsePrimary();
    skipWhitespace();
    while (pos < std.length) {
      if (std.startsWith('&&', pos)) {
        pos += 2;
        const right = parsePrimary();
        left = left && right;
        skipWhitespace();
      } else {
        break;
      }
    }
    return left;
  }

  function parseOr() {
    let left = parseAnd();
    skipWhitespace();
    while (pos < std.length) {
      if (std.startsWith('||', pos)) {
        pos += 2;
        const right = parseAnd();
        left = left || right;
        skipWhitespace();
      } else if (std.startsWith('!==', pos)) {
        pos += 3;
        const right = parseAnd();
        left = left !== right;
        skipWhitespace();
      } else {
        break;
      }
    }
    return left;
  }

  try {
    return parseOr() ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Generates truth table for boolean expression.
 * @param {string} expr
 */
export function generateExpressionTruthTable(expr) {
  const vars = extractVariables(expr);
  const n = vars.length;
  if (n === 0) return null;

  const numRows = Math.pow(2, n);
  const rows = [];
  let trueCount = 0;

  for (let r = 0; r < numRows; r++) {
    const assignment = {};
    for (let bit = 0; bit < n; bit++) {
      assignment[vars[bit]] = (r >> (n - 1 - bit)) & 1;
    }
    const val = evaluateBoolean(expr, assignment);
    if (val === 1) trueCount++;
    rows.push({ assignment, result: val });
  }

  const classification = trueCount === numRows ? 'tautology' : trueCount === 0 ? 'contradiction' : 'contingency';

  return {
    variables: vars,
    rows,
    classification,
    minterms: rows.map((r, i) => (r.result === 1 ? i : -1)).filter((i) => i >= 0),
  };
}

/**
 * Checks equivalence of two boolean expressions.
 * @param {string} expr1
 * @param {string} expr2
 */
export function checkEquivalence(expr1, expr2) {
  const vars = Array.from(new Set([...extractVariables(expr1), ...extractVariables(expr2)])).sort();
  const n = vars.length;
  const numRows = Math.pow(2, n);

  for (let r = 0; r < numRows; r++) {
    const assignment = {};
    for (let bit = 0; bit < n; bit++) {
      assignment[vars[bit]] = (r >> (n - 1 - bit)) & 1;
    }
    const val1 = evaluateBoolean(expr1, assignment);
    const val2 = evaluateBoolean(expr2, assignment);
    if (val1 !== val2) {
      return { equivalent: false, counterExample: assignment };
    }
  }
  return { equivalent: true, counterExample: null };
}

/**
 * Gray code order for Karnaugh maps.
 */
export const GRAY_2 = ['00', '01', '11', '10'];
export const GRAY_1 = ['0', '1'];

/**
 * Builds Karnaugh Map grid data for 2, 3, or 4 variables.
 * @param {string} expr
 */
export function buildKarnaughMap(expr) {
  const vars = extractVariables(expr);
  const n = vars.length;
  if (n < 2 || n > 4) return null;

  let rowVars = [];
  let colVars = [];
  let rowLabels = [];
  let colLabels = [];

  if (n === 2) {
    rowVars = [vars[0]];
    colVars = [vars[1]];
    rowLabels = GRAY_1;
    colLabels = GRAY_1;
  } else if (n === 3) {
    rowVars = [vars[0]];
    colVars = [vars[1], vars[2]];
    rowLabels = GRAY_1;
    colLabels = GRAY_2;
  } else if (n === 4) {
    rowVars = [vars[0], vars[1]];
    colVars = [vars[2], vars[3]];
    rowLabels = GRAY_2;
    colLabels = GRAY_2;
  }

  const grid = [];
  for (let r = 0; r < rowLabels.length; r++) {
    const row = [];
    for (let c = 0; c < colLabels.length; c++) {
      const assignment = {};
      const rowBits = rowLabels[r];
      const colBits = colLabels[c];

      rowVars.forEach((v, idx) => (assignment[v] = Number(rowBits[idx])));
      colVars.forEach((v, idx) => (assignment[v] = Number(colBits[idx])));

      const res = evaluateBoolean(expr, assignment);
      row.push({ assignment, result: res });
    }
    grid.push(row);
  }

  return {
    vars,
    rowVars: rowVars.join(''),
    colVars: colVars.join(''),
    rowLabels,
    colLabels,
    grid,
  };
}

/**
/**
 * Finds prime implicants for a set of integer terms.
 * @param {number[]} terms
 * @param {number} n
 * @returns {string[]}
 */
export function findPrimeImplicants(terms, n) {
  if (terms.length === 0) return [];
  if (terms.length === Math.pow(2, n)) return ['-'.repeat(n)];

  function toBin(m) {
    return m.toString(2).padStart(n, '0');
  }

  function countOnes(str) {
    return str.split('').filter((c) => c === '1').length;
  }

  function combine(s1, s2) {
    let diff = 0;
    let res = '';
    for (let i = 0; i < s1.length; i++) {
      if (s1[i] !== s2[i]) {
        diff++;
        res += '-';
      } else {
        res += s1[i];
      }
    }
    return diff === 1 ? res : null;
  }

  let groups = new Map();
  for (const m of terms) {
    const bin = toBin(m);
    const ones = countOnes(bin);
    if (!groups.has(ones)) groups.set(ones, new Set());
    groups.get(ones)?.add(bin);
  }

  const primeImplicants = new Set();

  while (groups.size > 0) {
    const nextGroups = new Map();
    const used = new Set();
    const sortedCounts = Array.from(groups.keys()).sort((a, b) => a - b);

    for (let i = 0; i < sortedCounts.length - 1; i++) {
      const c1 = sortedCounts[i];
      const c2 = sortedCounts[i + 1];
      if (c2 - c1 !== 1) continue;

      const set1 = groups.get(c1);
      const set2 = groups.get(c2);

      for (const t1 of set1) {
        for (const t2 of set2) {
          const combined = combine(t1, t2);
          if (combined) {
            used.add(t1);
            used.add(t2);
            const ones = countOnes(combined.replace(/-/g, '0'));
            if (!nextGroups.has(ones)) nextGroups.set(ones, new Set());
            nextGroups.get(ones)?.add(combined);
          }
        }
      }
    }

    for (const groupTerms of groups.values()) {
      for (const t of groupTerms) {
        if (!used.has(t)) primeImplicants.add(t);
      }
    }

    groups = nextGroups;
  }

  return Array.from(primeImplicants);
}

/**
 * Quine-McCluskey minimization algorithm
 * @param {number[]} minterms - List of integer minterms
 * @param {string[]} variables - Variable names
 */
export function quineMcCluskey(minterms, variables) {
  const n = variables.length;
  if (minterms.length === 0) return { dnf: '0', cnf: '0', primeImplicants: [] };
  if (minterms.length === Math.pow(2, n)) return { dnf: '1', cnf: '1', primeImplicants: ['1'] };

  const piList = findPrimeImplicants(minterms, n);

  // Form DNF expression
  const termsDnf = piList.map((pi) => {
    let term = '';
    for (let i = 0; i < pi.length; i++) {
      if (pi[i] === '1') term += variables[i];
      else if (pi[i] === '0') term += `${variables[i]}'`;
    }
    return term || '1';
  });

  const dnf = termsDnf.join(' + ') || '0';

  // Form CNF expression using maxterms
  const maxterms = [];
  const maxVal = Math.pow(2, n);
  for (let i = 0; i < maxVal; i++) {
    if (!minterms.includes(i)) maxterms.push(i);
  }

  const piMaxList = findPrimeImplicants(maxterms, n);
  const termsCnf = piMaxList
    .map((pi) => {
      const parts = [];
      for (let i = 0; i < pi.length; i++) {
        if (pi[i] === '0') parts.push(variables[i]);
        else if (pi[i] === '1') parts.push(`${variables[i]}'`);
      }
      return parts.length > 0 ? `(${parts.join(' + ')})` : '';
    })
    .filter(Boolean);

  const cnf = termsCnf.join(' · ') || '1';

  return {
    dnf,
    cnf,
    primeImplicants: piList,
  };
}
