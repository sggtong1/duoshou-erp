import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopService } from './shop.service';

vi.mock('@duoshou/temu-sdk', () => ({
  methods: {
    bgMallInfoGet: vi.fn(),
  },
  TemuClient: class {},
}));

describe('ShopService.connect', () => {
  let prisma: any;
  beforeEach(() => {
    process.env.CREDS_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
    prisma = {
      shopCredentials: { create: vi.fn().mockResolvedValue({ id: 'creds-1' }), delete: vi.fn() },
      shop: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'shop-1', ...data })),
        update: vi.fn(),
      },
    };
  });

  it('creates new shop after credential validation', async () => {
    const { methods } = await import('@duoshou/temu-sdk');
    (methods.bgMallInfoGet as any).mockResolvedValue({ mallId: '1052202882', mallType: 'FULL_MANAGEMENT' });

    const svc = new ShopService(prisma);
    const shop = await svc.connect('org-1', {
      appKey: '47bb4bb7769e12d9f7aa93cf029fe529',
      appSecret: 'ac0a3e952eaaa5b19c0e615c2ef497f50afa6e49',
      accessToken: 'iimd5vhtzapi0rbu9ixzijjgr6k4cvflyf5zezgjcsda0gjb3fseadlu',
      shopType: 'full',
      region: 'cn',
      displayName: 'girl clothes',
    });

    expect(shop.platformShopId).toBe('1052202882');
    expect(prisma.shopCredentials.create).toHaveBeenCalled();
    // Ensure encrypted blobs are Buffers (not plaintext)
    const credsCall = prisma.shopCredentials.create.mock.calls[0][0].data;
    expect(credsCall.appKeyEncrypted).toBeInstanceOf(Buffer);
    expect(credsCall.appSecretEncrypted).toBeInstanceOf(Buffer);
    expect(credsCall.accessTokenEncrypted).toBeInstanceOf(Buffer);
    // NOT the plaintext
    expect(credsCall.appKeyEncrypted.toString()).not.toBe('47bb4bb7769e12d9f7aa93cf029fe529');
  });

  it('throws BadRequestException on bad credentials', async () => {
    const { methods } = await import('@duoshou/temu-sdk');
    (methods.bgMallInfoGet as any).mockRejectedValue(new Error('Temu API 7000007: token expired'));

    const svc = new ShopService(prisma);
    // Note: calling service directly, bypassing DTO validation
    await expect(svc.connect('org-1', {
      appKey: 'bad_key_padded_here',
      appSecret: 'bad_secret_padded_x',
      accessToken: 'expired_token_padded',
      shopType: 'full',
      region: 'cn',
    })).rejects.toThrow(/Temu credential validation failed/);
  });
});
