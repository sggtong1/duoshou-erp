import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { encrypt, decrypt } from './crypto';

describe('crypto', () => {
  const key = crypto.randomBytes(32).toString('base64');

  it('round-trips string values', () => {
    const pt = 'my_temu_access_token';
    const ct = encrypt(pt, key);
    expect(ct).toBeInstanceOf(Buffer);
    expect(ct.length).toBeGreaterThanOrEqual(28);
    expect(decrypt(ct, key)).toBe(pt);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const c1 = encrypt('same', key);
    const c2 = encrypt('same', key);
    expect(Buffer.compare(c1, c2)).not.toBe(0);
    expect(decrypt(c1, key)).toBe('same');
    expect(decrypt(c2, key)).toBe('same');
  });

  it('throws on tampered ciphertext', () => {
    const ct = Buffer.from(encrypt('x', key));
    ct[ct.length - 1] ^= 0xff; // flip a bit in the ct
    expect(() => decrypt(ct, key)).toThrow();
  });

  it('throws on wrong key', () => {
    const ct = encrypt('x', key);
    const otherKey = crypto.randomBytes(32).toString('base64');
    expect(() => decrypt(ct, otherKey)).toThrow();
  });

  it('rejects invalid key length', () => {
    const shortKey = Buffer.alloc(16).toString('base64');
    expect(() => encrypt('x', shortKey)).toThrow(/32 bytes/);
  });
});
