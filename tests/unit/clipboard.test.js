import { describe, expect, it, vi } from 'vitest';
import { expandSnippet, filterEntries, formatClipPreview, formatRelativeTime } from '../../src/apps/clipboard/model.js';
import { commands, terminal } from '../../src/apps/clipboard/index.js';

describe('Clipboard App — Model', () => {
  it('expands template variables in snippets', () => {
    const fixedDate = new Date(2026, 4, 15, 14, 30); // 2026-05-15 14:30
    const template =
      'Date: {{date}}, Time: {{time}}, DT: {{datetime}}, Year: {{year}}, Month: {{month}}, Day: {{day}}, Clip: {{clipboard}}, Unknown: {{foo}}';
    const result = expandSnippet(template, {
      now: fixedDate,
      clipboard: 'Copied Content',
    });

    expect(result).toBe(
      'Date: 2026-05-15, Time: 14:30, DT: 2026-05-15 14:30, Year: 2026, Month: 05, Day: 15, Clip: Copied Content, Unknown: {{foo}}',
    );
  });

  it('handles empty template or missing context gracefully', () => {
    expect(expandSnippet('')).toBe('');
    const expanded = expandSnippet('Hello {{clipboard}}');
    expect(expanded).toBe('Hello ');
  });

  it('filters entries by text, title, or app', () => {
    const entries = [
      { id: '1', text: 'Important meeting notes', app: 'nexus.notes' },
      { id: '2', text: 'https://github.com', app: 'nexus.bookmarks' },
      { id: '3', title: 'Email Signature', text: 'Best regards', app: 'system' },
    ];

    expect(filterEntries(entries, '')).toHaveLength(3);
    expect(filterEntries(entries, 'notes')).toHaveLength(1);
    expect(filterEntries(entries, 'notes')[0].id).toBe('1');
    expect(filterEntries(entries, 'github')).toHaveLength(1);
    expect(filterEntries(entries, 'github')[0].id).toBe('2');
    expect(filterEntries(entries, 'signature')).toHaveLength(1);
    expect(filterEntries(entries, 'signature')[0].id).toBe('3');
    expect(filterEntries(entries, 'bookmarks')).toHaveLength(1);
    expect(filterEntries(entries, 'nonexistent')).toHaveLength(0);
  });

  it('formats clip preview with whitespace collapsing and truncation', () => {
    const raw = '  Line 1\nLine 2\t\tLine 3   ';
    expect(formatClipPreview(raw, 50)).toBe('Line 1 Line 2 Line 3');

    const longText = 'a'.repeat(150);
    const preview = formatClipPreview(longText, 50);
    expect(preview).toHaveLength(50);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('formats relative timestamps correctly', () => {
    const base = 1000000000000;
    expect(formatRelativeTime(base - 10000, base)).toBe('Just now');
    expect(formatRelativeTime(base - 120000, base)).toBe('2m ago');
    expect(formatRelativeTime(base - 7200000, base)).toBe('2h ago');
    expect(formatRelativeTime(base - 172800000, base)).toBe('2d ago');
  });
});

describe('Clipboard App — Terminal & Commands', () => {
  function makeMockContext() {
    let hist = [
      { id: 'c1', text: 'First item', app: 'nexus.notes', at: Date.now() },
      { id: 'c2', text: 'Second item', app: 'system', at: Date.now() - 5000 },
    ];
    const snippets = [
      { id: 's1', title: 'Greeting', body: 'Hello on {{date}}!', shortcut: ';hi', createdAt: Date.now() },
    ];

    return {
      clipboard: {
        history: vi.fn(() => [...hist]),
        writeText: vi.fn(async (text) => {
          hist.unshift({ id: `c${Date.now()}`, text, app: 'system', at: Date.now() });
        }),
        clearHistory: vi.fn(async () => {
          hist = [];
        }),
      },
      storage: {
        collection: (name) => {
          if (name === 'snippets') {
            return {
              all: async () => [...snippets],
              put: async (s) => snippets.push(s),
              delete: async (id) => {
                const idx = snippets.findIndex((s) => s.id === id);
                if (idx !== -1) snippets.splice(idx, 1);
              },
            };
          }
          return {
            all: async () => [],
            put: async () => {},
            delete: async () => {},
          };
        },
      },
      i18n: {
        t: (key, vars) => {
          if (key === 'terminal.empty') return 'Clipboard history is empty.';
          if (key === 'terminal.cleared') return 'Clipboard history cleared.';
          if (key === 'terminal.copied') return 'Copied clip to clipboard.';
          if (key === 'terminal.notFound') return 'Item not found.';
          if (key === 'terminal.snippetCopied') return `Expanded and copied snippet "${vars?.title}".`;
          return key;
        },
      },
    };
  }

  it('runs terminal list and clear commands', async () => {
    const ctx = makeMockContext();
    const out = [];
    const io = {
      args: ['list'],
      out: (str) => out.push(str),
      err: vi.fn(),
    };

    let code = await terminal.clipboard(ctx, io);
    expect(code).toBe(0);
    expect(out.join('')).toContain('First item');
    expect(out.join('')).toContain('Second item');

    // Clear
    const clearOut = [];
    code = await terminal.clipboard(ctx, { args: ['clear'], out: (s) => clearOut.push(s), err: vi.fn() });
    expect(code).toBe(0);
    expect(ctx.clipboard.clearHistory).toHaveBeenCalled();
  });

  it('runs terminal copy by index and snippet expansion', async () => {
    const ctx = makeMockContext();
    const out = [];
    const err = [];
    const io = {
      args: ['copy', '1'],
      out: (s) => out.push(s),
      err: (s) => err.push(s),
    };

    let code = await terminal.clipboard(ctx, io);
    expect(code).toBe(0);
    expect(ctx.clipboard.writeText).toHaveBeenCalledWith('First item');

    // Snippet command
    const snipOut = [];
    code = await terminal.clipboard(ctx, {
      args: ['snippet', 'Greeting'],
      out: (s) => snipOut.push(s),
      err: vi.fn(),
    });
    expect(code).toBe(0);
    expect(ctx.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Hello on '));
  });

  it('executes clipboard commands', async () => {
    const ctx = makeMockContext();
    await commands['clipboard.copyLatest'](ctx);
    expect(ctx.clipboard.writeText).toHaveBeenCalledWith('First item');

    await commands['clipboard.clear'](ctx);
    expect(ctx.clipboard.clearHistory).toHaveBeenCalled();
  });
});
