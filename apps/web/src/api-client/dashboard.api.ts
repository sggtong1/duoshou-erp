import { http } from './http';

export interface DashboardKpis {
  todayVolume: number;
  sales7dVolume: number;
  sales30dVolume: number;
  lowStockCount: number;
}

export interface DashboardSalesOverview {
  today: number;
  last7d: number;
  last30d: number;
}

export interface DashboardSkuRow {
  platformSkuId: string;
  skuTitle: string | null;
  shopId: string;
  shopName: string | null;
  sales30dVolume?: number;
  todayVolume?: number;
  warehouseQty?: number;
  avgDailySales?: number | null;
  daysRemaining?: number | null;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  salesOverview: DashboardSalesOverview;
  top30dRanking: DashboardSkuRow[];
  topTodayProducts: DashboardSkuRow[];
  lowStockAlerts: DashboardSkuRow[];
  pendingPriceReviews: number;
  dataFreshness: string | null;
}

export const dashboardApi = {
  summary: (shopId?: string) =>
    http<DashboardSummary>('/dashboard/summary', { query: shopId ? { shopId } : {} }),
  syncNow: () =>
    http<{ accepted: boolean; startedAt: string }>('/dashboard/sync/now', { method: 'POST' }),
};
