// @ts-check
// Regex tester utilities: common patterns library, explanation generator, replace with backreferences,
// cheat sheet, and catastrophic backtracking protection.

export const COMMON_PATTERNS = [
  { id: 'email', name: 'Email Address', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', flags: 'gm' },
  {
    id: 'url',
    name: 'HTTP/HTTPS URL',
    pattern:
      'https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&\\/=]*)',
    flags: 'gi',
  },
  {
    id: 'ipv4',
    name: 'IPv4 Address',
    pattern:
      '\\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    flags: 'g',
  },
  { id: 'ipv6', name: 'IPv6 Address', pattern: '(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}', flags: 'gi' },
  {
    id: 'date-iso',
    name: 'ISO 8601 Date (YYYY-MM-DD)',
    pattern: '^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$',
    flags: 'm',
  },
  { id: 'german-zip', name: 'German Postal Code (PLZ)', pattern: '\\b[0-9]{5}\\b', flags: 'g' },
  { id: 'iban', name: 'IBAN Format', pattern: '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}', flags: 'gi' },
  { id: 'hex-color', name: 'Hex Color (#RGB / #RRGGBB)', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'g' },
  {
    id: 'uuid',
    name: 'UUID v4',
    pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}',
    flags: 'gi',
  },
  { id: 'phone-intl', name: 'International Phone Number', pattern: '\\+?[1-9]\\d{1,14}', flags: 'g' },
];

export const REGEX_CHEATSHEET = [
  {
    group: 'Character Classes',
    items: [
      { code: '.', desc: 'Any character except newline' },
      { code: '\\d', desc: 'Any digit [0-9]' },
      { code: '\\D', desc: 'Any non-digit' },
      { code: '\\w', desc: 'Word character [a-zA-Z0-9_]' },
      { code: '\\W', desc: 'Non-word character' },
      { code: '\\s', desc: 'Whitespace (space, tab, newline)' },
      { code: '[abc]', desc: 'Any of a, b, or c' },
      { code: '[^abc]', desc: 'Not a, b, or c' },
      { code: '[a-z]', desc: 'Character range from a to z' },
    ],
  },
  {
    group: 'Anchors',
    items: [
      { code: '^', desc: 'Start of string or line' },
      { code: '$', desc: 'End of string or line' },
      { code: '\\b', desc: 'Word boundary' },
      { code: '\\B', desc: 'Non-word boundary' },
    ],
  },
  {
    group: 'Quantifiers',
    items: [
      { code: '*', desc: '0 or more occurrences (greedy)' },
      { code: '+', desc: '1 or more occurrences (greedy)' },
      { code: '?', desc: '0 or 1 occurrence (optional)' },
      { code: '{n}', desc: 'Exactly n occurrences' },
      { code: '{n,}', desc: 'n or more occurrences' },
      { code: '{n,m}', desc: 'Between n and m occurrences' },
      { code: '*?', desc: '0 or more occurrences (lazy)' },
      { code: '+?', desc: '1 or more occurrences (lazy)' },
    ],
  },
  {
    group: 'Groups & Lookaround',
    items: [
      { code: '(abc)', desc: 'Capture group' },
      { code: '(?<name>abc)', desc: 'Named capture group' },
      { code: '(?:abc)', desc: 'Non-capturing group' },
      { code: '(?=abc)', desc: 'Positive lookahead' },
      { code: '(?!abc)', desc: 'Negative lookahead' },
      { code: '(?<=abc)', desc: 'Positive lookbehind' },
      { code: '(?<!abc)', desc: 'Negative lookbehind' },
    ],
  },
  {
    group: 'Flags',
    items: [
      { code: 'g', desc: 'Global match (find all)' },
      { code: 'i', desc: 'Case-insensitive matching' },
      { code: 'm', desc: 'Multiline (^ and $ match per line)' },
      { code: 's', desc: 'Dot matches newline (dotAll)' },
      { code: 'u', desc: 'Unicode support' },
      { code: 'd', desc: 'Generate indices for substrings' },
    ],
  },
];

/**
 * Token-by-token explanation in English and German.
 * @param {string} pattern
 * @param {'en' | 'de'} locale
 * @returns {{ token: string, explanation: string }[]}
 */
export function explainRegex(pattern, locale = 'en') {
  /** @type {{ token: string, explanation: string }[]} */
  const tokens = [];
  let i = 0;

  const t = (/** @type {string} */ en, /** @type {string} */ de) => (locale === 'de' ? de : en);

  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '^') {
      tokens.push({
        token: '^',
        explanation: t('Matches beginning of line/input', 'Passt auf den Zeilen- bzw. String-Anfang'),
      });
      i++;
    } else if (c === '$') {
      tokens.push({
        token: '$',
        explanation: t('Matches end of line/input', 'Passt auf das Zeilen- bzw. String-Ende'),
      });
      i++;
    } else if (c === '.') {
      tokens.push({
        token: '.',
        explanation: t(
          'Matches any character (except newline)',
          'Passt auf ein beliebiges Zeichen (außer Zeilenumbruch)',
        ),
      });
      i++;
    } else if (c === '\\') {
      const next = pattern[i + 1] || '';
      if (next === 'd')
        tokens.push({ token: '\\d', explanation: t('Matches any digit [0-9]', 'Passt auf eine Ziffer [0-9]') });
      else if (next === 'D')
        tokens.push({ token: '\\D', explanation: t('Matches any non-digit', 'Passt auf ein Nicht-Ziffernzeichen') });
      else if (next === 'w')
        tokens.push({
          token: '\\w',
          explanation: t(
            'Matches any word character (letter, digit, underscore)',
            'Passt auf ein Wortzeichen (Buchstabe, Ziffer, Unterstrich)',
          ),
        });
      else if (next === 'W')
        tokens.push({
          token: '\\W',
          explanation: t('Matches any non-word character', 'Passt auf ein Nicht-Wortzeichen'),
        });
      else if (next === 's')
        tokens.push({
          token: '\\s',
          explanation: t('Matches whitespace character', 'Passt auf ein Whitespace-Zeichen'),
        });
      else if (next === 'b') tokens.push({ token: '\\b', explanation: t('Word boundary', 'Wortgrenze') });
      else
        tokens.push({
          token: `\\${next}`,
          explanation: t(`Escaped character "${next}"`, `Maskiertes Zeichen "${next}"`),
        });
      i += 2;
    } else if (c === '[') {
      const end = pattern.indexOf(']', i);
      if (end !== -1) {
        const cls = pattern.slice(i, end + 1);
        tokens.push({
          token: cls,
          explanation: t(`Character class: matches ${cls}`, `Zeichenklasse: passt auf ${cls}`),
        });
        i = end + 1;
      } else {
        tokens.push({ token: '[', explanation: '[' });
        i++;
      }
    } else if (c === '(') {
      if (pattern.startsWith('(?<', i)) {
        const endName = pattern.indexOf('>', i);
        const name = pattern.slice(i + 3, endName);
        tokens.push({
          token: `(?<${name}>`,
          explanation: t(`Named capture group "${name}"`, `Benannte Erfassungsgruppe "${name}"`),
        });
        i = endName + 1;
      } else if (pattern.startsWith('(?:', i)) {
        tokens.push({
          token: '(?:',
          explanation: t('Non-capturing group start', 'Start einer nicht-erfassenden Gruppe'),
        });
        i += 3;
      } else {
        tokens.push({ token: '(', explanation: t('Capture group start', 'Start einer Erfassungsgruppe') });
        i++;
      }
    } else if (c === ')') {
      tokens.push({ token: ')', explanation: t('Group end', 'Ende der Gruppe') });
      i++;
    } else if (c === '*' || c === '+' || c === '?') {
      const lazy = pattern[i + 1] === '?' ? '?' : '';
      const tok = c + lazy;
      tokens.push({
        token: tok,
        explanation:
          c === '*'
            ? t('0 or more times', '0 oder mehrmals')
            : c === '+'
              ? t('1 or more times', '1 oder mehrmals')
              : t('0 or 1 time (optional)', '0 oder 1 Mal (optional)'),
      });
      i += tok.length;
    } else if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const quant = pattern.slice(i, end + 1);
        tokens.push({ token: quant, explanation: t(`Quantifier: repeats ${quant}`, `Quantor: wiederholt ${quant}`) });
        i = end + 1;
      } else {
        tokens.push({ token: '{', explanation: '{' });
        i++;
      }
    } else if (c === '|') {
      tokens.push({ token: '|', explanation: t('OR condition (alternation)', 'ODER-Bedingung (Alternative)') });
      i++;
    } else {
      tokens.push({ token: c, explanation: t(`Literal character "${c}"`, `Buchstäbliches Zeichen "${c}"`) });
      i++;
    }
  }

  return tokens;
}
