// @ts-check

/**
 * Expands template variables in a snippet string.
 * Supported variables:
 * - {{date}}: YYYY-MM-DD
 * - {{time}}: HH:MM (24-hour)
 * - {{datetime}}: YYYY-MM-DD HH:MM
 * - {{year}}: YYYY
 * - {{month}}: MM (01-12)
 * - {{day}}: DD (01-31)
 * - {{clipboard}}: current clipboard contents passed via context
 *
 * @param {string} template
 * @param {object} [context]
 * @param {string} [context.clipboard]
 * @param {Date} [context.now]
 * @returns {string}
 */
export function expandSnippet(template, context = {}) {
  if (!template) return '';
  const dateObj = context.now instanceof Date ? context.now : new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const year = String(dateObj.getFullYear());
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;
  const datetimeStr = `${dateStr} ${timeStr}`;
  const clipStr = context.clipboard ?? '';

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    switch (key.toLowerCase()) {
      case 'date':
        return dateStr;
      case 'time':
        return timeStr;
      case 'datetime':
        return datetimeStr;
      case 'year':
        return year;
      case 'month':
        return month;
      case 'day':
        return day;
      case 'clipboard':
        return clipStr;
      default:
        return match;
    }
  });
}

/**
 * Filter clips or snippets by search query.
 * @template {{ text?: string, title?: string, app?: string }} T
 * @param {T[]} items
 * @param {string} query
 * @returns {T[]}
 */
export function filterEntries(items, query) {
  if (!query || !query.trim()) return items;
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (item.text && item.text.toLowerCase().includes(q)) return true;
    if (item.title && item.title.toLowerCase().includes(q)) return true;
    if (item.app && item.app.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Shorten a clip's text for preview.
 * @param {string} [text]
 * @param {number} [maxLen]
 * @returns {string}
 */
export function formatClipPreview(text = '', maxLen = 120) {
  if (!text) return '';
  const singleLine = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 1) + '…';
}

/**
 * Format timestamp relative to now or as short time.
 * @param {number} timestamp
 * @param {number} [currentNow]
 * @returns {string}
 */
export function formatRelativeTime(timestamp, currentNow = Date.now()) {
  if (!timestamp) return '';
  const diffSec = Math.max(0, Math.floor((currentNow - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
