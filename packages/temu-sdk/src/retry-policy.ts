const RETRYABLE_ERROR_CODES = new Set<number>([7000010]);

export function isRetryableError(err: unknown, errorCode?: number): boolean {
  if (errorCode !== undefined) return RETRYABLE_ERROR_CODES.has(errorCode);
  if (err instanceof Error) {
    return /ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|fetch failed|ENOTFOUND|5\d{2}/.test(err.message);
  }
  return false;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 300;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const errorCode = (err as any)?.errorCode;
      if (!isRetryableError(err, errorCode) || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}
