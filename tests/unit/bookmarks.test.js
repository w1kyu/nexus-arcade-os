import { describe, expect, it } from 'vitest';
import {
  exportNetscapeBookmarksHtml,
  getLetterAvatar,
  parseNetscapeBookmarksHtml,
} from '../../src/apps/bookmarks/model.js';

describe('Bookmarks Model', () => {
  it('generates consistent letter avatar and hue from URL domain', () => {
    const av1 = getLetterAvatar('https://github.com/torvalds');
    expect(av1.char).toBe('G');
    expect(av1.color).toContain('hsl(');

    const av2 = getLetterAvatar('https://github.com/different');
    // Same domain should produce same hue
    expect(av2.color).toBe(av1.color);

    const avFallback = getLetterAvatar('', 'My Notes');
    expect(avFallback.char).toBe('M');
  });

  it('exports and parses Netscape Bookmarks HTML format', () => {
    /** @type {import('../../src/apps/bookmarks/model.js').BookmarkItem[]} */
    const bookmarks = [
      {
        id: '1',
        title: 'Nexus OS',
        url: 'https://nexus.local',
        collection: 'Dev',
        tags: ['os', 'web'],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ];

    const html = exportNetscapeBookmarksHtml(bookmarks);
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('<A HREF="https://nexus.local"');
    expect(html).toContain('Nexus OS</A>');

    const parsed = parseNetscapeBookmarksHtml(html);
    expect(parsed.length).toBe(1);
    expect(parsed[0].url).toBe('https://nexus.local');
    expect(parsed[0].title).toBe('Nexus OS');
  });
});
