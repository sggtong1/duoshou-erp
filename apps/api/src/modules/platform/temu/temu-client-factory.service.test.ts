import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { TemuClientFactoryService } from './temu-client-factory.service';
import { encrypt } from '../../../infra/crypto';

describe('TemuClientFactoryService', () => {
  let prisma: any;
  const key = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    process.env.CREDS_ENCRYPTION_KEY = key;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const credsRow = {
      id: 'creds-1',
      appKeyEncrypted: encrypt('ak_1', key),
      appSecretEncrypted: encrypt('as_1', key),
      accessTokenEncrypted: encrypt('tok_1', key),
    };
    prisma = {
      shop: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'shop-1',
          orgId: 'org-1',
          platform: 'temu',
          platformShopId: '1052202882',
          region: 'cn',
          shopType: 'full',
          credsVaultRef: 'creds-1',
          creds: credsRow,
        }),
      },
    };
  });

  it('builds a TemuClient with decrypted credentials for a shop', async () => {
    const svc = new TemuClientFactoryService(prisma as any);
    const client = await svc.forShop('shop-1');
    expect(client.ctx.appKey).toBe('ak_1');
    expect(client.ctx.appSecret).toBe('as_1');
    expect(client.ctx.accessToken).toBe('tok_1');
    expect(client.ctx.region).toBe('cn');
    expect(client.ctx.shopId).toBe('1052202882');
  });

  it('throws when shop row does not exist', async () => {
    prisma.shop.findUniqueOrThrow.mockRejectedValueOnce(new Error('No Shop found'));
    const svc = new TemuClientFactoryService(prisma as any);
    await expect(svc.forShop('missing')).rejects.toThrow();
  });
});
