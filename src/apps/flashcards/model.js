// @ts-check
// Flashcards model: decks & subdecks, card types (basic, reversed, cloze, type_answer),
// cloze parsing, CSV/TSV import/export, and Anki .apkg import via fflate + sql.js.
import { unzipSync } from 'fflate';
import { createNewCardFSRS } from './fsrs.js';

/**
 * @typedef {'basic' | 'reversed' | 'cloze' | 'type_answer'} CardType
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} name           e.g. 'Informatik' or 'Informatik::Betriebssysteme'
 * @property {string} [description]
 * @property {string} color          e.g. 'cyan', 'emerald', 'amber', 'purple', 'rose'
 * @property {number} newLimit       daily new card limit (default 20)
 * @property {number} reviewLimit    daily review limit (default 100)
 * @property {number} createdAt
 */

/**
 * @typedef {object} Flashcard
 * @property {string} id
 * @property {string} deckId
 * @property {CardType} type
 * @property {string} front          Markdown text with math
 * @property {string} back           Markdown text with math
 * @property {string} [answer]       Expected answer for type_answer cards
 * @property {string[]} tags
 * @property {import('./fsrs.js').FSRSCardData} fsrs
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * Extracts deck hierarchy name: e.g. 'Informatik::Betriebssysteme' -> ['Informatik', 'Betriebssysteme']
 * @param {string} deckName
 * @returns {string[]}
 */
export function splitDeckHierarchy(deckName) {
  return deckName
    .split('::')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Renders front of a cloze card by replacing {{c1::answer}} with [...]
 * @param {string} text
 * @param {number} [targetIndex]
 * @returns {string}
 */
export function renderClozeFront(text, targetIndex = 1) {
  const re = /\{\{c(\d+)::([^:]+?)(?:::([^}]+))?\}\}/g;
  return text.replace(re, (_, indexStr, answer, hint) => {
    const idx = Number.parseInt(indexStr, 10);
    if (idx === targetIndex) {
      return hint ? `[${hint}]` : '[ ... ]';
    }
    return answer;
  });
}

/**
 * Renders back of a cloze card by highlighting the answer.
 * @param {string} text
 * @param {number} [targetIndex]
 * @returns {string}
 */
export function renderClozeBack(text, targetIndex = 1) {
  const re = /\{\{c(\d+)::([^:]+?)(?:::([^}]+))?\}\}/g;
  return text.replace(re, (_, indexStr, answer) => {
    const idx = Number.parseInt(indexStr, 10);
    if (idx === targetIndex) {
      return `**${answer}**`;
    }
    return answer;
  });
}

/**
 * Exports cards of a deck to CSV format.
 * @param {Flashcard[]} cards
 * @returns {string}
 */
export function exportCardsToCSV(cards) {
  const lines = ['Front,Back,Type,Tags'];
  for (const c of cards) {
    const escape = (/** @type {string} */ s) => `"${(s || '').replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
    lines.push([escape(c.front), escape(c.back), escape(c.type), escape(c.tags.join(';'))].join(','));
  }
  return lines.join('\n');
}

/**
 * Parses CSV or TSV string into card records.
 * @param {string} text
 * @param {string} deckId
 * @returns {Flashcard[]}
 */
export function parseCardsCSV(text, deckId) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const startIndex = lines[0].toLowerCase().includes('front') ? 1 : 0;
  const cards = [];

  for (let i = startIndex; i < lines.length; i++) {
    const parts = splitCSVLine(lines[i], delimiter);
    if (parts.length >= 2) {
      const front = parts[0].replace(/\\n/g, '\n').trim();
      const back = parts[1].replace(/\\n/g, '\n').trim();
      const type = /** @type {CardType} */ (
        ['basic', 'reversed', 'cloze', 'type_answer'].includes(parts[2]) ? parts[2] : 'basic'
      );
      const tags = parts[3]
        ? parts[3]
            .split(';')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      if (front) {
        cards.push({
          id: crypto.randomUUID(),
          deckId,
          type,
          front,
          back,
          tags,
          fsrs: createNewCardFSRS(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }
  return cards;
}

/** @param {string} line @param {string} delimiter */
function splitCSVLine(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Imports cards from an Anki .apkg package.
 * @param {Uint8Array} fileBytes
 * @param {string} targetDeckId
 * @returns {Promise<Flashcard[]>}
 */
export async function importAnkiApkg(fileBytes, targetDeckId) {
  // 1. Unzip .apkg
  const unzipped = unzipSync(fileBytes);
  const dbBytes = unzipped['collection.anki21'] || unzipped['collection.anki2'];
  if (!dbBytes) {
    throw new Error('Invalid .apkg: collection database not found');
  }

  // 2. Load sql.js
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBytes);

  // 3. Query notes table
  const query = db.exec('SELECT id, flds, tags FROM notes');
  if (!query || query.length === 0) {
    db.close();
    return [];
  }

  const rows = query[0].values;
  const cards = [];

  for (const row of rows) {
    const rawFlds = String(row[1] || '');
    const fields = rawFlds.split('\x1f'); // Anki uses 0x1F unit separator
    const front = fields[0] ? stripHtml(fields[0]).trim() : '';
    const back = fields[1] ? stripHtml(fields[1]).trim() : '';
    const tags = String(row[2] || '')
      .split(' ')
      .map((t) => t.trim())
      .filter(Boolean);

    if (front) {
      cards.push({
        id: crypto.randomUUID(),
        deckId: targetDeckId,
        type: /** @type {CardType} */ ('basic'),
        front,
        back: back || front,
        tags,
        fsrs: createNewCardFSRS(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  db.close();
  return cards;
}

/** @param {string} html */
function stripHtml(html) {
  return html.replace(/<br\s*[/]?>/gi, '\n').replace(/<[^>]+>/g, '');
}

/**
 * Computes study statistics: reviews by day, forecast, retention, hardest cards.
 * @param {Flashcard[]} cards
 * @returns {{ dueCount: number, newCount: number, learningCount: number, totalCount: number, hardestCards: Flashcard[] }}
 */
export function computeDeckStudyCounts(cards) {
  const now = Date.now();
  let dueCount = 0;
  let newCount = 0;
  let learningCount = 0;

  for (const c of cards) {
    if (c.fsrs.state === 'new') {
      newCount++;
    } else if (c.fsrs.state === 'learning' || c.fsrs.state === 'relearning') {
      learningCount++;
    } else if (c.fsrs.due <= now) {
      dueCount++;
    }
  }

  const hardestCards = [...cards]
    .filter((c) => c.fsrs.reps > 0)
    .sort((a, b) => b.fsrs.difficulty - a.fsrs.difficulty || b.fsrs.lapses - a.fsrs.lapses)
    .slice(0, 5);

  return {
    dueCount,
    newCount,
    learningCount,
    totalCount: cards.length,
    hardestCards,
  };
}
