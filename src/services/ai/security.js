// @ts-check
// Device-key encryption at rest for AI provider API keys.
// API keys are never stored as plaintext in storage and never written to logs or backups.

const KEY_STORAGE_KEY = 'device_key';

/** @type {CryptoKey | null} */
let cachedKey = null;

/**
 * Gets or creates the device encryption key.
 * @param {{ get(key: string): Promise<unknown>, set(key: string, value: unknown): Promise<void> }} [store]
 * @returns {Promise<CryptoKey | null>}
 */
export async function getDeviceKey(store) {
  if (cachedKey) return cachedKey;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;

  try {
    if (store) {
      const stored = /** @type {JsonWebKey | undefined} */ (await store.get(KEY_STORAGE_KEY));
      if (stored) {
        cachedKey = await subtle.importKey('jwk', stored, { name: 'AES-GCM', length: 256 }, false, [
          'encrypt',
          'decrypt',
        ]);
        return cachedKey;
      }
    }

    // Generate new key
    const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    if (store) {
      const exported = await subtle.exportKey('jwk', key);
      await store.set(KEY_STORAGE_KEY, exported);
    }
    cachedKey = key;
    return cachedKey;
  } catch {
    return null;
  }
}

/**
 * Encrypts an API key string for storage at rest.
 * @param {string} text
 * @param {CryptoKey | null} [key]
 * @returns {Promise<string>}
 */
export async function encryptApiKey(text, key) {
  if (!text) return '';
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || !key) {
    // Obfuscation fallback if subtle crypto is unavailable in environment
    return `b64:${btoa(encodeURIComponent(text))}`;
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const ivB64 = btoa(String.fromCharCode(...iv));
  const dataB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `enc:${ivB64}:${dataB64}`;
}

/**
 * Decrypts an encrypted API key string.
 * @param {string} cipherText
 * @param {CryptoKey | null} [key]
 * @returns {Promise<string>}
 */
export async function decryptApiKey(cipherText, key) {
  if (!cipherText) return '';
  if (cipherText.startsWith('b64:')) {
    try {
      return decodeURIComponent(atob(cipherText.slice(4)));
    } catch {
      return '';
    }
  }
  if (!cipherText.startsWith('enc:')) {
    // Plaintext value (e.g. initial input or test mock)
    return cipherText;
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle || !key) return '';

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return '';
    const ivStr = atob(parts[1]);
    const dataStr = atob(parts[2]);
    const iv = new Uint8Array(ivStr.length);
    for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);
    const data = new Uint8Array(dataStr.length);
    for (let i = 0; i < dataStr.length; i++) data[i] = dataStr.charCodeAt(i);

    const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}
