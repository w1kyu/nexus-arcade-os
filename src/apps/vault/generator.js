// @ts-check
// Password generator, EN/DE passphrases, and entropy estimation.

export const PASSPHRASE_WORDS_EN = [
  'apple',
  'beach',
  'cloud',
  'dragon',
  'eagle',
  'forest',
  'galaxy',
  'harbor',
  'island',
  'jungle',
  'knight',
  'lemon',
  'meadow',
  'nebula',
  'ocean',
  'planet',
  'river',
  'silver',
  'tiger',
  'valley',
  'winter',
  'wizard',
  'zenith',
  'beacon',
  'castle',
  'desert',
  'falcon',
  'glacier',
  'horizon',
  'lagoon',
  'monarch',
  'oasis',
  'phoenix',
  'quartz',
  'rainbow',
  'shadow',
  'thunder',
  'voyage',
  'whisper',
  'zephyr',
];

export const PASSPHRASE_WORDS_DE = [
  'apfel',
  'berg',
  'wolke',
  'drache',
  'adler',
  'wald',
  'galaxie',
  'hafen',
  'insel',
  'dschungel',
  'ritter',
  'zitrone',
  'wiese',
  'nebel',
  'ozean',
  'planet',
  'fluss',
  'silber',
  'tiger',
  'tal',
  'winter',
  'zauberer',
  'sonne',
  'leuchtturm',
  'burg',
  'wueste',
  'falke',
  'gletscher',
  'horizont',
  'lagune',
  'monarch',
  'oase',
  'phoenix',
  'quarz',
  'regenbogen',
  'schatten',
  'donner',
  'reise',
  'fluestern',
  'zephyr',
];

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = '0OIl1';

/**
 * Generates a random secure password.
 * @param {{
 *   length?: number,
 *   uppercase?: boolean,
 *   lowercase?: boolean,
 *   digits?: boolean,
 *   symbols?: boolean,
 *   excludeAmbiguous?: boolean
 * }} [options]
 * @returns {string}
 */
export function generatePassword(options = {}) {
  const {
    length = 16,
    uppercase = true,
    lowercase = true,
    digits = true,
    symbols = true,
    excludeAmbiguous = false,
  } = options;

  let pool = '';
  if (lowercase) pool += LOWER;
  if (uppercase) pool += UPPER;
  if (digits) pool += DIGITS;
  if (symbols) pool += SYMBOLS;

  if (excludeAmbiguous) {
    pool = pool
      .split('')
      .filter((c) => !AMBIGUOUS.includes(c))
      .join('');
  }

  if (!pool) pool = LOWER + DIGITS;

  const randomIndices = new Uint32Array(length);
  crypto.getRandomValues(randomIndices);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += pool[randomIndices[i] % pool.length];
  }

  return result;
}

/**
 * Generates a memorable passphrase from bundled wordlists.
 * @param {number} [wordCount] default 4
 * @param {'en' | 'de'} [lang] default 'en'
 * @param {string} [separator] default '-'
 * @returns {string}
 */
export function generatePassphrase(wordCount = 4, lang = 'en', separator = '-') {
  const words = lang === 'de' ? PASSPHRASE_WORDS_DE : PASSPHRASE_WORDS_EN;
  const randomIndices = new Uint32Array(wordCount);
  crypto.getRandomValues(randomIndices);

  const selected = [];
  for (let i = 0; i < wordCount; i++) {
    selected.push(words[randomIndices[i] % words.length]);
  }

  return selected.join(separator);
}

/**
 * Calculates password Shannon entropy in bits.
 * @param {string} password
 * @returns {number}
 */
export function estimateEntropy(password) {
  if (!password) return 0;
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  if (poolSize === 0) poolSize = 10;
  const entropy = password.length * Math.log2(poolSize);
  return Math.round(entropy);
}
