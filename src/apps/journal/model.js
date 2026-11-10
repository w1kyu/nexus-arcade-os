// @ts-check
// Journal model: mood tracking, "On this day" historical lookup,
// word count analytics, writing prompts (EN/DE), and encryption helpers.

/**
 * @typedef {1 | 2 | 3 | 4 | 5} MoodLevel
 * 1 = very bad / awful
 * 2 = bad / down
 * 3 = neutral / okay
 * 4 = good / happy
 * 5 = great / awesome
 */

/**
 * @typedef {object} JournalEntry
 * @property {string} id
 * @property {string} date                 'YYYY-MM-DD'
 * @property {string} title
 * @property {string} content              Markdown plaintext (or empty when encrypted)
 * @property {MoodLevel} mood
 * @property {string[]} [tags]
 * @property {string[]} [photos]           VFS image paths
 * @property {boolean} [isEncrypted]
 * @property {import('../../services/crypto.js').EncryptedPayload} [encryptedPayload]
 * @property {number} [wordCount]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

export const MOOD_META = /** @type {const} */ ({
  1: { level: 1, emoji: '😞', label: { en: 'Awful', de: 'Sehr schlecht' }, color: '#f87171' },
  2: { level: 2, emoji: '🙁', label: { en: 'Down', de: 'Schlecht' }, color: '#fb923c' },
  3: { level: 3, emoji: '😐', label: { en: 'Neutral', de: 'Neutral' }, color: '#94a3b8' },
  4: { level: 4, emoji: '🙂', label: { en: 'Good', de: 'Gut' }, color: '#38bdf8' },
  5: { level: 5, emoji: '🤩', label: { en: 'Great', de: 'Hervorragend' }, color: '#4ade80' },
});

export const WRITING_PROMPTS = {
  en: [
    'What was the best part of your day today?',
    'What is one challenge you overcame today, and how did you handle it?',
    'What are three small things you felt grateful for today?',
    'Who made a positive impact on your day, and why?',
    'What is something new you learned or realized today?',
    'If you could redo one moment from today, what would you do differently?',
    'What are your main intentions or hopes for tomorrow?',
  ],
  de: [
    'Was war der beste Moment deines heutigen Tages?',
    'Welche Herausforderung hast du heute gemeistert und wie?',
    'Wofür bist du heute besonders dankbar?',
    'Wer hat deinen Tag heute positiv beeinflusst?',
    'Was hast du heute Neues gelernt oder verstanden?',
    'Wenn du einen Moment von heute wiederholen könntest, welcher wäre es?',
    'Was nimmst du dir für den morgigen Tag vor?',
  ],
};

/**
 * Computes word count in a text string.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Finds entries from previous years on the exact same month and day.
 * @param {JournalEntry[]} entries
 * @param {Date} [currentDate]
 * @returns {JournalEntry[]}
 */
export function findOnThisDay(entries, currentDate = new Date()) {
  const curMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const curDay = String(currentDate.getDate()).padStart(2, '0');
  const curYear = currentDate.getFullYear();
  const targetSuffix = `-${curMonth}-${curDay}`;

  return entries
    .filter((e) => {
      if (!e.date.endsWith(targetSuffix)) return false;
      const entryYear = parseInt(e.date.split('-')[0], 10);
      return entryYear < curYear;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Computes mood statistics (average, counts, 30-day timeline).
 * @param {JournalEntry[]} entries
 * @param {Date} [now]
 * @returns {{
 *   averageMood: number,
 *   totalEntries: number,
 *   moodCounts: Record<MoodLevel, number>,
 *   recentTimeline: Array<{ date: string, mood: MoodLevel | null }>
 * }}
 */
export function computeMoodStats(entries, now = new Date()) {
  const valid = entries.filter((e) => e.mood >= 1 && e.mood <= 5);
  const totalEntries = valid.length;
  /** @type {Record<MoodLevel, number>} */
  const moodCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  for (const e of valid) {
    moodCounts[e.mood]++;
    sum += e.mood;
  }

  const averageMood = totalEntries > 0 ? Number((sum / totalEntries).toFixed(2)) : 0;

  // Build 30-day timeline
  const entryByDate = new Map(entries.map((e) => [e.date, e.mood]));
  const recentTimeline = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  start.setDate(start.getDate() - 29);

  for (let i = 0; i < 30; i++) {
    const dStr = start.toISOString().split('T')[0];
    recentTimeline.push({
      date: dStr,
      mood: entryByDate.get(dStr) ?? null,
    });
    start.setDate(start.getDate() + 1);
  }

  return { averageMood, totalEntries, moodCounts, recentTimeline };
}
