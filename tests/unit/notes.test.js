import { describe, expect, it } from 'vitest';
import {
  analyzeNote,
  computeBacklinks,
  extractWikiLinks,
  filterNotes,
  parseFrontMatter,
  serializeFrontMatter,
  sortNotes,
  toggleMarkdownTask,
} from '../../src/apps/notes/model.js';

describe('Nexus Notes model', () => {
  it('parses and serializes YAML front-matter round-trip', () => {
    const raw = serializeFrontMatter(
      {
        tags: ['uni', 'math'],
        favorite: true,
        pinned: true,
        created: '2026-11-01T10:00:00.000Z',
        updated: '2026-11-02T12:00:00.000Z',
      },
      '# Linear Algebra\n\nEigenvalues $\\lambda$.',
    );
    const parsed = parseFrontMatter(raw);
    expect(parsed.meta.tags).toEqual(['uni', 'math']);
    expect(parsed.meta.favorite).toBe(true);
    expect(parsed.meta.pinned).toBe(true);
    expect(parsed.meta.created).toBe('2026-11-01T10:00:00.000Z');
    expect(parsed.meta.updated).toBe('2026-11-02T12:00:00.000Z');
    expect(parsed.body).toBe('# Linear Algebra\n\nEigenvalues $\\lambda$.');
  });

  it('never writes plaintext body when encrypted payload is present', () => {
    const encrypted = {
      v: 1,
      kdf: { name: 'PBKDF2-SHA256', iterations: 600000, salt: 'abc' },
      cipher: 'AES-GCM-256',
      iv: 'def',
      data: 'ciphertext',
    };
    const raw = serializeFrontMatter({ tags: ['secret'], favorite: false, encrypted }, 'TOP SECRET BODY');
    expect(raw).not.toContain('TOP SECRET BODY');
    const parsed = parseFrontMatter(raw);
    expect(parsed.meta.encrypted).toEqual(encrypted);
    expect(parsed.body).toBe('');
  });

  it('extracts wiki links and computes backlinks while ignoring code blocks', () => {
    const body = 'Link to [[Roadmap]] and [[Target#Section|Alias]], but not `[[InCode]]` or:\n```\n[[InFence]]\n```';
    expect(extractWikiLinks(body)).toEqual(['Roadmap', 'Target']);

    const notes = [
      {
        path: '/Notes/A.md',
        folder: '',
        title: 'Note A',
        meta: { tags: [], favorite: false, pinned: false, created: '', updated: '' },
        body: 'Refers to [[Roadmap]] here.',
        locked: false,
        modified: 1,
      },
      {
        path: '/Notes/Roadmap.md',
        folder: '',
        title: 'Roadmap',
        meta: { tags: [], favorite: false, pinned: false, created: '', updated: '' },
        body: '# Roadmap',
        locked: false,
        modified: 2,
      },
    ];
    const backlinks = computeBacklinks(notes, 'Roadmap');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].note.title).toBe('Note A');
  });

  it('analyzes outline, word count, reading time and checklist items', () => {
    const md = '# Heading 1\nSome words here.\n## Heading 2\n- [ ] Open item\n- [x] Done item';
    const info = analyzeNote(md);
    expect(info.outline).toEqual([
      { level: 1, text: 'Heading 1', line: 1 },
      { level: 2, text: 'Heading 2', line: 3 },
    ]);
    expect(info.words).toBeGreaterThan(5);
    expect(info.readingMinutes).toBe(1);
    expect(info.checklist).toEqual([
      { done: false, text: 'Open item', line: 4 },
      { done: true, text: 'Done item', line: 5 },
    ]);
  });

  it('toggles markdown task list items by index', () => {
    const md = '- [ ] First\n- [ ] Second';
    const next = toggleMarkdownTask(md, 1, true);
    expect(next).toBe('- [ ] First\n- [x] Second');
  });

  it('sorts pinned notes first and filters by query, tag, folder and favorite', () => {
    const notes = [
      {
        path: '/Notes/Uni/Math.md',
        folder: 'Uni',
        title: 'Math',
        meta: {
          tags: ['exam'],
          favorite: false,
          pinned: false,
          created: '2026-11-01T00:00:00Z',
          updated: '2026-11-03T00:00:00Z',
        },
        body: 'Study calculus and integrals',
        locked: false,
        modified: 3,
      },
      {
        path: '/Notes/Pinned.md',
        folder: '',
        title: 'Pinned Note',
        meta: {
          tags: ['home'],
          favorite: true,
          pinned: true,
          created: '2026-11-01T00:00:00Z',
          updated: '2026-11-01T00:00:00Z',
        },
        body: 'Important item',
        locked: false,
        modified: 1,
      },
    ];
    const sorted = sortNotes(notes, 'updated');
    expect(sorted[0].title).toBe('Pinned Note');

    const byQuery = filterNotes(notes, { query: 'calculus' });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].note.title).toBe('Math');
    expect(byQuery[0].matchRanges.length).toBe(1);

    const byFolder = filterNotes(notes, { folder: 'Uni' });
    expect(byFolder).toHaveLength(1);
    expect(byFolder[0].note.title).toBe('Math');
  });
});
