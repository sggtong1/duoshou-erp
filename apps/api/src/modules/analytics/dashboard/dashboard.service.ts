import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import type { DashboardSummaryFilterInput } from './dashboard.dto';

type TimeRange = 'today' | '7d' | '30d';

const VOLUME_FIELD: Record<TimeRange, 'todaySaleVolume' | 'sales7dVolume' | 'sales30dVolume'> = {
  today: 'todaySaleVolume',
  '7d': 'sales7dVolume',
  '30d': 'sales30dVolume',
};

function skuRow(s: any) {
  return {
    platformSkuId: s.platformSkuId,
    skuTitle: [s.productName, s.className].filter(Boolean).join(' / ') || null,
    shopId: s.shopId,
    shopName: s.shop?.displayName ?? s.shop?.platformShopId ?? null,
    platform: s.shop?.platform ?? null,
    region: s.shop?.region ?? null,
    todayVolume: s.todaySaleVolume,
    sales7dVolume: s.sales7dVolume,
    sales30dVolume: s.sales30dVolume,
    warehouseQty: s.warehouseQty,
    avgDailySales: s.avgDailySales,
    daysRemaining: s.daysRemaining,
  };
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(orgId: string, filter: DashboardSummaryFilterInput) {
    const timeRange: TimeRange = filter.timeRange ?? '30d';
    const volumeField = VOLUME_FIELD[timeRange];

    const shopWhere: any = { orgId, status: 'active' };
    if (filter.platform) shopWhere.platform = filter.platform;
    if (filter.region) shopWhere.region = filter.region;
    if (filter.shopIds && filter.shopIds.length > 0) shopWhere.id = { in: filter.shopIds };

    const inScopeShops = await (this.prisma as any).shop.findMany({
      where: shopWhere,
      select: { id: true, displayName: true, platformShopId: true, platform: true, region: true },
    });
    const scopeShopIds = inScopeShops.map((s: any) => s.id);

    const snapshotWhere: any = { orgId };
    if (scopeShopIds.length > 0) snapshotWhere.shopId = { in: scopeShopIds };
    else snapshotWhere.shopId = { in: ['__none__'] };

    const settings = await (this.prisma as any).orgSettings.findUnique({ where: { orgId } });
    const lowStockThreshold = settings?.lowStockThreshold ?? 10;

    const [agg, lowStockCount, topRange, lowStockListRaw, groupByShop, pendingPriceReviews] = await Promise.all([
      (this.prisma as any).shopSkuSnapshot.aggregate({
        where: snapshotWhere,
        _sum: { todaySaleVolume: true, sales7dVolume: true, sales30dVolume: true },
        _max: { lastSyncedAt: true },
      }),
      (this.prisma as any).shopSkuSnapshot.count({
        where: { ...snapshotWhere, warehouseQty: { lte: lowStockThreshold } },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: snapshotWhere,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true, platform: true, region: true } } },
        orderBy: { [volumeField]: 'desc' },
        take: 50,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: { ...snapshotWhere, warehouseQty: { lte: lowStockThreshold } },
        include: { shop: { select: { id: true, displayName: true, platformShopId: true, platform: true, region: true } } },
        orderBy: [{ daysRemaining: { sort: 'asc', nulls: 'last' } }, { warehouseQty: 'asc' }],
        take: 20,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).shopSkuSnapshot.groupBy({
        by: ['shopId'],
        where: snapshotWhere,
        _sum: { [volumeField]: true },
      }),
      (this.prisma as any).priceReview.count({ where: { orgId, status: 'pending' } }),
    ]);

    const shopMap = new Map(inScopeShops.map((s: any) => [s.id, s]));
    const shopRanking = groupByShop
      .map((g: any) => {
        const s = shopMap.get(g.shopId);
        return s ? {
          shopId: g.shopId,
          shopName: s.displayName ?? s.platformShopId,
          platform: s.platform,
          salesVolume: g._sum[volumeField] ?? 0,
          gmvCents: null,
          changePct: null,
        } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.salesVolume - a.salesVolume);

    const regionMap = new Map<string, { salesVolume: number; shopCount: number }>();
    for (const g of groupByShop as any[]) {
      const s = shopMap.get(g.shopId) as any;
      if (!s) continue;
      const key = s.region;
      const acc = regionMap.get(key) ?? { salesVolume: 0, shopCount: 0 };
      acc.salesVolume += g._sum[volumeField] ?? 0;
      acc.shopCount += 1;
      regionMap.set(key, acc);
    }
    const regionDistribution = [...regionMap.entries()].map(([region, v]) => ({ region, ...v }));

    const platformMap = new Map<string, { salesVolume: number }>();
    for (const g of groupByShop as any[]) {
      const s = shopMap.get(g.shopId) as any;
      if (!s) continue;
      const acc = platformMap.get(s.platform) ?? { salesVolume: 0 };
      acc.salesVolume += g._sum[volumeField] ?? 0;
      platformMap.set(s.platform, acc);
    }
    const platformComparison = [...platformMap.entries()].map(([platform, v]) => ({
      platform,
      salesVolume: v.salesVolume,
      gmvCents: null,
      orderCount: null,
    }));

    const topSkus = topRange.slice(0, 10).map(skuRow);
    const productDetailsItems = topRange.slice(0, 30).map(skuRow);
    const lowStockAlerts = lowStockListRaw.map(skuRow);
    const timeRangeTotal = agg._sum[volumeField] ?? 0;

    return {
      kpis: {
        salesVolume: timeRangeTotal,
        gmvCents: null,
        orderCount: null,
        netProfitCents: null,
        grossProfitCents: null,
        grossMarginPct: null,
        adSpendCents: null,
        roas: null,
      },
      salesTrend: {
        today:   { volume: agg._sum.todaySaleVolume ?? 0, gmvCents: null, orderCount: null },
        last7d:  { volume: agg._sum.sales7dVolume ?? 0,  gmvCents: null, orderCount: null },
        last30d: { volume: agg._sum.sales30dVolume ?? 0, gmvCents: null, orderCount: null },
      },
      platformComparison,
      shopRanking,
      regionDistribution,
      topSkus,
      productDetails: {
        total: productDetailsItems.length,
        page: 1,
        pageSize: 30,
        items: productDetailsItems,
      },
      alerts: {
        lowStockCount,
        lowRoiCount: null,
        shopDeclineCount: null,
      },
      lowStockAlerts,
      pendingPriceReviews,
      dataFreshness: agg._max.lastSyncedAt?.toISOString() ?? null,
      appliedFilter: {
        platform: filter.platform ?? null,
        region: filter.region ?? null,
        shopIds: filter.shopIds ?? null,
        timeRange,
      },
    };
  }
}
