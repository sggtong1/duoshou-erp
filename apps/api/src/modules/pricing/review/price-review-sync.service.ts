import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { sharedRedis } from '../../../infra/redis';
import { pricingEndpoints } from '../pricing-endpoints';

const LOCK_KEY = 'lock:price-review-sync';
const LOCK_TTL_SECONDS = 1800;

function toBigInt(x: any): bigint | null {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  return BigInt(Math.round(n));
}

@Injectable()
export class PriceReviewSyncService {
  private logger = new Logger(PriceReviewSyncService.name);
  private get redis(): Redis { return sharedRedis(); }

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async syncShop(shopId: string): Promise<number> {
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop) return 0;
    const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
    const client = await this.clientFactory.forShop(shopId);
    let touched = 0;

    for (let pageNo = 1; pageNo <= 10; pageNo++) {
      let res: any;
      try {
        res = await client.call(ep.listReviews, { pageNo, pageSize: 50 });
      } catch (e: any) {
        this.logger.warn(`shop ${shopId} listReviews failed: ${e.message}`);
        break;
      }
      const list: any[] = res?.orderList ?? res?.list ?? res?.reviewList ?? [];
      if (!list.length) break;
      for (const o of list) {
        const platformOrderId = String(o.orderId ?? o.reviewOrderId ?? '');
        if (!platformOrderId) continue;
        await (this.prisma as any).priceReview.upsert({
          where: { shopId_platformOrderId: { shopId, platformOrderId } },
          create: {
            orgId: shop.orgId,
            shopId,
            platformOrderId,
            platformProductId: o.productId != null ? String(o.productId) : null,
            platformSkuId: o.skuId != null ? String(o.skuId) : null,
            skuTitle: o.productName ?? o.skuName ?? null,
            currentPriceCents: toBigInt(o.currentPrice ?? o.currentSupplierPrice),
            suggestedPriceCents: toBigInt(o.suggestedPrice ?? o.suggestSupplierPrice),
            currency: o.currency ?? null,
            reason: o.reason ?? o.adjustReason ?? null,
            status: o.status === 1 ? 'pending' : o.status === 2 ? 'confirmed' : o.status === 3 ? 'rejected' : 'pending',
            deadlineAt: o.deadline ? new Date(o.deadline) : null,
            platformPayload: o,
          },
          update: {
            skuTitle: o.productName ?? o.skuName ?? null,
            currentPriceCents: toBigInt(o.currentPrice ?? o.currentSupplierPrice),
            suggestedPriceCents: toBigInt(o.suggestedPrice ?? o.suggestSupplierPrice),
            reason: o.reason ?? o.adjustReason ?? null,
            platformPayload: o,
          },
        });
        touched++;
      }
      if (list.length < 50) break;
    }
    this.logger.log(`shop ${shopId} synced ${touched} reviews`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    let lock: string | null = null;
    try { lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX'); }
    catch (e: any) { this.logger.warn(`price-review lock acquire failed: ${e.message}`); }
    if (lock !== 'OK') {
      this.logger.warn('price-review sync skipped (lock held or redis down)');
      return 0;
    }
    try {
      const where: any = { status: 'active' };
      if (orgId) where.orgId = orgId;
      const shops = await (this.prisma as any).shop.findMany({ where });
      let total = 0;
      for (const s of shops) {
        try { total += await this.syncShop(s.id); }
        catch (e: any) { this.logger.error(`shop ${s.id} sync failed: ${e.message}`); }
      }
      return total;
    } finally {
      try { await this.redis.del(LOCK_KEY); }
      catch (e: any) { this.logger.warn(`price-review lock release failed: ${e.message}`); }
    }
  }
}
