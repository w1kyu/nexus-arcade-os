import { describe, expect, it } from 'vitest';
import { computeMoodStats, countWords, findOnThisDay } from '../../src/apps/journal/model.js';
import { decryptText, encrypt, hashSecret, verifySecret } from '../../src/services/crypto.js';

describe('Journal Model & Crypto', () => {
  it('counts words accurately', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('Hello world!')).toBe(2);
    expect(countWords('Today was a great day with lots of learning and studying.')).toBe(11);
  });

  it('finds on-this-day entries across previous years', () => {
    const today = new Date('2026-11-10T12:00:00');
    /** @type {import('../../src/apps/journal/model.js').JournalEntry[]} */
    const entries = [
      { id: '1', date: '2026-11-10', title: 'Today', content: 'C', mood: 4, createdAt: 1, updatedAt: 1 },
      { id: '2', date: '2025-11-10', title: '1 Year Ago', content: 'C', mood: 5, createdAt: 1, updatedAt: 1 },
      { id: '3', date: '2024-11-10', title: '2 Years Ago', content: 'C', mood: 3, createdAt: 1, updatedAt: 1 },
      { id: '4', date: '2025-11-09', title: 'Yesterday 2025', content: 'C', mood: 4, createdAt: 1, updatedAt: 1 },
    ];

    const onThisDay = findOnThisDay(entries, today);
    expect(onThisDay.length).toBe(2);
    expect(onThisDay[0].date).toBe('2025-11-10');
    expect(onThisDay[1].date).toBe('2024-11-10');
  });

  it('computes mood statistics and 30-day timeline', () => {
    const now = new Date('2026-11-10T12:00:00');
    /** @type {import('../../src/apps/journal/model.js').JournalEntry[]} */
    const entries = [
      { id: '1', date: '2026-11-10', title: 'Today', content: 'C', mood: 5, createdAt: 1, updatedAt: 1 },
      { id: '2', date: '2026-11-09', title: 'Yesterday', content: 'C', mood: 3, createdAt: 1, updatedAt: 1 },
    ];

    const stats = computeMoodStats(entries, now);
    expect(stats.totalEntries).toBe(2);
    expect(stats.averageMood).toBe(4);
    expect(stats.moodCounts[5]).toBe(1);
    expect(stats.moodCounts[3]).toBe(1);
    expect(stats.recentTimeline.length).toBe(30);
  });

  it('encrypts and decrypts journal entries with AES-GCM password', async () => {
    const password = 'SuperSecretJournalPassword123!';
    const rawContent = '# Dear Diary\nToday I aced my Operating Systems exam!';

    // Hash secret for vault / lock verification
    const passHash = await hashSecret(password, { iterations: 1000 });
    const isValid = await verifySecret(password, passHash);
    expect(isValid).toBe(true);

    const isWrong = await verifySecret('WrongPass', passHash);
    expect(isWrong).toBe(false);

    // Encrypt entry
    const encrypted = await encrypt(rawContent, password, { iterations: 1000 });
    expect(encrypted.cipher).toBe('AES-GCM-256');
    expect(encrypted.data).not.toContain('Operating Systems');

    // Decrypt entry
    const decrypted = await decryptText(encrypted, password);
    expect(decrypted).toBe(rawContent);
  });
});
