import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import type { DashboardSummaryFilterInput } from './dashboard.dto';

function serializeSnapshot(s: any) {
  const shop = s.shop ?? null;
  const skuTitle = [s.productName, s.className].filter(Boolean).join(' / ') || null;
  return {
    platformSkuId: s.platformSkuId,
    skuTitle,
    shopId: s.shopId,
    shopName: shop?.displayName ?? shop?.platformShopId ?? null,
    todayVolume: s.todaySaleVolume,
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
    const baseWhere: any = { orgId };
    if (filter.shopId) baseWhere.shopId = filter.shopId;

    const settings = await (this.prisma as any).orgSettings.findUnique({ where: { orgId } });
    const lowStockThreshold = settings?.lowStockThreshold ?? 10;

    const [agg, lowStockCount, topToday, top30d, lowStockList, pendingPriceReviews] = await Promise.all([
      (this.prisma as any).shopSkuSnapshot.aggregate({
        where: baseWhere,
        _sum: { todaySaleVolume: true, sales7dVolume: true, sales30dVolume: true },
        _max: { lastSyncedAt: true },
      }),
      (this.prisma as any).shopSkuSnapshot.count({
        where: { ...baseWhere, warehouseQty: { lte: lowStockThreshold } },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: baseWhere,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true } } },
        orderBy: { todaySaleVolume: 'desc' },
        take: 10,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: baseWhere,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true } } },
        orderBy: { sales30dVolume: 'desc' },
        take: 20,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: { ...baseWhere, warehouseQty: { lte: lowStockThreshold } },
        include: { shop: { select: { id: true, displayName: true, platformShopId: true } } },
        orderBy: [{ daysRemaining: { sort: 'asc', nulls: 'last' } }, { warehouseQty: 'asc' }],
        take: 20,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).priceReview.count({
        where: { orgId, status: 'pending' },
      }),
    ]);

    return {
      kpis: {
        todayVolume: agg._sum.todaySaleVolume ?? 0,
        sales7dVolume: agg._sum.sales7dVolume ?? 0,
        sales30dVolume: agg._sum.sales30dVolume ?? 0,
        lowStockCount,
      },
      salesOverview: {
        today: agg._sum.todaySaleVolume ?? 0,
        last7d: agg._sum.sales7dVolume ?? 0,
        last30d: agg._sum.sales30dVolume ?? 0,
      },
      top30dRanking: top30d.map((s: any) => ({
        platformSkuId: s.platformSkuId,
        skuTitle: [s.productName, s.className].filter(Boolean).join(' / ') || null,
        shopId: s.shopId,
        shopName: s.shop?.displayName ?? s.shop?.platformShopId ?? null,
        sales30dVolume: s.sales30dVolume,
      })),
      topTodayProducts: topToday.map(serializeSnapshot),
      lowStockAlerts: lowStockList.map(serializeSnapshot),
      pendingPriceReviews,
      dataFreshness: agg._max.lastSyncedAt?.toISOString() ?? null,
    };
  }
}
