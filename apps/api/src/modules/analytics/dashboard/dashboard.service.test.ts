import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService.summary', () => {
  let prisma: any;

  function shop(ov: any = {}) {
    return {
      id: 's1', displayName: 'Shop A', platformShopId: '1001',
      platform: 'temu', region: 'pa', ...ov,
    };
  }
  function snap(ov: any = {}) {
    return {
      id: 'id', orgId: 'org-1', shopId: 's1',
      platformSkuId: 'sku-1', productName: 'P', className: 'V', skuExtCode: null,
      todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0, totalSaleVolume: 0,
      warehouseQty: 100, waitReceiveQty: 0, waitOnShelfQty: 0, waitDeliveryQty: 0,
      avgDailySales: 0, daysRemaining: null, supplierPriceCents: null,
      lastSyncedAt: new Date('2026-04-21T10:00:00Z'),
      shop: shop(),
      ...ov,
    };
  }

  beforeEach(() => {
    prisma = {
      shop: {
        findMany: vi.fn().mockResolvedValue([shop()]),
      },
      shopSkuSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { todaySaleVolume: 5, sales7dVolume: 30, sales30dVolume: 120 },
          _max: { lastSyncedAt: new Date('2026-04-21T10:00:00Z') },
        }),
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          { shopId: 's1', _sum: { sales30dVolume: 120, sales7dVolume: 30, todaySaleVolume: 5 } },
        ]),
      },
      orgSettings: {
        findUnique: vi.fn().mockResolvedValue({ orgId: 'org-1', lowStockThreshold: 10 }),
      },
      priceReview: { count: vi.fn().mockResolvedValue(2) },
    };
  });

  it('returns 8 KPIs: salesVolume per timeRange, 7 others null', async () => {
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    expect(r.kpis.salesVolume).toBe(120);
    expect(r.kpis.gmvCents).toBeNull();
    expect(r.kpis.orderCount).toBeNull();
    expect(r.kpis.netProfitCents).toBeNull();
    expect(r.kpis.grossProfitCents).toBeNull();
    expect(r.kpis.grossMarginPct).toBeNull();
    expect(r.kpis.adSpendCents).toBeNull();
    expect(r.kpis.roas).toBeNull();
  });

  it('timeRange=today uses todaySaleVolume sum for salesVolume', async () => {
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: 'today' });
    expect(r.kpis.salesVolume).toBe(5);
  });

  it('salesTrend always returns all three buckets from real data', async () => {
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    expect(r.salesTrend.today.volume).toBe(5);
    expect(r.salesTrend.last7d.volume).toBe(30);
    expect(r.salesTrend.last30d.volume).toBe(120);
    expect(r.salesTrend.today.gmvCents).toBeNull();
  });

  it('shopRanking aggregates from groupBy and sorts desc by salesVolume', async () => {
    prisma.shop.findMany.mockResolvedValue([
      shop({ id: 's1', displayName: 'A' }),
      shop({ id: 's2', displayName: 'B' }),
    ]);
    prisma.shopSkuSnapshot.groupBy.mockResolvedValue([
      { shopId: 's1', _sum: { sales30dVolume: 50 } },
      { shopId: 's2', _sum: { sales30dVolume: 200 } },
    ]);
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    expect(r.shopRanking.map((x: any) => x.shopId)).toEqual(['s2', 's1']);
    expect(r.shopRanking[0].salesVolume).toBe(200);
  });

  it('regionDistribution groups by region with salesVolume + shopCount', async () => {
    prisma.shop.findMany.mockResolvedValue([
      shop({ id: 's1', region: 'cn' }),
      shop({ id: 's2', region: 'pa' }),
      shop({ id: 's3', region: 'pa' }),
    ]);
    prisma.shopSkuSnapshot.groupBy.mockResolvedValue([
      { shopId: 's1', _sum: { sales30dVolume: 10 } },
      { shopId: 's2', _sum: { sales30dVolume: 30 } },
      { shopId: 's3', _sum: { sales30dVolume: 20 } },
    ]);
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    const cn = r.regionDistribution.find((x: any) => x.region === 'cn');
    const pa = r.regionDistribution.find((x: any) => x.region === 'pa');
    expect(cn).toEqual({ region: 'cn', salesVolume: 10, shopCount: 1 });
    expect(pa).toEqual({ region: 'pa', salesVolume: 50, shopCount: 2 });
  });

  it('platform filter reaches shop.findMany where clause', async () => {
    const svc = new DashboardService(prisma);
    await svc.summary('org-1', { platform: 'temu', timeRange: '30d' });
    const call = prisma.shop.findMany.mock.calls[0][0];
    expect(call.where.platform).toBe('temu');
    expect(call.where.orgId).toBe('org-1');
  });

  it('shopIds filter reaches shop.findMany where clause', async () => {
    const svc = new DashboardService(prisma);
    await svc.summary('org-1', { shopIds: ['s1', 's2'], timeRange: '30d' });
    const call = prisma.shop.findMany.mock.calls[0][0];
    expect(call.where.id).toEqual({ in: ['s1', 's2'] });
  });

  it('alerts.lowStockCount filters by OrgSettings.lowStockThreshold', async () => {
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    expect(r.alerts.lowStockCount).toBe(3);
    expect(r.alerts.lowRoiCount).toBeNull();
    expect(r.alerts.shopDeclineCount).toBeNull();
    const countCall = prisma.shopSkuSnapshot.count.mock.calls[0][0];
    expect(countCall.where.warehouseQty).toEqual({ lte: 10 });
  });

  it('topSkus uses timeRange volume field as desc orderBy, take 10', async () => {
    prisma.shopSkuSnapshot.findMany.mockResolvedValueOnce([
      snap({ platformSkuId: 'A', sales30dVolume: 100 }),
      snap({ platformSkuId: 'B', sales30dVolume: 50 }),
    ]);
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    const orderBy = prisma.shopSkuSnapshot.findMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual({ sales30dVolume: 'desc' });
    expect(r.topSkus[0].platformSkuId).toBe('A');
  });

  it('returns empty structure gracefully when no in-scope shops', async () => {
    prisma.shop.findMany.mockResolvedValue([]);
    prisma.shopSkuSnapshot.groupBy.mockResolvedValue([]);
    prisma.shopSkuSnapshot.aggregate.mockResolvedValue({
      _sum: { todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: null },
    });
    prisma.shopSkuSnapshot.count.mockResolvedValue(0);
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { timeRange: '30d' });
    expect(r.kpis.salesVolume).toBe(0);
    expect(r.shopRanking).toEqual([]);
    expect(r.regionDistribution).toEqual([]);
    expect(r.platformComparison).toEqual([]);
  });

  it('appliedFilter echoes query for debug', async () => {
    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', { platform: 'temu', region: 'pa', timeRange: '7d' });
    expect(r.appliedFilter).toEqual({
      platform: 'temu',
      region: 'pa',
      shopIds: null,
      timeRange: '7d',
    });
  });
});
