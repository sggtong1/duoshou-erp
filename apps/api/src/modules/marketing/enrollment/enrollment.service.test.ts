import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentService.submit', () => {
  let prisma: any, clientFactory: any, mockClientByShop: Record<string, any>;
  beforeEach(() => {
    mockClientByShop = {
      'shop-1': { call: vi.fn().mockResolvedValue({ success: true, enrollId: 'e1' }) },
      'shop-2': { call: vi.fn().mockRejectedValue(new Error('Temu 403 forbidden')) },
    };
    clientFactory = { forShop: vi.fn(async (shopId: string) => mockClientByShop[shopId]) };
    prisma = {
      activity: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'a1', orgId: 'org-1', platformActivityId: '1001', region: 'pa', status: 'open',
          enrollEndAt: new Date(Date.now() + 3600_000),
          shopVisibility: [
            { shopId: 'shop-1', shopName: 'A' },
            { shopId: 'shop-2', shopName: 'B' },
          ],
        }),
      },
      activitySession: { findFirst: vi.fn() },
      activityEnrollment: {
        create: vi.fn(async ({ data }: any) => ({ id: `en-${data.shopId}-${data.platformSkuId}`, ...data })),
        update: vi.fn(async ({ data }: any) => data),
      },
    };
  });

  it('按 shop 分组一次调用 per-shop Temu API,per-item 独立结果', async () => {
    const svc = new EnrollmentService(prisma, clientFactory);
    const out = await svc.submit('org-1', {
      activityId: 'a1',
      items: [
        { shopId: 'shop-1', platformSkuId: 'sku-1', activityPriceCents: 1000 },
        { shopId: 'shop-1', platformSkuId: 'sku-2', activityPriceCents: 2000 },
        { shopId: 'shop-2', platformSkuId: 'sku-3', activityPriceCents: 3000 },
      ],
    });
    expect(mockClientByShop['shop-1'].call).toHaveBeenCalledTimes(1);
    expect(mockClientByShop['shop-2'].call).toHaveBeenCalledTimes(1);
    expect(out.total).toBe(3);
    const ok = out.results.filter((r: any) => r.ok);
    const bad = out.results.filter((r: any) => !r.ok);
    expect(ok).toHaveLength(2);
    expect(bad).toHaveLength(1);
    expect(bad[0].error).toMatch(/Temu 403/);
  });

  it('活动不存在抛 NotFound', async () => {
    prisma.activity.findFirst = vi.fn().mockResolvedValue(null);
    const svc = new EnrollmentService(prisma, clientFactory);
    await expect(svc.submit('org-1', {
      activityId: 'a1',
      items: [{ shopId: 'shop-1', platformSkuId: 'x', activityPriceCents: 100 }],
    })).rejects.toThrow();
  });

  it('活动已 closed 抛错', async () => {
    prisma.activity.findFirst = vi.fn().mockResolvedValue({
      id: 'a1', orgId: 'org-1', region: 'pa', status: 'closed', enrollEndAt: new Date(Date.now() - 1000),
      shopVisibility: [{ shopId: 'shop-1' }],
    });
    const svc = new EnrollmentService(prisma, clientFactory);
    await expect(svc.submit('org-1', {
      activityId: 'a1',
      items: [{ shopId: 'shop-1', platformSkuId: 'x', activityPriceCents: 100 }],
    })).rejects.toThrow(/closed|ended/i);
  });
});

describe('EnrollmentService.list', () => {
  it('按 orgId 隔离 + BigInt→Number 序列化', async () => {
    const prisma: any = {
      activityEnrollment: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          { id: 'en-1', orgId: 'org-1', shopId: 's1', activityPriceCents: 999n, status: 'pending' },
        ]),
      },
    };
    const svc = new EnrollmentService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    expect(prisma.activityEnrollment.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
    expect(typeof r.items[0].activityPriceCents).toBe('number');
  });
});
