// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  aesDecrypt,
  aesEncrypt,
  base32Decode,
  base32Encode,
  base64Decode,
  base64Encode,
  crc32,
  cryptoHash,
  generateKeyPair,
  hexDecode,
  hexEncode,
  hmac,
  htmlEntitiesDecode,
  htmlEntitiesEncode,
  md5,
  unicodeEscape,
  unicodeUnescape,
} from '../../src/apps/devtools/tools/crypto-math.js';
import {
  csvToJson,
  evaluateJsonPath,
  formatJson,
  jsonToCsv,
  jsonToTypes,
  jsonToYaml,
  minifyJson,
  sortJsonKeys,
  validateJson,
  validateJsonSchema,
} from '../../src/apps/devtools/tools/json-toolkit.js';
import { explainRegex } from '../../src/apps/devtools/tools/regex-helper.js';
import {
  convertNumberBase,
  convertTimestamp,
  decodeJwt,
  generateFakeUsers,
  generateMarkdownTable,
  generateNanoId,
  generateQrSvg,
  generateUlid,
  generateUuidV4,
  generateUuidV7,
  optimizeSvg,
  parseCron,
  slugify,
  textCaseConvert,
  textStats,
  verifyJwtHs256,
} from '../../src/apps/devtools/tools/small-tools.js';

describe('devtools crypto & encodings', () => {
  it('computes MD5 correctly (RFC 1321 test vectors)', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
  });

  it('computes CRC32 correctly', () => {
    expect(crc32('123456789')).toBe('cbf43926');
  });

  it('encodes and decodes Base64 and Base32', () => {
    const raw = 'Hello World!';
    const b64 = base64Encode(raw);
    expect(base64Decode(b64)).toBe(raw);

    const b32 = base32Encode(raw);
    expect(base32Decode(b32)).toBe(raw);
  });

  it('encodes and decodes Hex, HTML entities, and Unicode', () => {
    const hex = hexEncode('Nexus');
    expect(hexDecode(hex)).toBe('Nexus');

    const html = htmlEntitiesEncode('<div>"Hello" & \'World\'</div>');
    expect(html).toContain('&lt;div&gt;');
    expect(htmlEntitiesDecode(html)).toBe('<div>"Hello" & \'World\'</div>');

    const esc = unicodeEscape('äöü');
    expect(esc).toContain('\\u{e4}');
    expect(unicodeUnescape(esc)).toBe('äöü');
  });

  it('computes SubtleCrypto hashes and HMAC', async () => {
    const sha256 = await cryptoHash('SHA-256', 'hello');
    expect(sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');

    const sig = await hmac('SHA-256', 'secret-key', 'message');
    expect(sig.length).toBe(64);
  });

  it('encrypts and decrypts AES-GCM with password', async () => {
    const secret = 'super-secret-password';
    const message = 'Confidential Nexus Operating System Data';
    const encrypted = await aesEncrypt(secret, message);
    const decrypted = await aesDecrypt(secret, encrypted);
    expect(decrypted).toBe(message);
  });

  it('generates RSA key pair and PEM export', async () => {
    const keys = await generateKeyPair('RSA');
    expect(keys.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(keys.privateKey).toContain('BEGIN PRIVATE KEY');
  });
});

describe('devtools json-toolkit', () => {
  it('validates and formats JSON', () => {
    const valid = validateJson('{"name":"Nexus","version":1}');
    expect(valid.valid).toBe(true);

    const invalid = validateJson('{"name": "Nexus", }');
    expect(invalid.valid).toBe(false);

    const formatted = formatJson('{"a":1,"b":2}', '2');
    expect(formatted).toBe('{\n  "a": 1,\n  "b": 2\n}');

    const minified = minifyJson('{\n  "a": 1,\n  "b": 2\n}');
    expect(minified).toBe('{"a":1,"b":2}');
  });

  it('sorts JSON keys recursively', () => {
    const sorted = sortJsonKeys({ z: 1, a: { y: 2, b: 3 } });
    expect(Object.keys(sorted)).toEqual(['a', 'z']);
    expect(Object.keys(sorted.a)).toEqual(['b', 'y']);
  });

  it('converts between JSON and CSV', () => {
    const json = JSON.stringify([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Alan' },
    ]);
    const csv = jsonToCsv(json);
    expect(csv).toContain('id,name');
    expect(csv).toContain('1,Ada');
    const back = csvToJson(csv);
    expect(JSON.parse(back)).toEqual([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Alan' },
    ]);
  });

  it('converts JSON to YAML and TypeScript types', () => {
    const obj = { server: { port: 8080, host: 'localhost' }, enabled: true };
    const yaml = jsonToYaml(obj);
    expect(yaml).toContain('server:');
    expect(yaml).toContain('port: 8080');

    const types = jsonToTypes(JSON.stringify(obj), 'Config');
    expect(types.typescript).toContain('export interface Config');
    expect(types.jsdoc).toContain('@typedef {object} Config');
  });

  it('evaluates JSONPath queries', () => {
    const data = {
      store: {
        books: [
          { title: 'Book A', price: 10 },
          { title: 'Book B', price: 20 },
        ],
      },
    };
    expect(evaluateJsonPath(data, '$.store.books[0].title')).toEqual(['Book A']);
    expect(evaluateJsonPath(data, '$..title')).toEqual(['Book A', 'Book B']);
  });

  it('validates JSON Schema', () => {
    const schema = {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'number', minimum: 1 },
        name: { type: 'string' },
      },
    };
    expect(validateJsonSchema({ id: 1, name: 'Nexus' }, schema).valid).toBe(true);
    expect(validateJsonSchema({ id: 0, name: 'Nexus' }, schema).valid).toBe(false);
  });
});

describe('devtools regex-helper & small-tools', () => {
  it('explains regex tokens', () => {
    const explanation = explainRegex('^\\d{3}-[a-z]+$', 'en');
    expect(explanation.length).toBeGreaterThan(0);
    expect(explanation[0].token).toBe('^');
  });

  it('decodes and verifies JWT', async () => {
    // Generate valid HS256 JWT
    const header = base64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), true);
    const payload = base64Encode(JSON.stringify({ sub: '12345', exp: Math.floor(Date.now() / 1000) + 3600 }), true);
    const secret = 'my-secret-key';
    const sigHex = await hmac('SHA-256', secret, `${header}.${payload}`);
    const bytes = new Uint8Array(sigHex.length / 2);
    for (let i = 0; i < sigHex.length; i += 2) bytes[i / 2] = parseInt(sigHex.slice(i, i + 2), 16);
    const sig = base64Encode(bytes, true);
    const token = `${header}.${payload}.${sig}`;

    const decoded = decodeJwt(token);
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload.sub).toBe('12345');
    expect(decoded.expired).toBe(false);

    const valid = await verifyJwtHs256(token, secret);
    expect(valid).toBe(true);
  });

  it('generates UUID v4, v7, ULID and NanoID', () => {
    expect(generateUuidV4()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generateUuidV7()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generateUlid().length).toBe(26);
    expect(generateNanoId().length).toBe(21);
  });

  it('converts timestamps and number bases', () => {
    const ts = convertTimestamp(1700000000);
    expect(ts.unixSec).toBe(1700000000);
    expect(ts.iso).toBe('2023-11-14T22:13:20.000Z');

    const bases = convertNumberBase('255', 10);
    expect(bases.bases[16]).toBe('FF');
    expect(bases.bases[2]).toBe('11111111');
  });

  it('parses cron expressions', () => {
    const cron = parseCron('0 12 * * *', 'en');
    expect(cron.nextDates.length).toBe(10);
  });

  it('converts text cases and slugifies', () => {
    expect(textCaseConvert('hello_world', 'camel')).toBe('helloWorld');
    expect(textCaseConvert('hello world', 'kebab')).toBe('hello-world');
    expect(slugify('Hello World! 2026')).toBe('hello-world-2026');
    expect(textStats('Hello world\nSecond line').lines).toBe(2);
  });

  it('generates Markdown tables and QR code SVG', () => {
    const grid = [
      ['Name', 'Age'],
      ['Ada', '36'],
    ];
    const table = generateMarkdownTable(grid);
    expect(table).toContain('| Name | Age |');
    expect(table).toContain('| Ada  | 36  |');

    const qr = generateQrSvg('https://nexus-os.local');
    expect(qr).toContain('<svg');
  });

  it('optimizes SVGs and generates fake users', () => {
    const svg = '<svg><!-- comment --><rect x="10.12345" y="20.98765"/></svg>';
    const opt = optimizeSvg(svg);
    expect(opt).not.toContain('<!-- comment -->');
    expect(opt).toContain('10.12');

    const users = generateFakeUsers(3, 'en');
    expect(users.length).toBe(3);
    expect(users[0].email).toContain('@');
  });
});
