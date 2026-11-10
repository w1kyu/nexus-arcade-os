// @ts-check
// JSON Toolkit utilities: format, minify, exact validation errors, sort keys, tree view,
// CSV/YAML conversion, TypeScript/JSDoc type generator, JSONPath, and schema validator.

/**
 * Validates JSON and returns detailed error information if invalid.
 * @param {string} text
 * @returns {{ valid: boolean, error?: string, line?: number, column?: number, offset?: number }}
 */
export function validateJson(text) {
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (err) {
    const msg = String(err?.message || err);
    // Extract position if available: "at position X"
    const posMatch = msg.match(/at position (\d+)/);
    if (posMatch) {
      const offset = parseInt(posMatch[1], 10);
      const lines = text.slice(0, offset).split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      return { valid: false, error: msg, line, column, offset };
    }
    // "line X column Y"
    const lineColMatch = msg.match(/line (\d+) column (\d+)/);
    if (lineColMatch) {
      return {
        valid: false,
        error: msg,
        line: parseInt(lineColMatch[1], 10),
        column: parseInt(lineColMatch[2], 10),
      };
    }
    return { valid: false, error: msg, line: 1, column: 1 };
  }
}

/**
 * Format JSON with chosen indentation.
 * @param {string} text
 * @param {'2' | '4' | 'tab'} indent
 */
export function formatJson(text, indent = '2') {
  const parsed = JSON.parse(text);
  const space = indent === 'tab' ? '\t' : indent === '4' ? 4 : 2;
  return JSON.stringify(parsed, null, space);
}

/**
 * Minify JSON.
 * @param {string} text
 */
export function minifyJson(text) {
  const parsed = JSON.parse(text);
  return JSON.stringify(parsed);
}

/**
 * Recursively sort keys in JSON object.
 * @param {any} val
 * @returns {any}
 */
export function sortJsonKeys(val) {
  if (Array.isArray(val)) {
    return val.map(sortJsonKeys);
  }
  if (val !== null && typeof val === 'object') {
    const sorted = {};
    for (const key of Object.keys(val).sort()) {
      sorted[key] = sortJsonKeys(val[key]);
    }
    return sorted;
  }
  return val;
}

/**
 * Convert JSON array of objects to CSV.
 * @param {string} jsonStr
 * @returns {string}
 */
export function jsonToCsv(jsonStr) {
  const data = JSON.parse(jsonStr);
  const array = Array.isArray(data) ? data : [data];
  if (array.length === 0) return '';

  // Collect all keys
  const headers = Array.from(
    new Set(array.flatMap((item) => (typeof item === 'object' && item !== null ? Object.keys(item) : ['value']))),
  );

  const escapeCell = (/** @type {any} */ val) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.map(escapeCell).join(',')];
  for (const item of array) {
    if (typeof item !== 'object' || item === null) {
      rows.push(escapeCell(item));
    } else {
      rows.push(headers.map((h) => escapeCell(item[h])).join(','));
    }
  }
  return rows.join('\n');
}

/**
 * Convert CSV to JSON array.
 * @param {string} csvStr
 * @returns {string}
 */
export function csvToJson(csvStr) {
  const lines = csvStr.trim().split('\n');
  if (lines.length < 2) return '[]';

  const parseLine = (/** @type {string} */ line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = parseLine(lines[0]);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const val = row[j] ?? '';
      // Try parsing numbers / booleans
      if (val === 'true') obj[headers[j]] = true;
      else if (val === 'false') obj[headers[j]] = false;
      else if (val !== '' && !isNaN(Number(val))) obj[headers[j]] = Number(val);
      else obj[headers[j]] = val;
    }
    result.push(obj);
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Simple YAML serializer for JSON objects.
 * Handles objects, arrays, primitives, indentation.
 * @param {any} val
 * @param {number} [depth=0]
 * @returns {string}
 */
export function jsonToYaml(val, depth = 0) {
  const indent = '  '.repeat(depth);
  if (val === null) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (val.includes('\n') || val.includes(':') || val.includes('#') || val.startsWith(' ')) {
      return JSON.stringify(val);
    }
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return val
      .map((item) => {
        const itemYaml = jsonToYaml(item, depth + 1);
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return `${indent}- ${itemYaml.trimStart()}`;
        }
        return `${indent}- ${itemYaml}`;
      })
      .join('\n');
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    return keys
      .map((k) => {
        const item = val[k];
        if (typeof item === 'object' && item !== null) {
          const itemYaml = jsonToYaml(item, depth + 1);
          return `${indent}${k}:\n${itemYaml}`;
        }
        return `${indent}${k}: ${jsonToYaml(item, depth + 1)}`;
      })
      .join('\n');
  }
  return '';
}

/**
 * Converts JSON to TypeScript interfaces and JSDoc typedefs.
 * @param {string} jsonStr
 * @param {string} [rootName='RootObject']
 */
export function jsonToTypes(jsonStr, rootName = 'RootObject') {
  const parsed = JSON.parse(jsonStr);
  /** @type {string[]} */
  const tsDefs = [];
  /** @type {string[]} */
  const jsdocDefs = [];

  const capitalize = (/** @type {string} */ s) => s.charAt(0).toUpperCase() + s.slice(1);

  const getType = (/** @type {any} */ val, /** @type {string} */ key) => {
    if (val === null) return 'null';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'string') return 'string';
    if (Array.isArray(val)) {
      if (val.length === 0) return 'any[]';
      const itemType = getType(val[0], `${key}Item`);
      return `${itemType}[]`;
    }
    if (typeof val === 'object') {
      const typeName = capitalize(key);
      generateInterface(val, typeName);
      return typeName;
    }
    return 'any';
  };

  const generateInterface = (/** @type {any} */ obj, /** @type {string} */ name) => {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    const fields = Object.entries(obj).map(([k, v]) => ({
      name: k,
      type: getType(v, k),
    }));

    // TS Interface
    tsDefs.push(`export interface ${name} {\n${fields.map((f) => `  ${f.name}: ${f.type};`).join('\n')}\n}`);

    // JSDoc typedef
    jsdocDefs.push(
      `/**\n * @typedef {object} ${name}\n${fields.map((f) => ` * @property {${f.type}} ${f.name}`).join('\n')}\n */`,
    );
  };

  generateInterface(parsed, rootName);

  return {
    typescript: tsDefs.reverse().join('\n\n'),
    jsdoc: jsdocDefs.reverse().join('\n\n'),
  };
}

/**
 * Lightweight JSONPath query evaluator.
 * Supports: `$.prop`, `$[idx]`, `$..key` (recursive search), and `$.items[*].prop`.
 * @param {any} data
 * @param {string} path
 * @returns {any[]} matches
 */
export function evaluateJsonPath(data, path) {
  const clean = path.trim();
  if (!clean.startsWith('$')) return [];
  if (clean === '$') return [data];

  // Recursive search $..key
  const recursiveMatch = clean.match(/^\$\.\.([a-zA-Z0-9_-]+)$/);
  if (recursiveMatch) {
    const targetKey = recursiveMatch[1];
    /** @type {any[]} */
    const results = [];
    const search = (/** @type {any} */ val) => {
      if (typeof val === 'object' && val !== null) {
        if (targetKey in val) results.push(val[targetKey]);
        for (const k of Object.keys(val)) search(val[k]);
      }
    };
    search(data);
    return results;
  }

  // Tokenize dot path and brackets
  const tokens = clean
    .replace(/^\$\.?/, '')
    .split(/\.|\[(\d+|\*)\]/)
    .filter((t) => t !== undefined && t !== '');

  /** @type {any[]} */
  let current = [data];

  for (const token of tokens) {
    /** @type {any[]} */
    const next = [];
    for (const item of current) {
      if (item === null || item === undefined) continue;
      if (token === '*') {
        if (Array.isArray(item)) next.push(...item);
        else if (typeof item === 'object') next.push(...Object.values(item));
      } else if (!isNaN(Number(token))) {
        const idx = Number(token);
        if (Array.isArray(item) && item[idx] !== undefined) next.push(item[idx]);
      } else if (typeof item === 'object' && token in item) {
        next.push(item[token]);
      }
    }
    current = next;
  }

  return current;
}

/**
 * Pure JSON Schema validation for common keywords: type, properties, required, items, enum, minimum, maximum.
 * @param {any} data
 * @param {any} schema
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateJsonSchema(data, schema) {
  /** @type {string[]} */
  const errors = [];

  const validate = (/** @type {any} */ val, /** @type {any} */ sch, /** @type {string} */ path) => {
    if (!sch || typeof sch !== 'object') return;

    // type
    if (sch.type) {
      const type = sch.type;
      const isArray = Array.isArray(val);
      const isObject = typeof val === 'object' && val !== null && !isArray;
      if (type === 'string' && typeof val !== 'string') errors.push(`${path}: expected string, got ${typeof val}`);
      else if (type === 'number' && typeof val !== 'number') errors.push(`${path}: expected number, got ${typeof val}`);
      else if (type === 'integer' && !Number.isInteger(val)) errors.push(`${path}: expected integer, got ${val}`);
      else if (type === 'boolean' && typeof val !== 'boolean')
        errors.push(`${path}: expected boolean, got ${typeof val}`);
      else if (type === 'array' && !isArray) errors.push(`${path}: expected array`);
      else if (type === 'object' && !isObject) errors.push(`${path}: expected object`);
    }

    // enum
    if (Array.isArray(sch.enum) && !sch.enum.includes(val)) {
      errors.push(`${path}: value ${JSON.stringify(val)} is not in enum`);
    }

    // numbers: minimum, maximum
    if (typeof val === 'number') {
      if (sch.minimum !== undefined && val < sch.minimum) errors.push(`${path}: ${val} < minimum ${sch.minimum}`);
      if (sch.maximum !== undefined && val > sch.maximum) errors.push(`${path}: ${val} > maximum ${sch.maximum}`);
    }

    // required properties
    if (typeof val === 'object' && val !== null && !Array.isArray(val) && Array.isArray(sch.required)) {
      for (const req of sch.required) {
        if (!(req in val)) errors.push(`${path}: missing required property "${req}"`);
      }
    }

    // properties
    if (typeof val === 'object' && val !== null && !Array.isArray(val) && sch.properties) {
      for (const [propKey, propSch] of Object.entries(sch.properties)) {
        if (propKey in val) {
          validate(val[propKey], propSch, `${path}.${propKey}`);
        }
      }
    }

    // array items
    if (Array.isArray(val) && sch.items) {
      for (let i = 0; i < val.length; i++) {
        validate(val[i], sch.items, `${path}[${i}]`);
      }
    }
  };

  validate(data, schema, '$');
  return { valid: errors.length === 0, errors };
}
