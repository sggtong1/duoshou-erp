import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';
import type { SubmitAdjustmentInput } from './price-adjustment.dto';

@Injectable()
export class PriceAdjustmentService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async submit(orgId: string, input: SubmitAdjustmentInput) {
    const shop = await (this.prisma as any).shop.findFirst({
      where: { id: input.shopId, orgId },
    });
    if (!shop) throw new NotFoundException('Shop not found');

    const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
    const client = await this.clientFactory.forShop(shop.id);

    const records = await Promise.all(input.items.map((it) =>
      (this.prisma as any).priceAdjustmentOrder.create({
        data: {
          orgId, shopId: shop.id,
          platformSkuId: it.platformSkuId,
          skuTitle: it.skuTitle,
          newPriceCents: BigInt(it.newPriceCents),
          currency: it.currency,
        },
      }),
    ));

    const submitOrders = input.items.map((it) => ({
      productSkuId: it.platformSkuId,
      newSupplierPrice: String(it.newPriceCents),
      currency: it.currency ?? 'USD',
    }));

    try {
      const res: any = await client.call(ep.submitAdjustment, {
        batchResult: 1,
        submitOrders,
      });
      for (const r of records) {
        await (this.prisma as any).priceAdjustmentOrder.update({
          where: { id: r.id },
          data: { status: 'approved', platformPayload: res, resolvedAt: new Date() },
        });
      }
      return { total: records.length, submittedIds: records.map((r) => r.id), platformResponse: res };
    } catch (e: any) {
      for (const r of records) {
        await (this.prisma as any).priceAdjustmentOrder.update({
          where: { id: r.id },
          data: { status: 'failed', error: { message: e.message }, resolvedAt: new Date() },
        });
      }
      throw e;
    }
  }

  async list(orgId: string, limit = 50) {
    const items = await (this.prisma as any).priceAdjustmentOrder.findMany({
      where: { orgId },
      include: { shop: { select: { displayName: true, platformShopId: true } } },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    });
    return items.map((i: any) => ({
      ...i,
      oldPriceCents: i.oldPriceCents != null ? Number(i.oldPriceCents) : null,
      newPriceCents: Number(i.newPriceCents),
    }));
  }
}
