import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService.summary', () => {
  let prisma: any;

  function snap(ov: any = {}) {
    return {
      id: 'id', orgId: 'org-1', shopId: 's1',
      platformSkuId: 'sku-1', productName: 'P', className: 'V', skuExtCode: null,
      todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0, totalSaleVolume: 0,
      warehouseQty: 100, waitReceiveQty: 0, waitOnShelfQty: 0, waitDeliveryQty: 0,
      avgDailySales: 0, daysRemaining: null, supplierPriceCents: null,
      lastSyncedAt: new Date('2026-04-21T10:00:00Z'),
      shop: { id: 's1', displayName: 'Shop A', platformShopId: '1001' },
      ...ov,
    };
  }

  beforeEach(() => {
    prisma = {
      shopSkuSnapshot: {
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      orgSettings: {
        findUnique: vi.fn().mockResolvedValue({
          orgId: 'org-1', lowStockThreshold: 10, lowStockDaysThreshold: 7,
        }),
      },
      priceReview: {
        count: vi.fn().mockResolvedValue(3),
      },
    };
  });

  it('KPI 汇总:sum today/7d/30d volume, count lowStock, pendingPriceReviews', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 42, sales7dVolume: 300, sales30dVolume: 1200 },
      _max: { lastSyncedAt: new Date('2026-04-21T10:00:00Z') },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(5);
    prisma.shopSkuSnapshot.findMany = vi.fn().mockResolvedValue([]);

    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', {});
    expect(r.kpis.todayVolume).toBe(42);
    expect(r.kpis.sales7dVolume).toBe(300);
    expect(r.kpis.sales30dVolume).toBe(1200);
    expect(r.kpis.lowStockCount).toBe(5);
    expect(r.pendingPriceReviews).toBe(3);
    expect(r.dataFreshness).toBe('2026-04-21T10:00:00.000Z');
  });

  it('lowStockCount 使用 OrgSettings.lowStockThreshold 过滤 warehouseQty', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: null },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(0);
    prisma.shopSkuSnapshot.findMany = vi.fn().mockResolvedValue([]);

    const svc = new DashboardService(prisma);
    await svc.summary('org-1', {});
    const countCall = prisma.shopSkuSnapshot.count.mock.calls[0][0];
    expect(countCall.where.orgId).toBe('org-1');
    expect(countCall.where.warehouseQty).toEqual({ lte: 10 });
  });

  it('shopId 过滤应用到 aggregate + count + findMany', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: null },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(0);
    prisma.shopSkuSnapshot.findMany = vi.fn().mockResolvedValue([]);

    const svc = new DashboardService(prisma);
    await svc.summary('org-1', { shopId: 's1' });
    expect(prisma.shopSkuSnapshot.aggregate.mock.calls[0][0].where.shopId).toBe('s1');
  });

  it('topTodayProducts 按 todaySaleVolume desc 取 10', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 5, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: new Date() },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(0);
    prisma.shopSkuSnapshot.findMany = vi.fn()
      .mockResolvedValueOnce([snap({ todaySaleVolume: 3, productName: 'A' })])  // topToday
      .mockResolvedValueOnce([snap({ sales30dVolume: 100 })])                   // top30d
      .mockResolvedValueOnce([snap({ daysRemaining: 2.5, warehouseQty: 5 })]);  // lowStock

    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', {});
    const callTop = prisma.shopSkuSnapshot.findMany.mock.calls[0][0];
    expect(callTop.orderBy).toEqual({ todaySaleVolume: 'desc' });
    expect(callTop.take).toBe(10);
    expect(r.topTodayProducts[0].todayVolume).toBe(3);
  });
});
