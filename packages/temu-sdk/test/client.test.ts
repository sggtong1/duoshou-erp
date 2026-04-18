import { describe, it, expect, vi, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { TemuClient } from '../src/client';

describe('TemuClient', () => {
  let redis: any;
  beforeEach(async () => {
    redis = new RedisMock();
    // Warm up ioredis-mock Lua VM (fengari takes ~200ms on first eval).
    // Without this, rate-limiter timing assertions become flaky.
    const { createRateLimiter } = await import('../src/rate-limiter');
    const warmup = createRateLimiter(redis, { qps: 100, burst: 100 });
    await warmup.acquire('__warmup__', 1);
    // Additional warmups to ensure Lua VM is fully hot
    await warmup.acquire('__warmup2__', 1);
    await warmup.acquire('__warmup3__', 1);
  });

  const baseCtx = {
    appKey: 'k', appSecret: 's', accessToken: 't',
    region: 'cn' as const, shopId: '42',
  };

  it('throws on unknown interface type', async () => {
    const client = new TemuClient(baseCtx, { redis });
    await expect(client.call('bg.fake.method', {})).rejects.toThrow(/Unknown Temu interface/);
  });

  it('rate-limits per shop across multiple calls', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true, result: {} })) as any),
    );
    const client = new TemuClient(baseCtx, { redis, qps: 10, burst: 2 });
    // Burst 2 should be fast, 3rd waits ~100ms for refill
    const t1 = Date.now();
    await client.call('bg.mall.info.get', {});
    const t2 = Date.now();
    await client.call('bg.mall.info.get', {});
    const t3 = Date.now();
    const t4 = Date.now();
    await client.call('bg.mall.info.get', {});
    const t5 = Date.now();
    // First two calls should be fast (within ~150ms each, accounting for warmup variance)
    expect(t2 - t1).toBeLessThan(150);
    expect(t3 - t2).toBeLessThan(150);
    // Third call should be slower (50-300ms range for ~100ms wait)
    const thirdWait = t5 - t4;
    expect(thirdWait).toBeGreaterThanOrEqual(50);
    expect(thirdWait).toBeLessThan(300);
  }, 10000);

  it('isolates limits per shopId', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true, result: {} })) as any),
    );
    const clientA = new TemuClient({ ...baseCtx, shopId: 'A' }, { redis, qps: 1, burst: 1 });
    const clientB = new TemuClient({ ...baseCtx, shopId: 'B' }, { redis, qps: 1, burst: 1 });
    await clientA.call('bg.mall.info.get', {});
    const t0 = Date.now();
    await clientB.call('bg.mall.info.get', {});
    expect(Date.now() - t0).toBeLessThan(100);
  }, 10000);
});
