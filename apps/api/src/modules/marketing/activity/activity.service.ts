import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import type { ListActivitiesFilterInput } from './activity.dto';

async function attachAggregates(prisma: any, items: any[]) {
  if (!items.length) return items;
  const activityIds = items.map((x) => x.id);
  const groups = await prisma.activityEnrollment.groupBy({
    by: ['activityId', 'shopId'],
    where: { activityId: { in: activityIds } },
    _count: { _all: true },
  });
  const byActivity = new Map<string, { shops: Set<string>; skus: number }>();
  for (const g of groups) {
    const k = g.activityId;
    const cur = byActivity.get(k) ?? { shops: new Set<string>(), skus: 0 };
    cur.shops.add(g.shopId);
    cur.skus += g._count._all;
    byActivity.set(k, cur);
  }
  return items.map((a) => {
    const agg = byActivity.get(a.id);
    const shopVis: any[] = Array.isArray(a.shopVisibility) ? a.shopVisibility : [];
    return {
      ...a,
      shopCount: shopVis.length,
      enrolledShopCount: agg?.shops.size ?? 0,
      enrolledSkuCount: agg?.skus ?? 0,
    };
  });
}

@Injectable()
export class ActivityService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async list(orgId: string, filter: ListActivitiesFilterInput) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: any = { orgId };
    if (filter.region) where.region = filter.region;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.title = { contains: filter.search, mode: 'insensitive' };
    if (filter.shopId) where.shopVisibility = { array_contains: [{ shopId: filter.shopId }] };
    if (filter.startAfter) where.startAt = { gte: new Date(filter.startAfter) };
    if (filter.startBefore) where.startAt = { ...(where.startAt ?? {}), lte: new Date(filter.startBefore) };

    const [total, items] = await Promise.all([
      (this.prisma as any).activity.count({ where }),
      (this.prisma as any).activity.findMany({
        where,
        omit: { platformPayload: true },
        include: { sessions: { orderBy: { startAt: 'asc' }, omit: { platformPayload: true } } },
        orderBy: [{ status: 'asc' }, { startAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const withAgg = await attachAggregates(this.prisma, items);
    return { total, page, pageSize, items: withAgg };
  }

  async get(orgId: string, id: string) {
    const a = await (this.prisma as any).activity.findFirst({
      where: { id, orgId },
      omit: { platformPayload: true },
      include: { sessions: { orderBy: { startAt: 'asc' }, omit: { platformPayload: true } } },
    });
    if (!a) throw new NotFoundException(`Activity ${id} not found`);
    const [withAgg] = await attachAggregates(this.prisma, [a]);
    return withAgg;
  }
}
