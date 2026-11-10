import { describe, expect, it } from 'vitest';
import { base32Decode, generateTotp, getTotpRemainingSeconds } from '../../src/apps/vault/totp.js';

describe('RFC 6238 TOTP Authenticator', () => {
  // RFC 6238 Appendix B: Secret is "12345678901234567890" (20 bytes ASCII)
  // Base32 encoding of "12345678901234567890": GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
  const rfcSecretBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('correctly decodes Base32 secret', () => {
    const bytes = base32Decode(rfcSecretBase32);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('12345678901234567890');
  });

  it('matches RFC 6238 Appendix B test vectors (8-digit and 6-digit SHA-1)', async () => {
    // RFC 6238 Test Vector 1: Time = 59s
    const t1 = await generateTotp(rfcSecretBase32, 59, 30, 8, 'SHA-1');
    expect(t1).toBe('94287082');

    const t1_6 = await generateTotp(rfcSecretBase32, 59, 30, 6, 'SHA-1');
    expect(t1_6).toBe('287082');

    // RFC 6238 Test Vector 2: Time = 1111111109s
    const t2 = await generateTotp(rfcSecretBase32, 1111111109, 30, 8, 'SHA-1');
    expect(t2).toBe('07081804');

    const t2_6 = await generateTotp(rfcSecretBase32, 1111111109, 30, 6, 'SHA-1');
    expect(t2_6).toBe('081804');

    // RFC 6238 Test Vector 3: Time = 1111111111s
    const t3 = await generateTotp(rfcSecretBase32, 1111111111, 30, 8, 'SHA-1');
    expect(t3).toBe('14050471');

    // RFC 6238 Test Vector 4: Time = 1234567890s
    const t4 = await generateTotp(rfcSecretBase32, 1234567890, 30, 8, 'SHA-1');
    expect(t4).toBe('89005924');

    const t4_6 = await generateTotp(rfcSecretBase32, 1234567890, 30, 6, 'SHA-1');
    expect(t4_6).toBe('005924');

    // RFC 6238 Test Vector 5: Time = 2000000000s
    const t5 = await generateTotp(rfcSecretBase32, 2000000000, 30, 8, 'SHA-1');
    expect(t5).toBe('69279037');
  });

  it('computes remaining seconds accurately', () => {
    expect(getTotpRemainingSeconds(100, 30)).toBe(20); // 100 % 30 = 10 -> 30 - 10 = 20
    expect(getTotpRemainingSeconds(120, 30)).toBe(30); // 120 % 30 = 0 -> 30 - 0 = 30
    expect(getTotpRemainingSeconds(125, 30)).toBe(25); // 125 % 30 = 5 -> 30 - 5 = 25
  });
});
