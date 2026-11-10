// @ts-check
// Pure data logic for Nexus Notes: YAML front-matter parsing & serialization, wiki-link
// extraction, backlink indexing, outline/word-count stats, search & filtering, and sorting.

/**
 * @typedef {object} NoteMeta
 * @property {string[]} tags
 * @property {boolean} favorite
 * @property {boolean} pinned
 * @property {string} created      ISO timestamp
 * @property {string} updated      ISO timestamp
 * @property {import('../../services/crypto.js').EncryptedPayload | null} [encrypted]
 */

/**
 * @typedef {object} ParsedNote
 * @property {NoteMeta} meta
 * @property {string} body
 */

/**
 * @typedef {object} NoteEntry
 * @property {string} path         full VFS path (e.g. '/home/user/Documents/Notes/Ideas.md')
 * @property {string} folder       relative folder inside Notes root ('' for root, 'Uni/CS' for nested)
 * @property {string} title        note title (file name without .md)
 * @property {NoteMeta} meta
 * @property {string} body         decrypted or plain body ('' while locked)
 * @property {boolean} locked      true when `meta.encrypted` is present and not yet unlocked in memory
 * @property {number} modified     VFS modified timestamp
 */

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parses YAML front-matter from a Markdown note.
 * Supports `tags: [a, b]` or YAML list items, booleans (`favorite`, `pinned`), ISO strings
 * (`created`, `updated`), and JSON-encoded `encrypted` payload.
 * @param {string} raw
 * @param {number} [fallbackTime]
 * @returns {ParsedNote}
 */
export function parseFrontMatter(raw, fallbackTime = Date.now()) {
  const isoFallback = new Date(fallbackTime).toISOString();
  /** @type {NoteMeta} */
  const meta = {
    tags: [],
    favorite: false,
    pinned: false,
    created: isoFallback,
    updated: isoFallback,
    encrypted: null,
  };
  const text = String(raw ?? '');
  const match = FM_REGEX.exec(text);
  if (!match) {
    return { meta, body: text };
  }
  const yaml = match[1];
  const body = text.slice(match[0].length);
  const lines = yaml.split(/\r?\n/);
  let inTagsList = false;

  for (const line of lines) {
    if (inTagsList) {
      const itemMatch = /^\s*-\s+(.+)$/.exec(line);
      if (itemMatch) {
        const tag = cleanScalar(itemMatch[1]);
        if (tag && !meta.tags.includes(tag)) meta.tags.push(tag);
        continue;
      }
      inTagsList = false;
    }
    const kv = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const val = rawVal.trim();
    if (key === 'tags') {
      if (!val) {
        inTagsList = true;
      } else if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1).trim();
        meta.tags = inner
          ? inner
              .split(',')
              .map((s) => cleanScalar(s))
              .filter(Boolean)
          : [];
      } else {
        meta.tags = val
          .split(',')
          .map((s) => cleanScalar(s))
          .filter(Boolean);
      }
    } else if (key === 'favorite') {
      meta.favorite = val === 'true' || val === 'yes';
    } else if (key === 'pinned') {
      meta.pinned = val === 'true' || val === 'yes';
    } else if (key === 'created' && val) {
      meta.created = cleanScalar(val);
    } else if (key === 'updated' && val) {
      meta.updated = cleanScalar(val);
    } else if (key === 'encrypted' && val && val !== 'null' && val !== 'false') {
      try {
        const parsed = JSON.parse(val);
        if (parsed && parsed.v === 1 && parsed.cipher === 'AES-GCM-256') {
          meta.encrypted = parsed;
        }
      } catch {
        // Ignore malformed encrypted field.
      }
    }
  }
  return { meta, body };
}

/** @param {string} s */
function cleanScalar(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

/** @param {string} s */
function formatYamlString(s) {
  if (/^[a-zA-Z0-9_/-]+$/.test(s)) return s;
  return JSON.stringify(s);
}

/**
 * Serializes `meta` and `body` back into a Markdown file with YAML front-matter.
 * If `meta.encrypted` is present, the plaintext body is never written to disk.
 * @param {Partial<NoteMeta>} meta
 * @param {string} body
 * @returns {string}
 */
export function serializeFrontMatter(meta, body) {
  const nowIso = new Date().toISOString();
  const tags = [...new Set((meta.tags ?? []).map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean))];
  const created = meta.created || nowIso;
  const updated = meta.updated || nowIso;
  const lines = [
    '---',
    `tags: [${tags.map(formatYamlString).join(', ')}]`,
    `favorite: ${Boolean(meta.favorite)}`,
    ...(meta.pinned ? ['pinned: true'] : []),
    `created: ${created}`,
    `updated: ${updated}`,
    ...(meta.encrypted ? [`encrypted: ${JSON.stringify(meta.encrypted)}`] : []),
    '---',
    '',
  ];
  const diskBody = meta.encrypted ? '' : String(body ?? '');
  return lines.join('\n') + diskBody;
}

/**
 * Extracts all unique wiki-link target note titles (`[[Target]]`, `[[Target#Heading]]`, `[[Target|Alias]]`)
 * from Markdown, ignoring fenced and inline code.
 * @param {string} markdown
 * @returns {string[]}
 */
export function extractWikiLinks(markdown) {
  const stripped = String(markdown ?? '')
    .replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, '$1')
    .replace(/(`+)(?:(?!\1)[\s\S])+?\1/g, '');
  /** @type {Set<string>} */
  const targets = new Set();
  const re = /\[\[([^\]|#]+?)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const title = m[1].trim();
    if (title) targets.add(title);
  }
  return [...targets];
}

/**
 * Computes backlinks for a note with `targetTitle`: returns notes that link to `targetTitle`
 * (case-insensitive title match) along with a context snippet.
 * @param {NoteEntry[]} notes
 * @param {string} targetTitle
 * @returns {{ note: NoteEntry, snippet: string }[]}
 */
export function computeBacklinks(notes, targetTitle) {
  const needle = targetTitle.trim().toLowerCase();
  if (!needle) return [];
  /** @type {{ note: NoteEntry, snippet: string }[]} */
  const out = [];
  for (const note of notes) {
    if (note.locked || note.title.toLowerCase() === needle) continue;
    const links = extractWikiLinks(note.body);
    if (!links.some((l) => l.toLowerCase() === needle)) continue;
    const line =
      note.body
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.toLowerCase().includes(`[[${needle}`)) ?? note.title;
    out.push({ note, snippet: line.slice(0, 140) });
  }
  return out;
}

/**
 * Extracts headings (`#`–`####`), word count, character count, reading time (minutes), and checklist counts.
 * @param {string} markdown
 */
export function analyzeNote(markdown) {
  const text = String(markdown ?? '');
  const strippedCode = text.replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, '$1');
  /** @type {{ level: number, text: string, line: number }[]} */
  const outline = [];
  const lines = text.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const hm = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (hm) {
      outline.push({ level: hm[1].length, text: hm[2].trim(), line: i + 1 });
    }
  }
  const plain = strippedCode
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .trim();
  const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));

  /** @type {{ text: string, done: boolean, line: number }[]} */
  const checklist = [];
  for (let i = 0; i < lines.length; i++) {
    const cm = /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(lines[i]);
    if (cm) {
      checklist.push({ done: cm[1].toLowerCase() === 'x', text: cm[2].trim(), line: i + 1 });
    }
  }

  return { outline, words, chars, readingMinutes, checklist };
}

/**
 * Sorts notes with pinned notes first, then by `sortBy` ('updated' | 'created' | 'title').
 * @param {NoteEntry[]} notes
 * @param {'updated' | 'created' | 'title'} sortBy
 * @returns {NoteEntry[]}
 */
export function sortNotes(notes, sortBy = 'updated') {
  return [...notes].sort((a, b) => {
    if (Boolean(a.meta.pinned) !== Boolean(b.meta.pinned)) {
      return a.meta.pinned ? -1 : 1;
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    const ta = Date.parse(sortBy === 'created' ? a.meta.created : a.meta.updated) || a.modified || 0;
    const tb = Date.parse(sortBy === 'created' ? b.meta.created : b.meta.updated) || b.modified || 0;
    return tb - ta;
  });
}

/**
 * Filters and searches notes, returning matching entries with highlighted snippet text.
 * @param {NoteEntry[]} notes
 * @param {object} filter
 * @param {string} [filter.query]
 * @param {string | null} [filter.folder]        null = all folders, '' = root or subtree
 * @param {string | null} [filter.tag]
 * @param {boolean} [filter.favoritesOnly]
 * @param {boolean} [filter.recentOnly]
 * @param {string} [filter.dateFrom]             YYYY-MM-DD
 * @param {string} [filter.dateTo]               YYYY-MM-DD
 * @param {'updated' | 'created' | 'title'} [filter.sortBy]
 * @returns {{ note: NoteEntry, snippet: string, matchRanges: [number, number][] }[]}
 */
export function filterNotes(notes, filter = {}) {
  const {
    query = '',
    folder = null,
    tag = null,
    favoritesOnly = false,
    recentOnly = false,
    dateFrom = '',
    dateTo = '',
    sortBy = 'updated',
  } = filter;
  const q = query.trim().toLowerCase();
  const fromTs = dateFrom ? Date.parse(`${dateFrom}T00:00:00`) : null;
  const toTs = dateTo ? Date.parse(`${dateTo}T23:59:59.999`) : null;

  let list = notes.filter((n) => {
    if (favoritesOnly && !n.meta.favorite) return false;
    if (tag && !n.meta.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (folder !== null) {
      if (folder === '') {
        // Root folder shows all notes unless a subfolder is selected, or exact root if desired.
        // We match exact folder or nested subfolder:
      } else if (n.folder !== folder && !n.folder.startsWith(`${folder}/`)) {
        return false;
      }
    }
    const updatedTs = Date.parse(n.meta.updated) || n.modified || 0;
    if (fromTs && !Number.isNaN(fromTs) && updatedTs < fromTs) return false;
    if (toTs && !Number.isNaN(toTs) && updatedTs > toTs) return false;
    if (q) {
      const inTitle = n.title.toLowerCase().includes(q);
      const inTags = n.meta.tags.some((t) => t.toLowerCase().includes(q));
      const inBody = !n.locked && n.body.toLowerCase().includes(q);
      if (!inTitle && !inTags && !inBody) return false;
    }
    return true;
  });

  list = sortNotes(list, recentOnly ? 'updated' : sortBy);
  if (recentOnly) list = list.slice(0, 25);

  return list.map((note) => {
    if (note.locked) {
      return { note, snippet: '', matchRanges: [] };
    }
    const clean = note.body
      .replace(/^#+\s+/gm, '')
      .replace(/[`*_~>[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!q) {
      return { note, snippet: clean.slice(0, 120), matchRanges: [] };
    }
    const idx = clean.toLowerCase().indexOf(q);
    if (idx === -1) {
      return { note, snippet: clean.slice(0, 120), matchRanges: [] };
    }
    const start = Math.max(0, idx - 30);
    const snippet = (start > 0 ? '…' : '') + clean.slice(start, start + 120);
    const offset = (start > 0 ? 1 : 0) + (idx - start);
    return {
      note,
      snippet,
      matchRanges: [[offset, offset + q.length]],
    };
  });
}

/**
 * Toggles the Nth GFM task-list checkbox (`- [ ]` ↔ `- [x]`) in a Markdown string.
 * @param {string} markdown
 * @param {number} taskIndex
 * @param {boolean} checked
 * @returns {string}
 */
export function toggleMarkdownTask(markdown, taskIndex, checked) {
  let current = 0;
  let inFence = false;
  return String(markdown ?? '')
    .split('\n')
    .map((line) => {
      if (/^(`{3,}|~{3,})/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s+)/, (m, pre, state, post) => {
        if (current++ === taskIndex) {
          return `${pre}${checked ? 'x' : ' '}${post}`;
        }
        return m;
      });
    })
    .join('\n');
}

/** Built-in note templates (Daily note, Meeting notes, Lecture notes, Cornell notes). */
export const NOTE_TEMPLATES = /** @type {const} */ ([
  {
    id: 'daily',
    tags: ['daily'],
    /** @param {string} dateStr */
    title: (dateStr) => dateStr,
    /** @param {string} dateStr @param {'en' | 'de'} locale */
    body: (dateStr, locale) =>
      locale === 'de'
        ? `# Tagesnotiz — ${dateStr}\n\n## Fokus heute\n- [ ] \n\n## Notizen\n\n\n## Rückblick\n- Was lief gut?\n`
        : `# Daily Note — ${dateStr}\n\n## Today's Focus\n- [ ] \n\n## Notes\n\n\n## Reflection\n- What went well?\n`,
  },
  {
    id: 'meeting',
    tags: ['meeting'],
    title: (dateStr) => `Meeting ${dateStr}`,
    body: (dateStr, locale) =>
      locale === 'de'
        ? `# Besprechung — ${dateStr}\n\n**Teilnehmer:** \n**Ziel:** \n\n## Agenda\n1. \n\n## Entscheidungen & Notizen\n- \n\n## Aufgaben\n- [ ] \n`
        : `# Meeting — ${dateStr}\n\n**Attendees:** \n**Goal:** \n\n## Agenda\n1. \n\n## Decisions & Notes\n- \n\n## Action Items\n- [ ] \n`,
  },
  {
    id: 'lecture',
    tags: ['uni', 'lecture'],
    title: (dateStr) => `Lecture ${dateStr}`,
    body: (dateStr, locale) =>
      locale === 'de'
        ? `# Vorlesung — ${dateStr}\n\n**Kurs:** \n**Thema:** \n\n## Kernkonzepte\n- \n\n## Formeln & Beispiele\n$$f(x) = x^2$$\n\n## Offene Fragen\n- [ ] \n`
        : `# Lecture — ${dateStr}\n\n**Course:** \n**Topic:** \n\n## Key Concepts\n- \n\n## Formulas & Examples\n$$f(x) = x^2$$\n\n## Open Questions\n- [ ] \n`,
  },
]);
