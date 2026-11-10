// @ts-check
// Cryptographic and encoding utilities: MD5, CRC32, Base64/32, Hex, Binary, Punycode,
// HTML entities, Unicode escapes, SubtleCrypto SHA/HMAC/AES-GCM/RSA/ECDSA.

/**
 * Pure JavaScript MD5 implementation (RFC 1321).
 * @param {string | Uint8Array} input
 * @returns {string} hex digest
 */
export function md5(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const bitLen = bytes.length * 8;

  // Pre-processing: padding
  const padLen = (bytes.length % 64 < 56 ? 56 : 120) - (bytes.length % 64);
  const totalLen = bytes.length + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  // Append length in bits as 64-bit little-endian integer
  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000), true);

  // Initialize MD Buffer
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // Per-round shift amounts
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21,
  ];

  // Constants
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  }

  // Process the message in successive 512-bit (64-byte) chunks
  for (let offset = 0; offset < totalLen; offset += 64) {
    const w = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(offset + j * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + k[i] + w[g]) >>> 0;
      b = (b + ((sum << s[i]) | (sum >>> (32 - s[i])))) >>> 0;
      a = temp;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const outBuf = new ArrayBuffer(16);
  const outView = new DataView(outBuf);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);

  return Array.from(new Uint8Array(outBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes standard CRC32 (IEEE 802.3).
 * @param {string | Uint8Array} input
 * @returns {string} hex digest
 */
export function crc32(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let c = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ CRC32_TABLE[(c ^ bytes[i]) & 0xff];
  }
  return ((c ^ -1) >>> 0).toString(16).padStart(8, '0');
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Base64 encode (supports text and binary, standard or urlSafe).
 * @param {string | Uint8Array} input
 * @param {boolean} [urlSafe=false]
 */
export function base64Encode(input, urlSafe = false) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let b64 = btoa(binary);
  if (urlSafe) {
    b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return b64;
}

/**
 * Base64 decode.
 * @param {string} str
 * @returns {string}
 */
export function base64Decode(str) {
  let s = str.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Base32 encode (RFC 4648).
 * @param {string | Uint8Array} input
 */
export function base32Encode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  while (output.length % 8 !== 0) output += '=';
  return output;
}

/**
 * Base32 decode (RFC 4648).
 * @param {string} str
 */
export function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * Hex encode / decode.
 */
export function hexEncode(/** @type {string} */ str) {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexDecode(/** @type {string} */ hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Binary 01 encode / decode.
 */
export function binaryEncode(/** @type {string} */ str) {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(2).padStart(8, '0'))
    .join(' ');
}

export function binaryDecode(/** @type {string} */ bin) {
  const parts = bin.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.map((p) => parseInt(p, 2)));
  return new TextDecoder().decode(bytes);
}

/**
 * HTML entities encode / decode.
 */
export function htmlEntitiesEncode(/** @type {string} */ str) {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[m] || m,
  );
}

export function htmlEntitiesDecode(/** @type {string} */ str) {
  const doc = new DOMParser().parseFromString(str, 'text/html');
  return doc.documentElement.textContent || '';
}

/**
 * Unicode escape / unescape.
 */
export function unicodeEscape(/** @type {string} */ str) {
  return Array.from(str)
    .map((c) => {
      const code = c.codePointAt(0) || 0;
      return code > 127 ? `\\u{${code.toString(16)}}` : c;
    })
    .join('');
}

export function unicodeUnescape(/** @type {string} */ str) {
  return str.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, p1, p2) => {
    const code = parseInt(p1 || p2, 16);
    return String.fromCodePoint(code);
  });
}

/**
 * Minimal Punycode encode / decode (RFC 3492).
 */
export function punycodeEncode(/** @type {string} */ domain) {
  try {
    return new URL(`https://${domain}`).hostname;
  } catch {
    return domain;
  }
}

export function punycodeDecode(/** @type {string} */ domain) {
  try {
    // Punycode decoding via standard browser URL
    const u = new URL(`https://${domain}`);
    return decodeURI(u.hostname);
  } catch {
    return domain;
  }
}

/**
 * Computes SubtleCrypto hash (SHA-1, SHA-256, SHA-384, SHA-512).
 * @param {'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'} algorithm
 * @param {string | Uint8Array} input
 */
export async function cryptoHash(algorithm, input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const hashBuf = await crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes HMAC (SHA-256 or SHA-512).
 * @param {'SHA-256' | 'SHA-512'} hash
 * @param {string} keyStr
 * @param {string} dataStr
 */
export async function hmac(hash, keyStr, dataStr) {
  const keyBuf = new TextEncoder().encode(keyStr);
  const dataBuf = new TextEncoder().encode(dataStr);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: { name: hash } }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuf);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * AES-GCM Encrypt with password.
 * Derives a 256-bit key using PBKDF2 with 100,000 iterations, 16-byte salt, 12-byte IV.
 * @param {string} password
 * @param {string} plaintext
 * @returns {Promise<string>} Base64 formatted package: salt (16) + iv (12) + ciphertext
 */
export async function aesEncrypt(password, plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const pwKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey',
  ]);

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext));

  // Combine: salt (16) + iv (12) + ciphertext
  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(16 + 12 + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(cipherBytes, 28);

  return base64Encode(combined);
}

/**
 * AES-GCM Decrypt with password.
 * @param {string} password
 * @param {string} base64Payload
 * @returns {Promise<string>}
 */
export async function aesDecrypt(password, base64Payload) {
  const binary = atob(base64Payload.trim());
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);

  if (combined.length < 28) throw new Error('Invalid encrypted payload length');

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const pwKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey',
  ]);

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);

  return new TextDecoder().decode(plainBuf);
}

/**
 * Generate RSA or ECDSA key pair and export PEM.
 * @param {'RSA' | 'ECDSA'} type
 */
export async function generateKeyPair(type) {
  if (type === 'RSA') {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const pubSpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const toPem = (/** @type {ArrayBuffer} */ buf, /** @type {string} */ label) => {
      const b64 = base64Encode(new Uint8Array(buf));
      const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64;
      return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----\n`;
    };

    return {
      publicKey: toPem(pubSpki, 'PUBLIC KEY'),
      privateKey: toPem(privPkcs8, 'PRIVATE KEY'),
    };
  } else {
    // ECDSA P-256
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pubSpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const toPem = (/** @type {ArrayBuffer} */ buf, /** @type {string} */ label) => {
      const b64 = base64Encode(new Uint8Array(buf));
      const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64;
      return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----\n`;
    };

    return {
      publicKey: toPem(pubSpki, 'PUBLIC KEY'),
      privateKey: toPem(privPkcs8, 'PRIVATE KEY'),
    };
  }
}
