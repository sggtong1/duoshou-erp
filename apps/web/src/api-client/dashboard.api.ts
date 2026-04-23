import { http } from './http';

export type TimeRange = 'today' | '7d' | '30d';
export type Platform = 'temu' | 'tiktok' | 'mercadolibre' | 'shopee' | 'amazon';
export type Region = 'cn' | 'pa';

export interface DashboardKpis {
  salesVolume: number;
  gmvCents: number | null;
  orderCount: number | null;
  netProfitCents: number | null;
  grossProfitCents: number | null;
  grossMarginPct: number | null;
  adSpendCents: number | null;
  roas: number | null;
}

export interface SalesTrendBucket {
  volume: number;
  gmvCents: number | null;
  orderCount: number | null;
}

export interface DashboardSkuRow {
  platformSkuId: string;
  skuTitle: string | null;
  shopId: string;
  shopName: string | null;
  platform: string | null;
  region: string | null;
  todayVolume: number;
  sales7dVolume: number;
  sales30dVolume: number;
  warehouseQty: number;
  avgDailySales: number | null;
  daysRemaining: number | null;
}

export interface ShopRankingRow {
  shopId: string;
  shopName: string;
  platform: string;
  salesVolume: number;
  gmvCents: number | null;
  changePct: number | null;
}

export interface PlatformComparisonRow {
  platform: string;
  salesVolume: number;
  gmvCents: number | null;
  orderCount: number | null;
}

export interface RegionDistributionRow {
  region: string;
  salesVolume: number;
  shopCount: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  salesTrend: { today: SalesTrendBucket; last7d: SalesTrendBucket; last30d: SalesTrendBucket };
  platformComparison: PlatformComparisonRow[];
  shopRanking: ShopRankingRow[];
  regionDistribution: RegionDistributionRow[];
  topSkus: DashboardSkuRow[];
  productDetails: { total: number; page: number; pageSize: number; items: DashboardSkuRow[] };
  alerts: { lowStockCount: number; lowRoiCount: number | null; shopDeclineCount: number | null };
  lowStockAlerts: DashboardSkuRow[];
  pendingPriceReviews: number;
  dataFreshness: string | null;
  appliedFilter: { platform: Platform | null; region: Region | null; shopIds: string[] | null; timeRange: TimeRange };
}

export interface DashboardSummaryQuery {
  platform?: Platform;
  region?: Region;
  shopIds?: string[];
  timeRange?: TimeRange;
}

export const dashboardApi = {
  summary: (q: DashboardSummaryQuery = {}, signal?: AbortSignal) =>
    http<DashboardSummary>('/dashboard/summary', {
      query: {
        platform: q.platform,
        region: q.region,
        shopIds: q.shopIds?.length ? q.shopIds.join(',') : undefined,
        timeRange: q.timeRange,
      },
      signal,
    }),
  syncNow: () =>
    http<{ accepted: boolean; startedAt: string }>('/dashboard/sync/now', { method: 'POST' }),
};
