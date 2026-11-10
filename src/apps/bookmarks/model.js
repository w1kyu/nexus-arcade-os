// @ts-check
// Bookmarks model: letter-avatar fallback, reading list state, and Netscape HTML import/export.

/**
 * @typedef {object} BookmarkItem
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} [collection]
 * @property {string[]} [tags]
 * @property {string} [notes]
 * @property {boolean} [isReadingList]
 * @property {boolean} [isRead]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * Derives a letter avatar and consistent color for a URL/title without network fetch.
 * @param {string} url
 * @param {string} [title]
 * @returns {{ char: string, color: string }}
 */
export function getLetterAvatar(url, title = '') {
  let domain;
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0] || title;
  }

  const char = (domain[0] || title[0] || 'B').toUpperCase();

  // Consistent hue from domain string
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const color = `hsl(${hue}, 65%, 45%)`;

  return { char, color };
}

/**
 * Exports bookmarks as standard Netscape Bookmark HTML.
 * @param {BookmarkItem[]} bookmarks
 * @returns {string}
 */
export function exportNetscapeBookmarksHtml(bookmarks) {
  const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;
  const items = bookmarks.map(
    (b) =>
      `    <DT><A HREF="${b.url}" ADD_DATE="${Math.floor(b.createdAt / 1000)}" TAGS="${(b.tags || []).join(',')}">${(b.title || b.url).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</A>`,
  );

  return header + items.join('\n') + '\n</DL><p>\n';
}

/**
 * Parses standard Netscape Bookmark HTML.
 * @param {string} html
 * @returns {BookmarkItem[]}
 */
export function parseNetscapeBookmarksHtml(html) {
  const results = [];
  const regex = /<A\s+HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim() || url;
    results.push({
      id: crypto.randomUUID(),
      title,
      url,
      collection: 'Imported',
      tags: [],
      isReadingList: false,
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return results;
}
