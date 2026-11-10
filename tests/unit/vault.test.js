import { describe, expect, it } from 'vitest';
import { estimateEntropy, generatePassphrase, generatePassword } from '../../src/apps/vault/generator.js';
import { auditVaultHealth, exportVaultCsv, parseVaultCsv } from '../../src/apps/vault/model.js';

describe('Vault Generator & Model', () => {
  it('generates passwords of configurable length and estimates entropy', () => {
    const p16 = generatePassword({ length: 16 });
    expect(p16.length).toBe(16);
    expect(estimateEntropy(p16)).toBeGreaterThanOrEqual(50);

    const p32 = generatePassword({ length: 32 });
    expect(p32.length).toBe(32);
    expect(estimateEntropy(p32)).toBeGreaterThan(100);
  });

  it('generates English and German passphrases', () => {
    const enPass = generatePassphrase(4, 'en', '-');
    const enWords = enPass.split('-');
    expect(enWords.length).toBe(4);

    const dePass = generatePassphrase(4, 'de', '-');
    const deWords = dePass.split('-');
    expect(deWords.length).toBe(4);
  });

  it('audits vault health for weak, reused, and old credentials', () => {
    const now = new Date('2026-11-10T12:00:00');
    const ms200DaysAgo = now.getTime() - 200 * 24 * 60 * 60 * 1000;

    /** @type {import('../../src/apps/vault/model.js').VaultEntry[]} */
    const entries = [
      { id: '1', title: 'Service A', password: 'pass1', createdAt: now.getTime(), updatedAt: now.getTime() }, // weak & reused
      { id: '2', title: 'Service B', password: 'pass1', createdAt: now.getTime(), updatedAt: now.getTime() }, // weak & reused
      {
        id: '3',
        title: 'Service C',
        password: 'VeryStrongPassword!987654#',
        createdAt: ms200DaysAgo,
        updatedAt: ms200DaysAgo,
      }, // old (> 180d)
      {
        id: '4',
        title: 'Service D',
        password: 'AnotherSuperStrongPassword!123$',
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      }, // clean
    ];

    const audit = auditVaultHealth(entries, now);
    expect(audit.total).toBe(4);
    expect(audit.weakCount).toBe(2);
    expect(audit.reusedCount).toBe(2);
    expect(audit.oldCount).toBe(1);
    expect(audit.score).toBeLessThanOrEqual(85);
  });

  it('exports to CSV and imports back', () => {
    /** @type {import('../../src/apps/vault/model.js').VaultEntry[]} */
    const entries = [
      {
        id: '1',
        title: 'GitHub',
        username: 'w1kyu',
        password: 'SecretPassword123!',
        url: 'https://github.com',
        notes: 'Personal',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const csv = exportVaultCsv(entries);
    expect(csv).toContain('GitHub');
    expect(csv).toContain('SecretPassword123!');

    const imported = parseVaultCsv(csv);
    expect(imported.length).toBe(1);
    expect(imported[0].title).toBe('GitHub');
    expect(imported[0].password).toBe('SecretPassword123!');
    expect(imported[0].totpSecret).toBe('JBSWY3DPEHPK3PXP');
  });
});
