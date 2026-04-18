import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { createRateLimiter, type RateLimiter } from '../src/rate-limiter';

describe('rate-limiter', () => {
  let redis: any;
  beforeEach(async () => {
    redis = new RedisMock();
    // Warm up the Lua runtime in ioredis-mock — first eval call takes ~200ms
    // due to fengari/Lua interpreter initialization; subsequent calls are <20ms.
    const limiter = createRateLimiter(redis, { qps: 100, burst: 100 });
    await limiter.acquire('__warmup__', 1);
  });
  afterEach(async () => { await redis.quit(); });

  it('acquires immediately when bucket has tokens', async () => {
    const limiter = createRateLimiter(redis, { qps: 5, burst: 5 });
    const t0 = Date.now();
    await limiter.acquire('shop:1', 1);
    expect(Date.now() - t0).toBeLessThan(100);
  });

  it('allows consuming multiple tokens at once within burst', async () => {
    const limiter = createRateLimiter(redis, { qps: 5, burst: 5 });
    const t0 = Date.now();
    await limiter.acquire('shop:2', 5);
    expect(Date.now() - t0).toBeLessThan(100);
  });

  it('queues when tokens exhausted', async () => {
    const limiter = createRateLimiter(redis, { qps: 3, burst: 3 });
    // Burn through the burst
    await limiter.acquire('shop:3', 1);
    await limiter.acquire('shop:3', 1);
    await limiter.acquire('shop:3', 1);
    // Now bucket is empty; next should wait ~333ms
    const t0 = Date.now();
    await limiter.acquire('shop:3', 1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeLessThan(600);
  }, 3000);

  it('isolates buckets per key', async () => {
    const limiter = createRateLimiter(redis, { qps: 1, burst: 1 });
    await limiter.acquire('shop:A', 1);
    const t0 = Date.now();
    await limiter.acquire('shop:B', 1);
    expect(Date.now() - t0).toBeLessThan(100);
  });

  it('refills over time', async () => {
    const limiter = createRateLimiter(redis, { qps: 10, burst: 2 });
    await limiter.acquire('shop:4', 2);  // empty the bucket
    await new Promise(r => setTimeout(r, 300));  // wait 300ms → refill ~3 tokens but cap at 2
    const t0 = Date.now();
    await limiter.acquire('shop:4', 2);  // should succeed immediately
    expect(Date.now() - t0).toBeLessThan(100);
  });
});
