import { describe, it, expect, vi, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { TemuClient } from '../src/client';

describe('TemuClient', () => {
  let redis: any;
  beforeEach(() => { redis = new RedisMock(); });

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
    await client.call('bg.mall.info.get', {});
    await client.call('bg.mall.info.get', {});
    const t0 = Date.now();
    await client.call('bg.mall.info.get', {});
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
  }, 5000);

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
  });
});
