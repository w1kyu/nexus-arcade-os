// @ts-check
// In-memory search index (runs inside the search worker; also usable in-thread).
// Documents are matched on title, keywords, subtitle and body text (substring only, with a
// snippet). Ranking: exact title > title prefix > title word/substring > keywords > subtitle >
// body; frequently and recently used items rank higher within that order.
import { fold, fuzzyMatch, TIER } from './fuzzy.js';

/**
 * Score bands for matches outside the title. Every band stays below a title word or substring
 * match (≥ ~390), so "Notes" finds Nexus Notes before Journal (which has the keyword "notes").
 * A fuzzy match's tier score (≤ 1000) is compressed into the band.
 */
const BAND = { keyword: [300, 380], subtitle: [200, 280], body: [100, 180] };
/** @param {keyof typeof BAND} band @param {number} tierScore */
const inBand = (band, tierScore) => BAND[band][0] + (BAND[band][1] - BAND[band][0]) * Math.min(1, tierScore / 1000);

/**
 * @typedef {object} SearchDoc
 * @property {string} id            unique, e.g. 'app:nexus.notes', 'file:/home/ada/x.md'
 * @property {'app' | 'command' | 'setting' | 'file' | 'folder'} type
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string[]} [keywords]
 * @property {string} [body]         searchable text (file contents)
 * @property {string} [icon]
 * @property {unknown} [data]        returned with results (e.g. the path or command id)
 */

/**
 * @typedef {object} SearchResult
 * @property {string} id
 * @property {SearchDoc['type']} type
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [icon]
 * @property {unknown} [data]
 * @property {number} score
 * @property {import('./fuzzy.js').Range[]} titleRanges   for highlighting
 * @property {string} [snippet]                            body excerpt around the match
 */

/** @typedef {{ count: number, last: number }} Usage */

const MAX_BODY = 256 * 1024;

export function createSearchIndex({ now = Date.now } = {}) {
  /** @type {Map<string, SearchDoc & { foldedBody?: string }>} */
  const docs = new Map();
  /** @type {Map<string, Usage>} */
  let usage = new Map();

  /** @param {string} id */
  function usageBoost(id) {
    const u = usage.get(id);
    if (!u) return 0;
    const age = now() - u.last;
    const recency = age < 3_600_000 ? 40 : age < 86_400_000 ? 25 : age < 7 * 86_400_000 ? 10 : 0;
    return Math.min(60, Math.log2(1 + u.count) * 12) + recency;
  }

  /**
   * @param {string} body
   * @param {number} at index of the match in the folded body
   * @param {number} length
   */
  function snippet(body, at, length) {
    const start = Math.max(0, at - 40);
    const end = Math.min(body.length, at + length + 60);
    return `${start > 0 ? '…' : ''}${body.slice(start, end).replace(/\s+/g, ' ').trim()}${end < body.length ? '…' : ''}`;
  }

  return {
    /** @param {SearchDoc[]} list */
    upsert(list) {
      for (const doc of list) {
        const body = doc.body ? doc.body.slice(0, MAX_BODY) : undefined;
        docs.set(doc.id, { ...doc, body, foldedBody: body ? fold(body) : undefined });
      }
    },

    /** @param {string[]} ids */
    remove(ids) {
      for (const id of ids) docs.delete(id);
    },

    /** Removes every document whose id starts with `prefix` (e.g. 'file:/home/ada/old/'). */
    removePrefix(/** @type {string} */ prefix) {
      for (const id of [...docs.keys()]) if (id.startsWith(prefix)) docs.delete(id);
    },

    /** @param {Record<string, Usage>} entries */
    setUsage(entries) {
      usage = new Map(Object.entries(entries));
    },

    /** @param {string} id */
    recordUse(id) {
      const u = usage.get(id) ?? { count: 0, last: 0 };
      usage.set(id, { count: u.count + 1, last: now() });
      return Object.fromEntries(usage);
    },

    /**
     * @param {string} query
     * @param {{ limit?: number, types?: SearchDoc['type'][] }} [options]
     * @returns {SearchResult[]}
     */
    query(query, { limit = 50, types } = {}) {
      const q = query.trim();
      if (!q) return [];
      const foldedQuery = fold(q);
      /** @type {SearchResult[]} */
      const results = [];
      for (const doc of docs.values()) {
        if (types && !types.includes(doc.type)) continue;
        const title = fuzzyMatch(q, doc.title);
        let score = title?.score ?? 0;
        // Keywords and subtitles (descriptions) count only as real substrings: scattered letters
        // in a long sentence match almost any query ("Notes" found Arcade Hub).
        for (const keyword of doc.keywords ?? []) {
          const m = keyword ? fuzzyMatch(q, keyword) : null;
          if (m && m.score >= TIER.substring - 100) score = Math.max(score, inBand('keyword', m.score));
        }
        const sub = doc.subtitle ? fuzzyMatch(q, doc.subtitle) : null;
        if (sub && sub.score >= TIER.substring - 100) score = Math.max(score, inBand('subtitle', sub.score));
        /** @type {string | undefined} */
        let excerpt;
        if (doc.foldedBody && doc.body && foldedQuery.length >= 2) {
          const at = doc.foldedBody.indexOf(foldedQuery);
          if (at !== -1) {
            score = Math.max(score, BAND.body[1] - Math.min(BAND.body[1] - BAND.body[0], at / 100));
            excerpt = snippet(doc.body, at, foldedQuery.length);
          }
        }
        if (score <= 0) continue;
        results.push({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          subtitle: doc.subtitle,
          icon: doc.icon,
          data: doc.data,
          score: score + usageBoost(doc.id),
          titleRanges: title?.ranges ?? [],
          ...(excerpt ? { snippet: excerpt } : {}),
        });
      }
      return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
    },

    get size() {
      return docs.size;
    },
  };
}

/** @typedef {ReturnType<typeof createSearchIndex>} SearchIndex */
