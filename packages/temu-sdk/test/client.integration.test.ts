import { describe, it, expect } from 'vitest';
import Redis from 'ioredis';
import { TemuClient, methods } from '../src';

const RUN = !!process.env.TEMU_TEST_APP_KEY;

describe.skipIf(!RUN)('TemuClient integration (requires TEMU_TEST_* env)', () => {
  it('calls bg.mall.info.get via TemuClient.call', async () => {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const client = new TemuClient({
      appKey: process.env.TEMU_TEST_APP_KEY!,
      appSecret: process.env.TEMU_TEST_APP_SECRET!,
      accessToken: process.env.TEMU_TEST_ACCESS_TOKEN!,
      region: (process.env.TEMU_TEST_REGION as 'cn' | 'pa') ?? 'cn',
      shopId: process.env.TEMU_TEST_SHOP_ID!,
    }, { redis });
    const res: any = await client.call('bg.mall.info.get', {});
    expect(res).toBeDefined();
    await redis.quit();
  });

  it('calls generated method directly', async () => {
    const ctx = {
      appKey: process.env.TEMU_TEST_APP_KEY!,
      appSecret: process.env.TEMU_TEST_APP_SECRET!,
      accessToken: process.env.TEMU_TEST_ACCESS_TOKEN!,
      region: (process.env.TEMU_TEST_REGION as 'cn' | 'pa') ?? 'cn',
      shopId: process.env.TEMU_TEST_SHOP_ID!,
    };
    const res = await (methods as any).bgMallInfoGet(ctx, {});
    expect(res).toBeDefined();
  });
});
