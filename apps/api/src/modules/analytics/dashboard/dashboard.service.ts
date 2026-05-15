import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import type { DashboardSummaryFilterInput } from './dashboard.dto';

type TimeRange = 'today' | '7d' | '30d';

function bigIntToNumber(v: bigint | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Number(v);
}

function decimalToNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v?.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function addUtcDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

const EMPTY_BUCKET = { volume: 0, gmvCents: null, orderCount: null } as const;
const EMPTY_KPIS = {
  salesVolume: 0,
  gmvCents: null,
  orderCount: null,
  netProfitCents: null,
  grossProfitCents: null,
  grossMarginPct: null,
  adSpendCents: null,
  roas: null,
} as const;

function snapshotRow(s: any) {
  return {
    platformSkuId: s.platformSkuId,
    skuTitle: s.skuTitle ?? null,
    shopId: s.shopId,
    shopName: s.shopName ?? null,
    platform: s.platform ?? null,
    region: s.region ?? null,
    todayVolume: s.todaySaleVolume,
    sales7dVolume: s.sales7dVolume,
    sales30dVolume: s.sales30dVolume,
    warehouseQty: s.warehouseQty,
    avgDailySales: decimalToNumber(s.avgDailySales),
    daysRemaining: decimalToNumber(s.daysRemaining),
  };
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(orgId: string, filter: DashboardSummaryFilterInput) {
    const timeRange: TimeRange = filter.timeRange ?? '30d';

    // shopIds arrives as CSV string from query (or string[] when called from tests); normalize.
    const shopIdList: string[] | undefined = Array.isArray(filter.shopIds)
      ? filter.shopIds
      : typeof filter.shopIds === 'string'
        ? (filter.shopIds as string).split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    const platform = filter.platform ?? null;
    const region = filter.region ?? null;
    const hasShopFilter = !!shopIdList && shopIdList.length > 0;

    // 基准日: bi_org_daily 中 orgId 下最新的 businessDate。
    // 注意 mini PG 数据最新到 2026-04-30,不是真实"今天"。
    const latest = await (this.prisma as any).biOrgDaily.findFirst({
      where: { orgId },
      orderBy: { businessDate: 'desc' },
      select: { businessDate: true },
    });
    const latestDate: Date | null = latest?.businessDate ?? null;

    const settings = await (this.prisma as any).orgSettings.findUnique({ where: { orgId } });
    const lowStockDaysThreshold = settings?.lowStockDaysThreshold ?? 7;

    // No BI data yet — return empty shell so前端不崩溃,只少 pendingPriceReviews 仍照常查询。
    if (!latestDate) {
      const pendingPriceReviews = await (this.prisma as any).priceReview.count({
        where: { orgId, status: 'pending' },
      });
      return {
        kpis: { ...EMPTY_KPIS },
        salesTrend: { today: { ...EMPTY_BUCKET }, last7d: { ...EMPTY_BUCKET }, last30d: { ...EMPTY_BUCKET } },
        platformComparison: [],
        shopRanking: [],
        regionDistribution: [],
        topSkus: [],
        productDetails: { total: 0, page: 1, pageSize: 20, items: [] },
        alerts: { lowStockCount: 0, lowRoiCount: null, shopDeclineCount: null },
        lowStockAlerts: [],
        pendingPriceReviews,
        dataFreshness: null,
        appliedFilter: {
          platform,
          region,
          shopIds: hasShopFilter ? shopIdList! : null,
          timeRange,
        },
      };
    }

    // 时间窗口: 闭区间, latestDate 为右端点。
    const rangeStart =
      timeRange === 'today' ? latestDate
      : timeRange === '7d'  ? addUtcDays(latestDate, -6)
      :                       addUtcDays(latestDate, -29);
    const rangeEnd = latestDate;
    const start7d  = addUtcDays(latestDate, -6);
    const start30d = addUtcDays(latestDate, -29);

    // bi_sku_snapshot 是当前快照表,支持 platform/region/shopId 过滤。
    const skuSnapshotWhere: any = { orgId };
    if (platform) skuSnapshotWhere.platform = platform;
    if (region) skuSnapshotWhere.region = region;
    if (hasShopFilter) skuSnapshotWhere.shopId = { in: shopIdList! };

    const lowStockSkuWhere: any = {
      ...skuSnapshotWhere,
      daysRemaining: { lt: lowStockDaysThreshold, gt: 0 },
    };

    // bi_org_daily 没有 platform/region/shopId 维度,kpis 与 salesTrend 桶不应用这些过滤。
    // 如需带过滤的全局 KPI,需要切到 bi_shop_daily SUM;本次按 spec 字面实现。

    const [
      kpisAgg,
      todayAgg,
      last7dAgg,
      last30dAgg,
      platformGroup,
      shopGroup,
      regionGroup,
      topSkuList,
      productDetailsItems,
      productDetailsTotal,
      lowStockList,
      lowStockCount,
      pendingPriceReviews,
      latestSync,
    ] = await Promise.all([
      (this.prisma as any).biOrgDaily.aggregate({
        where: { orgId, businessDate: { gte: rangeStart, lte: rangeEnd } },
        _sum: {
          salesVolume: true,
          gmvCents: true,
          netProfitCents: true,
          grossProfitCents: true,
          adSpendCents: true,
          refundCents: true,
        },
      }),
      (this.prisma as any).biOrgDaily.aggregate({
        where: { orgId, businessDate: latestDate },
        _sum: { salesVolume: true, gmvCents: true },
      }),
      (this.prisma as any).biOrgDaily.aggregate({
        where: { orgId, businessDate: { gte: start7d, lte: latestDate } },
        _sum: { salesVolume: true, gmvCents: true },
      }),
      (this.prisma as any).biOrgDaily.aggregate({
        where: { orgId, businessDate: { gte: start30d, lte: latestDate } },
        _sum: { salesVolume: true, gmvCents: true },
      }),
      (this.prisma as any).biPlatformDaily.groupBy({
        by: ['platform'],
        where: {
          orgId,
          businessDate: { gte: rangeStart, lte: rangeEnd },
          ...(platform ? { platform } : {}),
        },
        _sum: { salesVolume: true, gmvCents: true, orderCount: true },
      }),
      (this.prisma as any).biShopDaily.groupBy({
        by: ['shopId', 'shopName', 'platform'],
        where: {
          orgId,
          businessDate: { gte: rangeStart, lte: rangeEnd },
          ...(platform ? { platform } : {}),
          ...(region ? { region } : {}),
          ...(hasShopFilter ? { shopId: { in: shopIdList! } } : {}),
        },
        _sum: { salesVolume: true, gmvCents: true },
        orderBy: { _sum: { salesVolume: 'desc' } },
        take: 10,
      }),
      // shopCount 是每天活跃店铺数,跨天 SUM 不准确,改用 MAX。
      (this.prisma as any).biRegionDaily.groupBy({
        by: ['region'],
        where: {
          orgId,
          businessDate: { gte: rangeStart, lte: rangeEnd },
          ...(region ? { region } : {}),
        },
        _sum: { salesVolume: true },
        _max: { shopCount: true },
      }),
      (this.prisma as any).biSkuSnapshot.findMany({
        where: skuSnapshotWhere,
        orderBy: { sales30dVolume: 'desc' },
        take: 10,
      }),
      (this.prisma as any).biSkuSnapshot.findMany({
        where: skuSnapshotWhere,
        orderBy: { sales30dVolume: 'desc' },
        skip: 0,
        take: 20,
      }),
      (this.prisma as any).biSkuSnapshot.count({ where: skuSnapshotWhere }),
      (this.prisma as any).biSkuSnapshot.findMany({
        where: lowStockSkuWhere,
        orderBy: { daysRemaining: 'asc' },
        take: 20,
      }),
      (this.prisma as any).biSkuSnapshot.count({ where: lowStockSkuWhere }),
      (this.prisma as any).priceReview.count({ where: { orgId, status: 'pending' } }),
      (this.prisma as any).biSyncLog.findFirst({
        where: { orgId, tableName: 'bi_org_daily', status: 'succeeded' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
    ]);

    // KPI 重算: grossMarginPct 返回百分数(34.61),roas 返回浮点(4.32);前端直接显示 + unit="%"
    const sum = kpisAgg._sum;
    const gmv = sum.gmvCents as bigint | null;
    const grossProfit = sum.grossProfitCents as bigint | null;
    const adSpend = sum.adSpendCents as bigint | null;
    const grossMarginPctRaw =
      gmv && grossProfit && gmv > 0n
        ? (Number(grossProfit) / Number(gmv)) * 100
        : null;
    const roasRaw =
      adSpend && gmv && adSpend > 0n ? Number(gmv) / Number(adSpend) : null;

    const kpis = {
      salesVolume: sum.salesVolume ?? 0,
      gmvCents: bigIntToNumber(gmv),
      orderCount: null,
      netProfitCents: bigIntToNumber(sum.netProfitCents),
      grossProfitCents: bigIntToNumber(grossProfit),
      grossMarginPct: grossMarginPctRaw !== null ? Number(grossMarginPctRaw.toFixed(2)) : null,
      adSpendCents: bigIntToNumber(adSpend),
      roas: roasRaw !== null ? Number(roasRaw.toFixed(2)) : null,
    };

    const salesTrend = {
      today: {
        volume: todayAgg._sum.salesVolume ?? 0,
        gmvCents: bigIntToNumber(todayAgg._sum.gmvCents),
        orderCount: null,
      },
      last7d: {
        volume: last7dAgg._sum.salesVolume ?? 0,
        gmvCents: bigIntToNumber(last7dAgg._sum.gmvCents),
        orderCount: null,
      },
      last30d: {
        volume: last30dAgg._sum.salesVolume ?? 0,
        gmvCents: bigIntToNumber(last30dAgg._sum.gmvCents),
        orderCount: null,
      },
    };

    const platformComparison = (platformGroup as any[]).map((g) => ({
      platform: g.platform,
      salesVolume: g._sum.salesVolume ?? 0,
      gmvCents: bigIntToNumber(g._sum.gmvCents),
      orderCount: g._sum.orderCount ?? null,
    }));

    const shopRanking = (shopGroup as any[]).map((g) => ({
      shopId: g.shopId,
      shopName: g.shopName ?? '',
      platform: g.platform ?? '',
      salesVolume: g._sum.salesVolume ?? 0,
      gmvCents: bigIntToNumber(g._sum.gmvCents),
      changePct: null,
    }));

    const regionDistribution = (regionGroup as any[]).map((g) => ({
      region: g.region,
      salesVolume: g._sum.salesVolume ?? 0,
      shopCount: g._max.shopCount ?? 0,
    }));

    const topSkus = (topSkuList as any[]).map(snapshotRow);
    const productDetails = {
      total: productDetailsTotal,
      page: 1,
      pageSize: 20,
      items: (productDetailsItems as any[]).map(snapshotRow),
    };
    const lowStockAlerts = (lowStockList as any[]).map(snapshotRow);

    return {
      kpis,
      salesTrend,
      platformComparison,
      shopRanking,
      regionDistribution,
      topSkus,
      productDetails,
      alerts: {
        lowStockCount,
        lowRoiCount: null,
        shopDeclineCount: null,
      },
      lowStockAlerts,
      pendingPriceReviews,
      dataFreshness: latestSync?.finishedAt?.toISOString() ?? null,
      appliedFilter: {
        platform,
        region,
        shopIds: hasShopFilter ? shopIdList! : null,
        timeRange,
      },
    };
  }
}
