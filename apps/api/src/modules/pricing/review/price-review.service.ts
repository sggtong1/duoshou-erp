import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';
import type { ListReviewsFilterInput } from './price-review.dto';

function bigIntToNumber(v: bigint | null | undefined): number | null {
  return v == null ? null : Number(v);
}

function serialize(r: any) {
  return {
    ...r,
    currentPriceCents: bigIntToNumber(r.currentPriceCents),
    suggestedPriceCents: bigIntToNumber(r.suggestedPriceCents),
  };
}

@Injectable()
export class PriceReviewService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async list(orgId: string, filter: ListReviewsFilterInput) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: any = { orgId };
    if (filter.shopId) where.shopId = filter.shopId;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.skuTitle = { contains: filter.search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      (this.prisma as any).priceReview.count({ where }),
      (this.prisma as any).priceReview.findMany({
        where,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true, shopType: true } } },
        orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: items.map(serialize) };
  }

  async get(orgId: string, id: string) {
    const r = await (this.prisma as any).priceReview.findFirst({
      where: { id, orgId },
      include: { shop: true },
    });
    if (!r) throw new NotFoundException(`Price review ${id} not found`);
    return serialize(r);
  }

  async batchConfirm(orgId: string, reviewIds: string[]) {
    const reviews = await (this.prisma as any).priceReview.findMany({
      where: { id: { in: reviewIds }, orgId, status: 'pending' },
      include: { shop: true },
    });
    const results: any[] = [];
    for (const r of reviews) {
      const ep = pricingEndpoints({ shopType: r.shop.shopType, region: r.shop.region });
      const client = await this.clientFactory.forShop(r.shopId);
      try {
        await client.call(ep.confirmReview, { orderId: Number(r.platformOrderId) });
        await (this.prisma as any).priceReview.update({
          where: { id: r.id },
          data: { status: 'confirmed', resolvedAt: new Date() },
        });
        results.push({ id: r.id, ok: true });
      } catch (e: any) {
        results.push({ id: r.id, ok: false, error: e.message });
      }
    }
    return { total: reviews.length, results };
  }

  async batchReject(orgId: string, reviewIds: string[], counterPriceCents: Record<string, number>) {
    const reviews = await (this.prisma as any).priceReview.findMany({
      where: { id: { in: reviewIds }, orgId, status: 'pending' },
      include: { shop: true },
    });
    const results: any[] = [];
    for (const r of reviews) {
      const ep = pricingEndpoints({ shopType: r.shop.shopType, region: r.shop.region });
      const client = await this.clientFactory.forShop(r.shopId);
      const counter = counterPriceCents[r.id];
      if (!counter) { results.push({ id: r.id, ok: false, error: 'missing counter price' }); continue; }
      try {
        await client.call(ep.rejectReview, { orderId: Number(r.platformOrderId), newSupplierPrice: String(counter) });
        await (this.prisma as any).priceReview.update({
          where: { id: r.id },
          data: { status: 'rejected', resolvedAt: new Date() },
        });
        results.push({ id: r.id, ok: true });
      } catch (e: any) {
        results.push({ id: r.id, ok: false, error: e.message });
      }
    }
    return { total: reviews.length, results };
  }
}
