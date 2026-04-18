import { describe, it, expect } from 'vitest';
import { isRetryableError, withRetry } from '../src/retry-policy';

describe('isRetryableError', () => {
  it('retries network errors', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
  });

  it('retries 7000010 timestamp expired', () => {
    expect(isRetryableError(new Error('whatever'), 7000010)).toBe(true);
  });

  it('does not retry auth/permission errors', () => {
    expect(isRetryableError(new Error('x'), 7000005)).toBe(false);
    expect(isRetryableError(new Error('x'), 7000007)).toBe(false);
    expect(isRetryableError(new Error('x'), 7000020)).toBe(false);
  });

  it('does not retry client bugs (invalid sign, bad type)', () => {
    expect(isRetryableError(new Error('x'), 7000015)).toBe(false);
    expect(isRetryableError(new Error('x'), 7000016)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns on first success', async () => {
    let n = 0;
    const r = await withRetry(async () => { n++; return 'ok'; }, { maxAttempts: 3, baseDelayMs: 1 });
    expect(r).toBe('ok');
    expect(n).toBe(1);
  });

  it('retries up to maxAttempts on retryable error', async () => {
    let n = 0;
    const r = await withRetry(async () => {
      n++;
      if (n < 3) throw new Error('ECONNRESET');
      return 'ok';
    }, { maxAttempts: 3, baseDelayMs: 1 });
    expect(r).toBe('ok');
    expect(n).toBe(3);
  });

  it('throws immediately on non-retryable error', async () => {
    let n = 0;
    await expect(withRetry(async () => {
      n++;
      const e = new Error('x');
      (e as any).errorCode = 7000005;
      throw e;
    }, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow();
    expect(n).toBe(1);
  });

  it('throws after maxAttempts', async () => {
    let n = 0;
    await expect(withRetry(async () => {
      n++;
      throw new Error('ECONNRESET');
    }, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow();
    expect(n).toBe(3);
  });
});
