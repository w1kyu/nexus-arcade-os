// @ts-check
// Vault model: encrypted credentials, local password health audit, and CSV import/export.
import { estimateEntropy } from './generator.js';

/**
 * @typedef {object} VaultEntry
 * @property {string} id
 * @property {string} title
 * @property {string} [username]
 * @property {string} password           plaintext when unlocked, empty string when saved on disk
 * @property {string} [url]
 * @property {string} [notes]
 * @property {string} [totpSecret]
 * @property {string} [category]         e.g. 'Logins', 'Credit Cards', 'Secure Notes'
 * @property {boolean} [isEncrypted]
 * @property {import('../../services/crypto.js').EncryptedPayload} [encryptedPayload]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * Performs local password health audit:
 * checks for reused, weak, and old passwords without sending data anywhere.
 * @param {VaultEntry[]} entries
 * @param {Date} [now]
 * @returns {{
 *   total: number,
 *   weakCount: number,
 *   reusedCount: number,
 *   oldCount: number,
 *   score: number, // 0 - 100
 *   issues: Array<{ entryId: string, title: string, reason: 'weak' | 'reused' | 'old' }>
 * }}
 */
export function auditVaultHealth(entries, now = new Date()) {
  const total = entries.length;
  if (total === 0) {
    return { total: 0, weakCount: 0, reusedCount: 0, oldCount: 0, score: 100, issues: [] };
  }

  /** @type {Record<string, number>} */
  const passwordOccurrences = {};
  for (const e of entries) {
    if (e.password) {
      passwordOccurrences[e.password] = (passwordOccurrences[e.password] || 0) + 1;
    }
  }

  const issues = [];
  let weakCount = 0;
  let reusedCount = 0;
  let oldCount = 0;

  const nowMs = now.getTime();
  const ms180Days = 180 * 24 * 60 * 60 * 1000;

  for (const e of entries) {
    // Weak check
    const entropy = estimateEntropy(e.password || '');
    if (entropy < 45 || (e.password && e.password.length < 10)) {
      weakCount++;
      issues.push({ entryId: e.id, title: e.title, reason: 'weak' });
    }

    // Reused check
    if (e.password && passwordOccurrences[e.password] > 1) {
      reusedCount++;
      issues.push({ entryId: e.id, title: e.title, reason: 'reused' });
    }

    // Old check (> 180 days)
    if (nowMs - (e.updatedAt || e.createdAt) > ms180Days) {
      oldCount++;
      issues.push({ entryId: e.id, title: e.title, reason: 'old' });
    }
  }

  const penalty = weakCount * 15 + reusedCount * 20 + oldCount * 5;
  const score = Math.max(0, Math.min(100, 100 - Math.round(penalty / total)));

  return { total, weakCount, reusedCount, oldCount, score, issues };
}

/**
 * Exports vault entries to CSV.
 * @param {VaultEntry[]} entries
 * @returns {string}
 */
export function exportVaultCsv(entries) {
  const header = 'title,username,password,url,notes,totpSecret\n';
  const rows = entries.map(
    (e) =>
      `"${(e.title || '').replace(/"/g, '""')}","${(e.username || '').replace(/"/g, '""')}","${(e.password || '').replace(/"/g, '""')}","${(e.url || '').replace(/"/g, '""')}","${(e.notes || '').replace(/"/g, '""')}","${(e.totpSecret || '').replace(/"/g, '""')}"`,
  );
  return header + rows.join('\n');
}

/**
 * Parses vault CSV entries.
 * @param {string} csvText
 * @returns {VaultEntry[]}
 */
export function parseVaultCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < 3) continue;

    results.push({
      id: crypto.randomUUID(),
      title: cols[0] || 'Imported Entry',
      username: cols[1] || '',
      password: cols[2] || '',
      url: cols[3] || '',
      notes: cols[4] || '',
      totpSecret: cols[5] || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return results;
}
