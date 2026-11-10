// @ts-check
// RFC 6238 TOTP (Time-based One-Time Password) implementation using Web Crypto HMAC-SHA1.
// Supports standard Base32 decoding, 30s steps, 6-8 digits, and dynamic truncation.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes a Base32 string to Uint8Array.
 * @param {string} b32
 * @returns {Uint8Array}
 */
export function base32Decode(b32) {
  const clean = b32.toUpperCase().replace(/[=\s-]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

/**
 * Generates an RFC 6238 TOTP token.
 * @param {string | Uint8Array} secret Base32 string or raw secret bytes
 * @param {number} [epochSeconds] unix epoch in seconds (default Date.now() / 1000)
 * @param {number} [stepSeconds] default 30
 * @param {number} [digits] default 6
 * @param {'SHA-1' | 'SHA-256' | 'SHA-512'} [algorithm] default 'SHA-1'
 * @returns {Promise<string>}
 */
export async function generateTotp(
  secret,
  epochSeconds = Math.floor(Date.now() / 1000),
  stepSeconds = 30,
  digits = 6,
  algorithm = 'SHA-1',
) {
  const keyBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
  if (keyBytes.length === 0) return '';

  const counter = Math.floor(epochSeconds / stepSeconds);
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  // Big-endian 64-bit integer
  view.setBigUint64(0, BigInt(counter), false);

  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: { name: algorithm } }, false, [
    'sign',
  ]);

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hash = new Uint8Array(signature);

  // RFC 4226 Dynamic Truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

/**
 * Computes the remaining seconds in the current 30s TOTP window.
 * @param {number} [epochSeconds]
 * @param {number} [stepSeconds]
 * @returns {number}
 */
export function getTotpRemainingSeconds(epochSeconds = Math.floor(Date.now() / 1000), stepSeconds = 30) {
  return stepSeconds - (epochSeconds % stepSeconds);
}
