import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';
import type { ListReviewsFilterInput, RejectReviewItemInput } from './price-review.dto';

function bigIntToNumber(v: bigint | null | undefined): number | null {
  return v == null ? null : Number(v);
}

function arrayFromPayload(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function productSkuIdsFromReview(r: any): string[] {
  const payload = r.platformPayload ?? {};
  const ids = arrayFromPayload(payload.productSkuIdList);
  if (ids.length) return ids.map((x) => String(x));
  return r.platformSkuId ? [String(r.platformSkuId)] : [];
}

function serialize(r: any) {
  const payload = r.platformPayload ?? {};
  return {
    ...r,
    currentPriceCents: bigIntToNumber(r.currentPriceCents),
    suggestedPriceCents: bigIntToNumber(r.suggestedPriceCents),
    productSkuIds: productSkuIdsFromReview(r),
    siteIds: arrayFromPayload(payload.siteIds).map((x) => Number(x)).filter(Number.isFinite),
    siteNameList: arrayFromPayload(payload.siteNameList).map((x) => String(x)),
    canBargain: typeof payload.canBargain === 'boolean' ? payload.canBargain : null,
    rawStatus: typeof payload.orderStatus === 'number' ? payload.orderStatus : null,
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
        include: {
          shop: {
            select: {
              id: true,
              platform: true,
              displayName: true,
              platformShopId: true,
              shopType: true,
              region: true,
            },
          },
        },
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

  async batchReject(orgId: string, items: RejectReviewItemInput[]) {
    const reviewIds = items.map((x) => x.reviewId);
    const byId = new Map(items.map((x) => [x.reviewId, x]));
    const reviews = await (this.prisma as any).priceReview.findMany({
      where: { id: { in: reviewIds }, orgId, status: 'pending' },
      include: { shop: true },
    });
    const results: any[] = [];
    for (const r of reviews) {
      const ep = pricingEndpoints({ shopType: r.shop.shopType, region: r.shop.region });
      const client = await this.clientFactory.forShop(r.shopId);
      const input = byId.get(r.id);
      if (!input) { results.push({ id: r.id, ok: false, error: 'missing reject payload' }); continue; }
      const priceItemList = this.buildRejectPriceItems(r, input);
      if (!priceItemList.length) { results.push({ id: r.id, ok: false, error: 'missing sku price items' }); continue; }
      try {
        await client.call(ep.rejectReview, {
          orderId: Number(r.platformOrderId),
          priceItemList,
          ...(input.reasons?.length ? {
            bargainReasonList: [{
              componentList: input.reasons.map((reason) => ({
                type: reason.type,
                reason: reason.reason,
              })),
              ...(input.externalLinks?.length ? { externalLinkList: input.externalLinks } : {}),
            }],
          } : {}),
        });
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

  private buildRejectPriceItems(review: any, input: RejectReviewItemInput) {
    if (input.priceItems?.length) {
      return input.priceItems.map((it) => ({
        productSkuId: Number(it.productSkuId),
        price: String(it.priceCents),
      })).filter((it) => Number.isFinite(it.productSkuId));
    }

    if (!input.counterPriceCents) return [];
    return productSkuIdsFromReview(review)
      .map((productSkuId) => Number(productSkuId))
      .filter(Number.isFinite)
      .map((productSkuId) => ({
        productSkuId,
        price: String(input.counterPriceCents),
      }));
  }
}
