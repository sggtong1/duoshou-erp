export const SDK_VERSION = '0.1.0';

export { sign } from './signing';
export { callTemuApi, TemuApiError, type TemuCallContext, type TemuMethodSpec } from './http-client';
export { withRetry, isRetryableError, type RetryOptions } from './retry-policy';
export { createRateLimiter, type RateLimiter, type RateLimiterConfig } from './rate-limiter';
export { TemuClient, type TemuClientOptions } from './client';

// Generated artifacts — re-exported when codegen has been run.
// These are star-exports; if generated/ is absent, these will fail at runtime
// but we keep them here so consumers can do `import { bgMallInfoGet } from '@duoshou/temu-sdk'`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated at build time
export * as methods from './generated/methods';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated at build time
export type * from './generated/types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated at build time
export { TEMU_API_REGISTRY } from './generated/methods';
