// @ts-check
import { TARGETS_DE, TARGETS_EN } from './words.js';

/**
 * @typedef {'correct' | 'present' | 'absent'} LetterStatus
 */

/**
 * Evaluates a 5-letter guess against a target word.
 * Accurately handles duplicate letters.
 * @param {string} target 5-letter uppercase string
 * @param {string} guess 5-letter uppercase string
 * @returns {LetterStatus[]}
 */
export function evaluateGuess(target, guess) {
  const result = /** @type {LetterStatus[]} */ (new Array(5).fill('absent'));
  /** @type {Record<string, number>} */
  const counts = {};

  // Count available letters in target
  for (let i = 0; i < 5; i++) {
    const ch = target[i];
    counts[ch] = (counts[ch] || 0) + 1;
  }

  // Pass 1: exact matches ('correct' / green)
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
      counts[guess[i]]--;
    }
  }

  // Pass 2: misplaced matches ('present' / yellow)
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (counts[ch] && counts[ch] > 0) {
      result[i] = 'present';
      counts[ch]--;
    }
  }

  return result;
}

/**
 * Validates whether a guess satisfies Hard Mode constraints.
 * @param {string} newGuess
 * @param {{ guess: string, evaluation: LetterStatus[] }[]} history
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateHardMode(newGuess, history) {
  for (const { guess, evaluation } of history) {
    for (let i = 0; i < 5; i++) {
      if (evaluation[i] === 'correct' && newGuess[i] !== guess[i]) {
        return {
          valid: false,
          reason: `${i + 1}. letter must be ${guess[i]}`,
        };
      }
    }
    for (let i = 0; i < 5; i++) {
      if (evaluation[i] === 'present') {
        const requiredChar = guess[i];
        if (!newGuess.includes(requiredChar)) {
          return {
            valid: false,
            reason: `Must contain ${requiredChar}`,
          };
        }
      }
    }
  }
  return { valid: true };
}

/**
 * Deterministic daily word generator based on date string.
 * @param {'en' | 'de'} locale
 * @param {string} dateKey YYYY-MM-DD
 */
export function getDailyWord(locale, dateKey) {
  const list = locale === 'de' ? TARGETS_DE : TARGETS_EN;
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % list.length;
  return list[index].toUpperCase();
}

/**
 * Generates an emoji grid summary for sharing.
 * @param {string[]} guesses
 * @param {string} target
 * @param {string} dateKey
 * @param {boolean} hardMode
 */
export function generateShareGrid(guesses, target, dateKey, hardMode) {
  const won = guesses.includes(target);
  const attempts = won ? `${guesses.length}/6` : 'X/6';
  const star = hardMode ? '*' : '';
  const header = `Hexword ${dateKey} ${attempts}${star}\n`;

  const rows = guesses.map((g) => {
    const ev = evaluateGuess(target, g);
    return ev
      .map((s) => {
        if (s === 'correct') return '🟩';
        if (s === 'present') return '🟨';
        return '⬛';
      })
      .join('');
  });

  return `${header}\n${rows.join('\n')}`;
}
