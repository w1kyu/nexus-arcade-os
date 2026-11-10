// @ts-check
/**
 * Nexus Sheets Formula Engine
 * Robust recursive descent parser, evaluator, dependency DAG, and formula adjustment.
 */

// Error constants
export const ERRORS = {
  DIV0: '#DIV/0!',
  REF: '#REF!',
  NAME: '#NAME?',
  VALUE: '#VALUE!',
  NA: '#N/A!',
  NUM: '#NUM!',
};

/**
 * Converts a 0-indexed column number to letters (0 -> 'A', 25 -> 'Z', 26 -> 'AA').
 * @param {number} col
 * @returns {string}
 */
export function colToLetters(col) {
  let result = '';
  let n = col + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Converts column letters to a 0-indexed column number ('A' -> 0, 'AA' -> 26).
 * @param {string} letters
 * @returns {number}
 */
export function lettersToCol(letters) {
  let result = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Parses a cell coordinate like "A1", "$B$4", "Sheet1!C3", "'My Sheet'!$A$1".
 * @param {string} str
 * @returns {{ sheet?: string, col: number, row: number, colFixed: boolean, rowFixed: boolean } | null}
 */
export function parseCellAddress(str) {
  const match = str.trim().match(/^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+)(\$?)([0-9]+)$/);
  if (!match) return null;
  const sheet = match[1] || match[2] || undefined;
  const colFixed = match[3] === '$';
  const col = lettersToCol(match[4]);
  const rowFixed = match[5] === '$';
  const row = parseInt(match[6], 10) - 1;
  if (col < 0 || row < 0) return null;
  return { sheet, col, row, colFixed, rowFixed };
}

/**
 * Formats a coordinate into a reference string.
 * @param {number} col
 * @param {number} row
 * @param {boolean} [colFixed=false]
 * @param {boolean} [rowFixed=false]
 * @param {string} [sheet]
 * @returns {string}
 */
export function formatCellAddress(col, row, colFixed = false, rowFixed = false, sheet = undefined) {
  const colStr = (colFixed ? '$' : '') + colToLetters(col);
  const rowStr = (rowFixed ? '$' : '') + (row + 1);
  const prefix = sheet ? (/[^A-Za-z0-9_]/.test(sheet) ? `'${sheet}'!` : `${sheet}!`) : '';
  return `${prefix}${colStr}${rowStr}`;
}

/**
 * Parses a range reference like "A1:B5" or "Sheet1!A1:C10".
 * @param {string} str
 * @returns {{ sheet?: string, startCol: number, startRow: number, endCol: number, endRow: number } | null}
 */
export function parseRangeAddress(str) {
  const parts = str.trim().split(':');
  if (parts.length !== 2) return null;
  const start = parseCellAddress(parts[0]);
  if (!start) return null;
  // End might have its own sheet or inherit from start
  let endStr = parts[1];
  if (!endStr.includes('!') && start.sheet) {
    endStr = `${start.sheet}!${endStr}`;
  }
  const end = parseCellAddress(endStr);
  if (!end) return null;

  return {
    sheet: start.sheet,
    startCol: Math.min(start.col, end.col),
    startRow: Math.min(start.row, end.row),
    endCol: Math.max(start.col, end.col),
    endRow: Math.max(start.row, end.row),
  };
}

/**
 * Token types for formula parser.
 */
const TOKEN = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
  CELL: 'CELL',
  RANGE: 'RANGE',
  FUNC: 'FUNC',
  OP: 'OP',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  EOF: 'EOF',
};

/**
 * Tokenizes a formula string (starting with or without '=').
 * @param {string} formula
 * @returns {Array<{ type: string, value: any, raw: string, col?: number, row?: number, colFixed?: boolean, rowFixed?: boolean, range?: any, sheet?: string }>}
 */
export function tokenizeFormula(formula) {
  let s = formula.trim();
  if (s.startsWith('=')) s = s.slice(1);

  const tokens = [];
  let i = 0;
  const len = s.length;

  while (i < len) {
    const c = s[i];

    // whitespace
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // Number literal
    if (/[0-9]/.test(c) || (c === '.' && i + 1 < len && /[0-9]/.test(s[i + 1]))) {
      let numStr = '';
      while (i < len && /[0-9.]/.test(s[i])) {
        numStr += s[i];
        i++;
      }
      tokens.push({ type: TOKEN.NUMBER, value: parseFloat(numStr), raw: numStr });
      continue;
    }

    // String literal "..."
    if (c === '"') {
      let str = '';
      i++; // skip opening quote
      while (i < len) {
        if (s[i] === '"') {
          if (i + 1 < len && s[i + 1] === '"') {
            str += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          str += s[i];
          i++;
        }
      }
      tokens.push({ type: TOKEN.STRING, value: str, raw: `"${str}"` });
      continue;
    }

    // Operators
    if (c === '<') {
      if (s[i + 1] === '=') {
        tokens.push({ type: TOKEN.OP, value: '<=', raw: '<=' });
        i += 2;
      } else if (s[i + 1] === '>') {
        tokens.push({ type: TOKEN.OP, value: '<>', raw: '<>' });
        i += 2;
      } else {
        tokens.push({ type: TOKEN.OP, value: '<', raw: '<' });
        i++;
      }
      continue;
    }
    if (c === '>') {
      if (s[i + 1] === '=') {
        tokens.push({ type: TOKEN.OP, value: '>=', raw: '>=' });
        i += 2;
      } else {
        tokens.push({ type: TOKEN.OP, value: '>', raw: '>' });
        i++;
      }
      continue;
    }
    if ('+-*/^%&='.includes(c)) {
      tokens.push({ type: TOKEN.OP, value: c, raw: c });
      i++;
      continue;
    }

    // Punctuation
    if (c === '(') {
      tokens.push({ type: TOKEN.LPAREN, value: '(', raw: '(' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: TOKEN.RPAREN, value: ')', raw: ')' });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ type: TOKEN.COMMA, value: ',', raw: ',' });
      i++;
      continue;
    }

    // Identifiers: Sheet refs, Cell refs, Range refs, Function names, Booleans
    // Could start with a single-quoted sheet name 'My Sheet'!A1
    let refOrIdent = '';
    if (c === "'") {
      let endQuote = s.indexOf("'", i + 1);
      if (endQuote !== -1 && s[endQuote + 1] === '!') {
        refOrIdent = s.slice(i, endQuote + 2);
        i = endQuote + 2;
      }
    }

    let identPart = '';
    while (i < len && /[A-Za-z0-9_$.!]/.test(s[i])) {
      identPart += s[i];
      i++;
    }
    const fullIdent = refOrIdent + identPart;

    // Check if it's a range like A1:B10 or Sheet1!A1:B10
    if (i < len && s[i] === ':') {
      i++; // skip ':'
      let nextPart = '';
      while (i < len && /[A-Za-z0-9_$]/.test(s[i])) {
        nextPart += s[i];
        i++;
      }
      const rangeStr = `${fullIdent}:${nextPart}`;
      const parsedRange = parseRangeAddress(rangeStr);
      if (parsedRange) {
        tokens.push({ type: TOKEN.RANGE, value: rangeStr, raw: rangeStr, range: parsedRange });
        continue;
      }
    }

    // Check if followed by '(' -> Function call
    if (i < len && s[i] === '(') {
      tokens.push({ type: TOKEN.FUNC, value: fullIdent.toUpperCase(), raw: fullIdent });
      continue;
    }

    // Check for boolean
    const upper = fullIdent.toUpperCase();
    if (upper === 'TRUE') {
      tokens.push({ type: TOKEN.BOOLEAN, value: true, raw: fullIdent });
      continue;
    }
    if (upper === 'FALSE') {
      tokens.push({ type: TOKEN.BOOLEAN, value: false, raw: fullIdent });
      continue;
    }

    // Check for cell reference
    const cellAddr = parseCellAddress(fullIdent);
    if (cellAddr) {
      tokens.push({
        type: TOKEN.CELL,
        value: fullIdent,
        raw: fullIdent,
        sheet: cellAddr.sheet,
        col: cellAddr.col,
        row: cellAddr.row,
        colFixed: cellAddr.colFixed,
        rowFixed: cellAddr.rowFixed,
      });
      continue;
    }

    // Unrecognized token or standalone identifier (treat as name)
    tokens.push({ type: TOKEN.OP, value: fullIdent, raw: fullIdent });
  }

  tokens.push({ type: TOKEN.EOF, value: '', raw: '' });
  return tokens;
}

/**
 * Parser for mathematical and spreadsheet expressions into an AST.
 */
class FormulaParser {
  /**
   * @param {ReturnType<typeof tokenizeFormula>} tokens
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  current() {
    return this.tokens[this.pos];
  }

  consume(expectedType = undefined, expectedVal = undefined) {
    const tok = this.current();
    if (expectedType && tok.type !== expectedType) {
      throw new Error(`Expected token type ${expectedType}, got ${tok.type}`);
    }
    if (expectedVal !== undefined && tok.value !== expectedVal) {
      throw new Error(`Expected ${expectedVal}, got ${tok.value}`);
    }
    this.pos++;
    return tok;
  }

  parse() {
    if (this.current().type === TOKEN.EOF) return null;
    const node = this.parseComparison();
    return node;
  }

  // Precedence level 1: Comparison (=, <>, <, <=, >, >=)
  parseComparison() {
    let node = this.parseConcat();
    while (['=', '<>', '<', '<=', '>', '>='].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.parseConcat();
      node = { type: 'Binary', op, left: node, right };
    }
    return node;
  }

  // Precedence level 2: String concatenation (&)
  parseConcat() {
    let node = this.parseAdditive();
    while (this.current().value === '&') {
      const op = this.consume().value;
      const right = this.parseAdditive();
      node = { type: 'Binary', op, left: node, right };
    }
    return node;
  }

  // Precedence level 3: Addition & Subtraction (+, -)
  parseAdditive() {
    let node = this.parseMultiplicative();
    while (['+', '-'].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      node = { type: 'Binary', op, left: node, right };
    }
    return node;
  }

  // Precedence level 4: Multiplication & Division (*, /)
  parseMultiplicative() {
    let node = this.parsePower();
    while (['*', '/'].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.parsePower();
      node = { type: 'Binary', op, left: node, right };
    }
    return node;
  }

  // Precedence level 5: Power (^)
  parsePower() {
    let node = this.parseUnary();
    while (this.current().value === '^') {
      const op = this.consume().value;
      const right = this.parseUnary();
      node = { type: 'Binary', op, left: node, right };
    }
    return node;
  }

  // Precedence level 6: Unary (+, -)
  parseUnary() {
    if (['+', '-'].includes(this.current().value)) {
      const op = this.consume().value;
      const arg = this.parseUnary();
      return { type: 'Unary', op, arg };
    }
    return this.parsePrimary();
  }

  // Primary: literals, references, function calls, grouped expr
  parsePrimary() {
    const tok = this.current();

    if (tok.type === TOKEN.NUMBER || tok.type === TOKEN.STRING || tok.type === TOKEN.BOOLEAN) {
      this.consume();
      return { type: 'Literal', value: tok.value };
    }

    if (tok.type === TOKEN.CELL) {
      this.consume();
      return {
        type: 'CellRef',
        sheet: tok.sheet,
        col: tok.col,
        row: tok.row,
        colFixed: tok.colFixed,
        rowFixed: tok.rowFixed,
        raw: tok.raw,
      };
    }

    if (tok.type === TOKEN.RANGE) {
      this.consume();
      return {
        type: 'RangeRef',
        sheet: tok.range.sheet,
        startCol: tok.range.startCol,
        startRow: tok.range.startRow,
        endCol: tok.range.endCol,
        endRow: tok.range.endRow,
        raw: tok.raw,
      };
    }

    if (tok.type === TOKEN.FUNC) {
      const funcName = this.consume().value;
      this.consume(TOKEN.LPAREN);
      const args = [];
      if (this.current().type !== TOKEN.RPAREN) {
        while (true) {
          args.push(this.parseComparison());
          if (this.current().type === TOKEN.COMMA) {
            this.consume(TOKEN.COMMA);
          } else {
            break;
          }
        }
      }
      this.consume(TOKEN.RPAREN);
      return { type: 'FunctionCall', name: funcName, args };
    }

    if (tok.type === TOKEN.LPAREN) {
      this.consume(TOKEN.LPAREN);
      const inner = this.parseComparison();
      this.consume(TOKEN.RPAREN);
      return inner;
    }

    throw new Error(`Unexpected token: ${tok.raw || tok.type}`);
  }
}

/**
 * Extracts all cell dependencies from a formula string.
 * @param {string} formula
 * @param {string} [currentSheet='']
 * @returns {Array<{ sheet: string, col: number, row: number }>}
 */
export function extractDependencies(formula, currentSheet = '') {
  if (!formula || !formula.startsWith('=')) return [];
  const tokens = tokenizeFormula(formula);
  const deps = [];
  const seen = new Set();

  for (const t of tokens) {
    if (t.type === TOKEN.CELL) {
      const sheet = t.sheet || currentSheet;
      const key = `${sheet}:${t.col}:${t.row}`;
      if (!seen.has(key)) {
        seen.add(key);
        deps.push({ sheet, col: /** @type {number} */ (t.col), row: /** @type {number} */ (t.row) });
      }
    } else if (t.type === TOKEN.RANGE && t.range) {
      const sheet = t.range.sheet || currentSheet;
      for (let r = t.range.startRow; r <= t.range.endRow; r++) {
        for (let c = t.range.startCol; c <= t.range.endCol; c++) {
          const key = `${sheet}:${c}:${r}`;
          if (!seen.has(key)) {
            seen.add(key);
            deps.push({ sheet, col: c, row: r });
          }
        }
      }
    }
  }

  return deps;
}

/**
 * Shifts formula cell references by deltaCol and deltaRow, respecting $ anchors.
 * @param {string} formula
 * @param {number} deltaCol
 * @param {number} deltaRow
 * @returns {string}
 */
export function shiftFormula(formula, deltaCol, deltaRow) {
  if (!formula.startsWith('=')) return formula;
  const isEquation = formula.startsWith('=');
  let body = isEquation ? formula.slice(1) : formula;

  // Replace cell and range references via regex preserving $
  // Matches optional sheet prefix, $?Letters, $?Digits
  return (
    '=' +
    body.replace(
      /(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+)(\$?)([0-9]+)/g,
      (match, singleQuotedSheet, normalSheet, colDollar, colLetters, rowDollar, rowDigits) => {
        const sheetPrefix = singleQuotedSheet ? `'${singleQuotedSheet}'!` : normalSheet ? `${normalSheet}!` : '';
        const colFixed = colDollar === '$';
        const rowFixed = rowDollar === '$';

        let col = lettersToCol(colLetters);
        let row = parseInt(rowDigits, 10) - 1;

        if (!colFixed) col += deltaCol;
        if (!rowFixed) row += deltaRow;

        if (col < 0 || row < 0) return ERRORS.REF;
        return `${sheetPrefix}${colFixed ? '$' : ''}${colToLetters(col)}${rowFixed ? '$' : ''}${row + 1}`;
      },
    )
  );
}

/**
 * Evaluates an AST node with a cell-lookup context.
 * @param {any} node
 * @param {object} ctx
 * @param {(sheet: string, col: number, row: number) => any} ctx.getCellValue
 * @param {(sheet: string, startCol: number, startRow: number, endCol: number, endRow: number) => any[][]} ctx.getRangeValues
 * @param {string} currentSheet
 * @returns {any}
 */
export function evaluateAST(node, ctx, currentSheet) {
  if (!node) return '';

  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'CellRef': {
      const sheet = node.sheet || currentSheet;
      const val = ctx.getCellValue(sheet, node.col, node.row);
      return val === undefined || val === null ? '' : val;
    }

    case 'RangeRef': {
      const sheet = node.sheet || currentSheet;
      return ctx.getRangeValues(sheet, node.startCol, node.startRow, node.endCol, node.endRow);
    }

    case 'Unary': {
      const val = evaluateAST(node.arg, ctx, currentSheet);
      if (typeof val === 'string' && val.startsWith('#')) return val;
      const num = Number(val);
      if (isNaN(num)) return ERRORS.VALUE;
      return node.op === '-' ? -num : +num;
    }

    case 'Binary': {
      const left = evaluateAST(node.left, ctx, currentSheet);
      if (typeof left === 'string' && left.startsWith('#')) return left;
      const right = evaluateAST(node.right, ctx, currentSheet);
      if (typeof right === 'string' && right.startsWith('#')) return right;

      if (node.op === '&') {
        return String(left ?? '') + String(right ?? '');
      }

      if (['=', '<>', '<', '<=', '>', '>='].includes(node.op)) {
        return compareValues(left, right, node.op);
      }

      const numLeft = Number(left);
      const numRight = Number(right);
      if (isNaN(numLeft) || isNaN(numRight)) return ERRORS.VALUE;

      switch (node.op) {
        case '+':
          return numLeft + numRight;
        case '-':
          return numLeft - numRight;
        case '*':
          return numLeft * numRight;
        case '/':
          return numRight === 0 ? ERRORS.DIV0 : numLeft / numRight;
        case '^':
          return Math.pow(numLeft, numRight);
        default:
          return ERRORS.VALUE;
      }
    }

    case 'FunctionCall': {
      return executeFunction(node.name, node.args, ctx, currentSheet);
    }

    default:
      return ERRORS.VALUE;
  }
}

/**
 * Compares two values for spreadsheet relational operators.
 * @param {any} a
 * @param {any} b
 * @param {string} op
 * @returns {boolean}
 */
function compareValues(a, b, op) {
  // Case-insensitive string comparison if both are strings
  if (typeof a === 'string' && typeof b === 'string') {
    const cmp = a.localeCompare(b, undefined, { sensitivity: 'accent' });
    switch (op) {
      case '=':
        return cmp === 0;
      case '<>':
        return cmp !== 0;
      case '<':
        return cmp < 0;
      case '<=':
        return cmp <= 0;
      case '>':
        return cmp > 0;
      case '>=':
        return cmp >= 0;
    }
  }

  const numA = Number(a);
  const numB = Number(b);
  const useNum = !isNaN(numA) && !isNaN(numB);

  const valA = useNum ? numA : a;
  const valB = useNum ? numB : b;

  switch (op) {
    case '=':
      return valA === valB;
    case '<>':
      return valA !== valB;
    case '<':
      return valA < valB;
    case '<=':
      return valA <= valB;
    case '>':
      return valA > valB;
    case '>=':
      return valA >= valB;
    default:
      return false;
  }
}

/**
 * Flattens array arguments (including 2D range results) into a 1D array of values.
 * @param {any[]} args
 * @returns {any[]}
 */
export function flattenValues(args) {
  const result = [];
  for (const item of args) {
    if (Array.isArray(item)) {
      result.push(...flattenValues(item));
    } else if (item !== null && item !== undefined && item !== '') {
      result.push(item);
    }
  }
  return result;
}

/**
 * Executes a built-in spreadsheet function.
 * @param {string} name
 * @param {any[]} rawArgs
 * @param {any} ctx
 * @param {string} currentSheet
 * @returns {any}
 */
export function executeFunction(name, rawArgs, ctx, currentSheet) {
  const upper = name.toUpperCase();

  // Lazy evaluation for control flow functions
  if (upper === 'IF') {
    if (rawArgs.length < 2 || rawArgs.length > 3) return ERRORS.NA;
    const cond = evaluateAST(rawArgs[0], ctx, currentSheet);
    if (typeof cond === 'string' && cond.startsWith('#')) return cond;
    if (cond) {
      return evaluateAST(rawArgs[1], ctx, currentSheet);
    } else {
      return rawArgs.length === 3 ? evaluateAST(rawArgs[2], ctx, currentSheet) : false;
    }
  }

  if (upper === 'IFS') {
    if (rawArgs.length === 0 || rawArgs.length % 2 !== 0) return ERRORS.NA;
    for (let i = 0; i < rawArgs.length; i += 2) {
      const cond = evaluateAST(rawArgs[i], ctx, currentSheet);
      if (typeof cond === 'string' && cond.startsWith('#')) return cond;
      if (cond) {
        return evaluateAST(rawArgs[i + 1], ctx, currentSheet);
      }
    }
    return ERRORS.NA;
  }

  // Evaluate arguments for regular functions
  const args = rawArgs.map((arg) => evaluateAST(arg, ctx, currentSheet));

  // Propagate errors from arguments
  for (const arg of args) {
    if (typeof arg === 'string' && arg.startsWith('#') && !['IF', 'ISERROR', 'IFERROR'].includes(upper)) {
      return arg;
    }
  }

  switch (upper) {
    // --- Math & Stats ---
    case 'SUM': {
      const vals = flattenValues(args);
      let sum = 0;
      for (const v of vals) {
        const n = Number(v);
        if (!isNaN(n)) sum += n;
      }
      return sum;
    }

    case 'AVERAGE': {
      const vals = flattenValues(args);
      let sum = 0;
      let count = 0;
      for (const v of vals) {
        const n = Number(v);
        if (!isNaN(n)) {
          sum += n;
          count++;
        }
      }
      return count === 0 ? ERRORS.DIV0 : sum / count;
    }

    case 'MIN': {
      const vals = flattenValues(args);
      const nums = vals.map(Number).filter((n) => !isNaN(n));
      return nums.length === 0 ? 0 : Math.min(...nums);
    }

    case 'MAX': {
      const vals = flattenValues(args);
      const nums = vals.map(Number).filter((n) => !isNaN(n));
      return nums.length === 0 ? 0 : Math.max(...nums);
    }

    case 'ROUND': {
      if (args.length < 1) return ERRORS.NA;
      const val = Number(args[0]);
      const dec = args.length > 1 ? Number(args[1]) : 0;
      if (isNaN(val) || isNaN(dec)) return ERRORS.VALUE;
      const factor = Math.pow(10, dec);
      return Math.round(val * factor) / factor;
    }

    case 'ABS': {
      if (args.length < 1) return ERRORS.NA;
      const n = Number(args[0]);
      return isNaN(n) ? ERRORS.VALUE : Math.abs(n);
    }

    case 'SQRT': {
      if (args.length < 1) return ERRORS.NA;
      const n = Number(args[0]);
      if (isNaN(n) || n < 0) return ERRORS.NUM;
      return Math.sqrt(n);
    }

    case 'POWER': {
      if (args.length < 2) return ERRORS.NA;
      const base = Number(args[0]);
      const exp = Number(args[1]);
      if (isNaN(base) || isNaN(exp)) return ERRORS.VALUE;
      return Math.pow(base, exp);
    }

    case 'MOD': {
      if (args.length < 2) return ERRORS.NA;
      const n = Number(args[0]);
      const d = Number(args[1]);
      if (isNaN(n) || isNaN(d)) return ERRORS.VALUE;
      if (d === 0) return ERRORS.DIV0;
      return ((n % d) + d) % d;
    }

    case 'STDEV': {
      const vals = flattenValues(args);
      const nums = vals.map(Number).filter((n) => !isNaN(n));
      if (nums.length < 2) return ERRORS.DIV0;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (nums.length - 1);
      return Math.sqrt(variance);
    }

    case 'MEDIAN': {
      const vals = flattenValues(args);
      const nums = vals
        .map(Number)
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      if (nums.length === 0) return ERRORS.NUM;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }

    case 'RAND':
      return Math.random();

    case 'RANDBETWEEN': {
      if (args.length < 2) return ERRORS.NA;
      const min = Math.ceil(Number(args[0]));
      const max = Math.floor(Number(args[1]));
      if (isNaN(min) || isNaN(max)) return ERRORS.VALUE;
      if (min > max) return ERRORS.NUM;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // --- Counting & Conditional ---
    case 'COUNT': {
      const vals = flattenValues(args);
      let count = 0;
      for (const v of vals) {
        if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))) {
          count++;
        }
      }
      return count;
    }

    case 'COUNTA': {
      const vals = flattenValues(args);
      return vals.filter((v) => v !== '' && v !== null && v !== undefined).length;
    }

    case 'COUNTIF': {
      if (args.length < 2) return ERRORS.NA;
      const rangeVals = flattenValues([args[0]]);
      const criteria = args[1];
      let matches = 0;
      for (const val of rangeVals) {
        if (matchesCriteria(val, criteria)) matches++;
      }
      return matches;
    }

    case 'SUMIF': {
      if (args.length < 2) return ERRORS.NA;
      const criteriaRange = flattenValues([args[0]]);
      const criteria = args[1];
      const sumRange = args.length >= 3 ? flattenValues([args[2]]) : criteriaRange;

      let sum = 0;
      for (let i = 0; i < criteriaRange.length; i++) {
        if (matchesCriteria(criteriaRange[i], criteria)) {
          const n = Number(sumRange[i]);
          if (!isNaN(n)) sum += n;
        }
      }
      return sum;
    }

    case 'AVERAGEIF': {
      if (args.length < 2) return ERRORS.NA;
      const criteriaRange = flattenValues([args[0]]);
      const criteria = args[1];
      const avgRange = args.length >= 3 ? flattenValues([args[2]]) : criteriaRange;

      let sum = 0;
      let count = 0;
      for (let i = 0; i < criteriaRange.length; i++) {
        if (matchesCriteria(criteriaRange[i], criteria)) {
          const n = Number(avgRange[i]);
          if (!isNaN(n)) {
            sum += n;
            count++;
          }
        }
      }
      return count === 0 ? ERRORS.DIV0 : sum / count;
    }

    // --- Logical ---
    case 'AND': {
      const vals = flattenValues(args);
      if (vals.length === 0) return ERRORS.VALUE;
      return vals.every(Boolean);
    }

    case 'OR': {
      const vals = flattenValues(args);
      if (vals.length === 0) return ERRORS.VALUE;
      return vals.some(Boolean);
    }

    case 'NOT': {
      if (args.length < 1) return ERRORS.NA;
      return !args[0];
    }

    // --- Text ---
    case 'CONCAT': {
      const vals = flattenValues(args);
      return vals.map((v) => (v === null || v === undefined ? '' : String(v))).join('');
    }

    case 'LEFT': {
      if (args.length < 1) return ERRORS.NA;
      const text = String(args[0] ?? '');
      const n = args.length > 1 ? Number(args[1]) : 1;
      return isNaN(n) ? ERRORS.VALUE : text.slice(0, Math.max(0, n));
    }

    case 'RIGHT': {
      if (args.length < 1) return ERRORS.NA;
      const text = String(args[0] ?? '');
      const n = args.length > 1 ? Number(args[1]) : 1;
      return isNaN(n) ? ERRORS.VALUE : text.slice(Math.max(0, text.length - n));
    }

    case 'MID': {
      if (args.length < 3) return ERRORS.NA;
      const text = String(args[0] ?? '');
      const start = Number(args[1]);
      const len = Number(args[2]);
      if (isNaN(start) || isNaN(len) || start < 1 || len < 0) return ERRORS.VALUE;
      return text.slice(start - 1, start - 1 + len);
    }

    case 'LEN': {
      if (args.length < 1) return ERRORS.NA;
      return String(args[0] ?? '').length;
    }

    case 'UPPER':
      return args.length < 1 ? ERRORS.NA : String(args[0] ?? '').toUpperCase();

    case 'LOWER':
      return args.length < 1 ? ERRORS.NA : String(args[0] ?? '').toLowerCase();

    case 'TRIM':
      return args.length < 1 ? ERRORS.NA : String(args[0] ?? '').trim();

    // --- Date & Time ---
    case 'TODAY': {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    case 'NOW': {
      return new Date().toISOString();
    }

    case 'DATE': {
      if (args.length < 3) return ERRORS.NA;
      const y = Number(args[0]);
      const m = Number(args[1]);
      const d = Number(args[2]);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return ERRORS.VALUE;
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toISOString().slice(0, 10);
    }

    case 'YEAR': {
      if (args.length < 1) return ERRORS.NA;
      const dt = new Date(args[0]);
      return isNaN(dt.getTime()) ? ERRORS.VALUE : dt.getFullYear();
    }

    case 'MONTH': {
      if (args.length < 1) return ERRORS.NA;
      const dt = new Date(args[0]);
      return isNaN(dt.getTime()) ? ERRORS.VALUE : dt.getMonth() + 1;
    }

    case 'DAY': {
      if (args.length < 1) return ERRORS.NA;
      const dt = new Date(args[0]);
      return isNaN(dt.getTime()) ? ERRORS.VALUE : dt.getDate();
    }

    // --- Lookups ---
    case 'VLOOKUP': {
      if (args.length < 3) return ERRORS.NA;
      const lookupVal = args[0];
      const table = args[1]; // Expected to be 2D array: [row1, row2, ...]
      const colIndex = Number(args[2]) - 1; // 1-based in Excel
      const exactMatch = args.length > 3 ? !args[3] : false; // default approximate or exact

      if (!Array.isArray(table) || table.length === 0 || !Array.isArray(table[0])) return ERRORS.NA;
      if (colIndex < 0 || colIndex >= table[0].length) return ERRORS.REF;

      for (let r = 0; r < table.length; r++) {
        const cellVal = table[r][0];
        if (matchesLookup(cellVal, lookupVal, exactMatch)) {
          return table[r][colIndex] ?? '';
        }
      }
      return ERRORS.NA;
    }

    case 'XLOOKUP': {
      if (args.length < 3) return ERRORS.NA;
      const lookupVal = args[0];
      const lookupArray = flattenValues([args[1]]);
      const returnArray = flattenValues([args[2]]);
      const ifNotFound = args.length > 3 ? args[3] : ERRORS.NA;

      for (let i = 0; i < lookupArray.length; i++) {
        if (matchesLookup(lookupArray[i], lookupVal, true)) {
          return returnArray[i] ?? '';
        }
      }
      return ifNotFound;
    }

    case 'INDEX': {
      if (args.length < 2) return ERRORS.NA;
      const range = args[0];
      const rowNum = Number(args[1]) - 1;
      const colNum = args.length > 2 ? Number(args[2]) - 1 : 0;

      if (!Array.isArray(range)) return ERRORS.VALUE;
      if (Array.isArray(range[0])) {
        if (rowNum < 0 || rowNum >= range.length) return ERRORS.REF;
        if (colNum < 0 || colNum >= range[0].length) return ERRORS.REF;
        return range[rowNum][colNum];
      } else {
        if (rowNum < 0 || rowNum >= range.length) return ERRORS.REF;
        return range[rowNum];
      }
    }

    case 'MATCH': {
      if (args.length < 2) return ERRORS.NA;
      const lookupVal = args[0];
      const arr = flattenValues([args[1]]);
      const matchType = args.length > 2 ? Number(args[2]) : 1;

      for (let i = 0; i < arr.length; i++) {
        if (matchType === 0) {
          if (matchesLookup(arr[i], lookupVal, true)) return i + 1;
        } else {
          if (matchesLookup(arr[i], lookupVal, false)) return i + 1;
        }
      }
      return ERRORS.NA;
    }

    default:
      return ERRORS.NAME;
  }
}

/**
 * Matches criteria like ">5", "<=10", "<>test", or exact equality.
 * @param {any} val
 * @param {any} criteria
 * @returns {boolean}
 */
function matchesCriteria(val, criteria) {
  if (typeof criteria === 'string') {
    const match = criteria.match(/^([<>=!]+)(.*)$/);
    if (match) {
      const op = match[1] === '!=' ? '<>' : match[1];
      const targetStr = match[2].trim();
      const numTarget = Number(targetStr);
      const numVal = Number(val);
      const useNum = !isNaN(numTarget) && !isNaN(numVal);
      return compareValues(useNum ? numVal : val, useNum ? numTarget : targetStr, op);
    }
    return String(val).toLowerCase() === criteria.toLowerCase();
  }
  return val === criteria;
}

/**
 * Matches a cell value against a lookup value.
 * @param {any} cellVal
 * @param {any} lookupVal
 * @param {boolean} exact
 * @returns {boolean}
 */
function matchesLookup(cellVal, lookupVal, exact) {
  if (exact) {
    if (typeof cellVal === 'string' && typeof lookupVal === 'string') {
      return cellVal.toLowerCase() === lookupVal.toLowerCase();
    }
    return cellVal === lookupVal;
  }
  return cellVal === lookupVal;
}

/**
 * Evaluates a formula string given a context.
 * @param {string} formula
 * @param {object} ctx
 * @param {(sheet: string, col: number, row: number) => any} ctx.getCellValue
 * @param {(sheet: string, startCol: number, startRow: number, endCol: number, endRow: number) => any[][]} ctx.getRangeValues
 * @param {string} [currentSheet='']
 * @returns {any}
 */
export function evaluateFormula(formula, ctx, currentSheet = '') {
  if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) {
    return formula;
  }
  try {
    const tokens = tokenizeFormula(formula);
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    return evaluateAST(ast, ctx, currentSheet);
  } catch {
    return ERRORS.VALUE;
  }
}

/**
 * Dependency graph and topological recomputation for a spreadsheet.
 */
export class DependencyGraph {
  constructor() {
    /** @type {Map<string, Set<string>>} cell -> cells that depend on it */
    this.dependents = new Map();
    /** @type {Map<string, Set<string>>} cell -> cells it depends on */
    this.dependencies = new Map();
  }

  /**
   * Sets dependencies for a cell.
   * @param {string} cellKey "sheet:col:row"
   * @param {string[]} depKeys
   */
  setDependencies(cellKey, depKeys) {
    // Clear old dependencies
    const oldDeps = this.dependencies.get(cellKey);
    if (oldDeps) {
      for (const d of oldDeps) {
        this.dependents.get(d)?.delete(cellKey);
      }
    }

    const newSet = new Set(depKeys);
    this.dependencies.set(cellKey, newSet);

    for (const d of newSet) {
      if (!this.dependents.has(d)) {
        this.dependents.set(d, new Set());
      }
      this.dependents.get(d)?.add(cellKey);
    }
  }

  /**
   * Clears dependencies for a cell.
   * @param {string} cellKey
   */
  removeCell(cellKey) {
    this.setDependencies(cellKey, []);
    this.dependencies.delete(cellKey);
  }

  /**
   * Detects circular dependencies starting from cellKey.
   * @param {string} startKey
   * @returns {boolean}
   */
  hasCycle(startKey) {
    const visited = new Set();
    const inStack = new Set();

    const dfs = (key) => {
      visited.add(key);
      inStack.add(key);

      const deps = this.dependencies.get(key);
      if (deps) {
        for (const next of deps) {
          if (!visited.has(next)) {
            if (dfs(next)) return true;
          } else if (inStack.has(next)) {
            return true;
          }
        }
      }

      inStack.delete(key);
      return false;
    };

    return dfs(startKey);
  }

  /**
   * Returns cells to recompute in topological order when startKeys change.
   * @param {string[]} startKeys
   * @returns {string[]}
   */
  getEvaluationOrder(startKeys) {
    const affected = new Set();
    const queue = [...startKeys];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const deps = this.dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!affected.has(dep)) {
            affected.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    // Topological sort of affected nodes
    const inDegree = new Map();
    for (const node of affected) {
      inDegree.set(node, 0);
    }

    for (const node of affected) {
      const nodeDeps = this.dependencies.get(node);
      if (nodeDeps) {
        for (const dep of nodeDeps) {
          if (affected.has(dep)) {
            inDegree.set(node, (inDegree.get(node) || 0) + 1);
          }
        }
      }
    }

    const ready = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) ready.push(node);
    }

    const sorted = [];
    while (ready.length > 0) {
      const u = ready.shift();
      if (!u) continue;
      sorted.push(u);

      const children = this.dependents.get(u);
      if (children) {
        for (const v of children) {
          if (affected.has(v)) {
            const nextDeg = (inDegree.get(v) || 0) - 1;
            inDegree.set(v, nextDeg);
            if (nextDeg === 0) ready.push(v);
          }
        }
      }
    }

    return sorted;
  }
}
