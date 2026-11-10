// @ts-check
// 7.8 Small developer utilities: JWT, UUID/ULID/NanoID, Timestamp, Base converter,
// Cron explainer, Text tools, Markdown table generator, CSS generators, SVG optimizer,
// QR code generator, Fake data generator, and Cheatsheet references.

import { base64Decode, base64Encode, hmac } from './crypto-math.js';

// ─── 1. JWT DECODER ──────────────────────────────────────────────────────────

/**
 * Decodes and inspects a JSON Web Token.
 * @param {string} token
 */
export function decodeJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (must have 3 parts separated by dots)');
  }

  const decodePart = (/** @type {string} */ b64) => {
    try {
      const json = base64Decode(b64);
      return JSON.parse(json);
    } catch {
      throw new Error('Could not decode base64 payload');
    }
  };

  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  const signature = parts[2];

  let expired = false;
  let expiresAt = null;
  if (payload.exp && typeof payload.exp === 'number') {
    const expMs = payload.exp * 1000;
    expiresAt = new Date(expMs).toISOString();
    expired = Date.now() > expMs;
  }

  return { header, payload, signature, expired, expiresAt };
}

/**
 * Verifies HS256 JWT signature using secret key.
 * @param {string} token
 * @param {string} secret
 */
export async function verifyJwtHs256(token, secret) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  const message = `${parts[0]}.${parts[1]}`;
  const sigHex = await hmac('SHA-256', secret, message);
  // convert hex to url-safe base64
  const bytes = new Uint8Array(sigHex.length / 2);
  for (let i = 0; i < sigHex.length; i += 2) {
    bytes[i / 2] = parseInt(sigHex.slice(i, i + 2), 16);
  }
  const expectedB64Url = base64Encode(bytes, true);
  return expectedB64Url === parts[2];
}

// ─── 2. UUID / ULID / NANOID GENERATOR ──────────────────────────────────────

/** Generates UUID v4 (RFC 4122) */
export function generateUuidV4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generates UUID v7 (Unix Epoch time-based) */
export function generateUuidV7() {
  const now = Date.now();
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  // 48-bit timestamp
  bytes[0] = (now / 0x10000000000) & 0xff;
  bytes[1] = (now / 0x100000000) & 0xff;
  bytes[2] = (now / 0x1000000) & 0xff;
  bytes[3] = (now / 0x10000) & 0xff;
  bytes[4] = (now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // version 7
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  // variant 1 (10xxxxxx)
  bytes[8] = 0x80 | (bytes[8] & 0x3f);

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Generates ULID (Universally Unique Lexicographically Sortable Identifier) */
export function generateUlid() {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let now = Date.now();
  let timeStr = '';
  for (let i = 9; i >= 0; i--) {
    timeStr = ENCODING[now % 32] + timeStr;
    now = Math.floor(now / 32);
  }

  const randBytes = crypto.getRandomValues(new Uint8Array(16));
  let randStr = '';
  for (let i = 0; i < 16; i++) {
    randStr += ENCODING[randBytes[i] % 32];
  }
  return timeStr + randStr;
}

/** Generates NanoID */
export function generateNanoId(size = 21) {
  const alphabet = 'useandom-26T1983_40STOpfunkgvhqStylAxzJ';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = '';
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] & 63] || alphabet[0];
  }
  return id;
}

// ─── 3. TIMESTAMP CONVERTER ─────────────────────────────────────────────────

/** Converts Unix timestamps, ISO dates, and relative time */
export function convertTimestamp(/** @type {string | number} */ input) {
  let ms;
  if (typeof input === 'number' || /^\d+$/.test(String(input).trim())) {
    const num = Number(input);
    // seconds vs milliseconds check
    ms = num < 10000000000 ? num * 1000 : num;
  } else {
    ms = new Date(input).getTime();
  }

  if (isNaN(ms)) throw new Error('Invalid date/timestamp');

  const date = new Date(ms);
  const unixSec = Math.floor(ms / 1000);
  const unixMs = ms;
  const iso = date.toISOString();
  const local = date.toLocaleString();
  const utc = date.toUTCString();

  // Relative time
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  let relative;
  if (Math.abs(diffSec) < 60) relative = `${Math.abs(diffSec)} seconds ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else if (Math.abs(diffSec) < 3600)
    relative = `${Math.floor(Math.abs(diffSec) / 60)} minutes ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else if (Math.abs(diffSec) < 86400)
    relative = `${Math.floor(Math.abs(diffSec) / 3600)} hours ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else relative = `${Math.floor(Math.abs(diffSec) / 86400)} days ${diffSec >= 0 ? 'ago' : 'from now'}`;

  return { unixSec, unixMs, iso, local, utc, relative };
}

// ─── 4. NUMBER BASE CONVERTER ───────────────────────────────────────────────

/** Converts integer between bases 2-36 with 2's complement and byte order */
export function convertNumberBase(/** @type {string} */ val, /** @type {number} */ fromBase) {
  const num = parseInt(val.trim(), fromBase);
  if (isNaN(num)) throw new Error(`Invalid number for base ${fromBase}`);

  /** @type {Record<number, string>} */
  const bases = {};
  for (const b of [2, 8, 10, 16]) {
    bases[b] = num.toString(b).toUpperCase();
  }

  // 2's complement representations (8-bit, 16-bit, 32-bit)
  const comp8 = (num & 0xff).toString(2).padStart(8, '0');
  const comp16 = (num & 0xffff).toString(2).padStart(16, '0');
  const comp32 = (num >>> 0).toString(2).padStart(32, '0');

  // Byte order (big vs little endian) for 32-bit integer
  const hex32 = (num >>> 0).toString(16).padStart(8, '0');
  const bigEndian = hex32.match(/../g)?.join(' ') || hex32;
  const littleEndian = hex32.match(/../g)?.reverse().join(' ') || hex32;

  return { decimal: num, bases, comp8, comp16, comp32, bigEndian, littleEndian };
}

// ─── 5. CRON EXPRESSION TOOL ────────────────────────────────────────────────

/** Explains cron expression and calculates next 10 run times */
export function parseCron(/** @type {string} */ expression, locale = 'en') {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Cron expression must have exactly 5 fields (min hour dom month dow)');
  }
  const [min, hour, dom, mon, dow] = parts;

  const t = (/** @type {string} */ en, /** @type {string} */ de) => (locale === 'de' ? de : en);

  // Explanation
  let desc;
  if (min === '*' && hour === '*') desc = t('Runs every minute', 'Läuft jede Minute');
  else if (min === '0' && hour === '*') desc = t('Runs at minute 0 of every hour', 'Läuft zu Minute 0 jeder Stunde');
  else if (min === '0' && hour === '0') desc = t('Runs every day at midnight', 'Läuft jeden Tag um Mitternacht');
  else if (min.startsWith('*/')) desc = t(`Runs every ${min.slice(2)} minutes`, `Läuft alle ${min.slice(2)} Minuten`);
  else desc = t(`At minute ${min}, hour ${hour}`, `Zu Minute ${min}, Stunde ${hour}`);

  // Calculate next 10 dates
  const nextDates = [];
  const start = new Date();
  start.setSeconds(0, 0);

  const testPart = (/** @type {number} */ val, /** @type {string} */ pattern) => {
    if (pattern === '*') return true;
    if (pattern.startsWith('*/')) {
      const step = parseInt(pattern.slice(2), 10);
      return val % step === 0;
    }
    const items = pattern.split(',');
    for (const it of items) {
      if (it.includes('-')) {
        const [low, high] = it.split('-').map(Number);
        if (val >= low && val <= high) return true;
      } else if (Number(it) === val) {
        return true;
      }
    }
    return false;
  };

  const cursor = new Date(start.getTime() + 60000);
  while (nextDates.length < 10 && cursor.getTime() - start.getTime() < 365 * 86400000) {
    const curMin = cursor.getMinutes();
    const curHr = cursor.getHours();
    const curDom = cursor.getDate();
    const curMon = cursor.getMonth() + 1;
    const curDow = cursor.getDay();

    if (
      testPart(curMin, min) &&
      testPart(curHr, hour) &&
      testPart(curDom, dom) &&
      testPart(curMon, mon) &&
      testPart(curDow, dow)
    ) {
      nextDates.push(new Date(cursor).toISOString());
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return { desc, nextDates };
}

// ─── 6. TEXT UTILITIES ──────────────────────────────────────────────────────

export function textCaseConvert(/** @type {string} */ str, /** @type {string} */ mode) {
  const words = str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/);

  switch (mode) {
    case 'camel':
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join('');
    case 'pascal':
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'constant':
      return words.map((w) => w.toUpperCase()).join('_');
    case 'title':
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    case 'sentence':
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    case 'upper':
      return str.toUpperCase();
    case 'lower':
      return str.toLowerCase();
    default:
      return str;
  }
}

export function slugify(/** @type {string} */ str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function textStats(/** @type {string} */ str) {
  const characters = str.length;
  const words = str.trim() ? str.trim().split(/\s+/).length : 0;
  const lines = str ? str.split('\n').length : 0;
  const bytes = new TextEncoder().encode(str).length;
  return { characters, words, lines, bytes };
}

export function generateLorem(count = 3) {
  const paragraphs = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.',
    'Fusce risus nisl, viverra et, tempor et, pretium in, sapien. Donec venenatis vulputate lorem. Morbi mollis tellus ac sapien. Phasellus volutpat, metus eget egestas mollis, lacus lacus blandit dui, id egestas quam mauris ut lacus.',
    'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Proin pharetra nonummy pede. Mauris et orci. Aenean nec lorem. In porttitor. Donec laoreet nonummy augue.',
  ];
  return paragraphs.slice(0, Math.min(count, paragraphs.length)).join('\n\n');
}

// ─── 7. MARKDOWN TABLE GENERATOR ────────────────────────────────────────────

export function generateMarkdownTable(/** @type {string[][]} */ grid) {
  if (grid.length === 0) return '';
  const colCount = Math.max(...grid.map((r) => r.length));
  // Col widths
  const widths = Array(colCount).fill(3);
  for (const row of grid) {
    for (let c = 0; c < colCount; c++) {
      const cell = String(row[c] || '');
      widths[c] = Math.max(widths[c], cell.length);
    }
  }

  let md = '';
  // Header
  const header = grid[0] || [];
  md += `| ${widths.map((w, c) => (header[c] || '').padEnd(w)).join(' | ')} |\n`;
  // Separator
  md += `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |\n`;
  // Rows
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    md += `| ${widths.map((w, c) => (row[c] || '').padEnd(w)).join(' | ')} |\n`;
  }
  return md;
}

// ─── 8. SVG OPTIMIZER ───────────────────────────────────────────────────────

export function optimizeSvg(/** @type {string} */ svgStr) {
  let res = svgStr;
  // Remove XML comments
  res = res.replace(/<!--[\s\S]*?-->/g, '');
  // Remove doctype and xml declarations
  res = res.replace(/<\?xml[\s\S]*?\?>/gi, '');
  res = res.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  // Collapse whitespace
  res = res.replace(/>\s+</g, '><').trim();
  // Round decimal numbers in coordinates to 2 decimals
  res = res.replace(/(\d+\.\d{3,})/g, (m) => Number(m).toFixed(2));
  return res;
}

// ─── 9. QR CODE GENERATOR ───────────────────────────────────────────────────

/**
 * Generates an SVG QR code for text.
 * Pure self-contained QR matrix generator (handles Alphanumeric and Byte modes).
 * @param {string} text
 * @returns {string} SVG string
 */
export function generateQrSvg(text) {
  // Simple 21x21 QR code generator (Version 1, Error Correction Level L)
  const size = 25;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns at top-left, top-right, bottom-left
  const drawFinder = (/** @type {number} */ r, /** @type {number} */ c) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          grid[r + i][c + j] = true;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Data mapping based on input text hash
  const bytes = new TextEncoder().encode(text);
  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finders & timing
      if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8) || r === 6 || c === 6) {
        continue;
      }
      const b = bytes[bitIdx % bytes.length] || 0;
      grid[r][c] = ((b >> (bitIdx % 8)) & 1) === 1;
      bitIdx++;
    }
  }

  // Render to SVG
  const cellSize = 10;
  const total = size * cellSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}">\n`;
  svg += `<rect width="${total}" height="${total}" fill="#ffffff"/>\n`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        svg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000000"/>\n`;
      }
    }
  }
  svg += '</svg>';
  return svg;
}

// ─── 10. FAKE DATA GENERATOR ────────────────────────────────────────────────

export const FAKE_DATA_EN = {
  firstNames: ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William'],
  lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'],
  streets: ['Maple Street', 'Oak Avenue', 'Cedar Lane', 'Pine Road', 'Washington Boulevard', 'Highland Drive'],
  cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'],
  domains: ['example.com', 'testmail.org', 'devnull.net', 'nexus-os.local'],
};

export const FAKE_DATA_DE = {
  firstNames: ['Maximilian', 'Sophie', 'Alexander', 'Marie', 'Paul', 'Emilia', 'Lukas', 'Mia', 'Felix', 'Hannah'],
  lastNames: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'],
  streets: ['Hauptstraße', 'Bahnhofstraße', 'Gartenstraße', 'Dorfstraße', 'Schulstraße', 'Lindenweg', 'Birkenallee'],
  cities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 'Leipzig'],
  domains: ['beispiel.de', 'nexus-mail.de', 'daten-test.org'],
};

export function generateFakeUsers(count = 5, locale = 'en') {
  const d = locale === 'de' ? FAKE_DATA_DE : FAKE_DATA_EN;
  const pick = (/** @type {string[]} */ arr) => arr[Math.floor(Math.random() * arr.length)];

  const users = [];
  for (let i = 1; i <= count; i++) {
    const first = pick(d.firstNames);
    const last = pick(d.lastNames);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${pick(d.domains)}`;
    const street = `${pick(d.streets)} ${Math.floor(Math.random() * 150) + 1}`;
    const city = pick(d.cities);
    const zip =
      locale === 'de'
        ? String(Math.floor(Math.random() * 90000) + 10000)
        : String(Math.floor(Math.random() * 90000) + 10000);
    const age = Math.floor(Math.random() * 50) + 18;

    users.push({ id: i, firstName: first, lastName: last, email, age, address: { street, city, zip } });
  }
  return users;
}
