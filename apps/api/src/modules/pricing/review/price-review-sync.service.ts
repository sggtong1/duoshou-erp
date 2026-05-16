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

function normalizeReviewStatus(raw: any): string {
  const n = Number(raw);
  if (n === 2) return 'confirmed';
  if (n === 3) return 'rejected';
  if (n === 4) return 'expired';
  return 'pending';
}

function firstSkuId(o: any): string | null {
  const ids = Array.isArray(o.productSkuIdList) ? o.productSkuIdList : [];
  if (ids.length) return String(ids[0]);
  if (o.productSkuId != null) return String(o.productSkuId);
  if (o.skuId != null) return String(o.skuId);
  return null;
}

function apiErrorSummary(e: any) {
  const raw = e?.rawBody && typeof e.rawBody === 'object' ? e.rawBody : {};
  return {
    message: e?.message ?? 'unknown error',
    errorCode: e?.errorCode ?? raw.errorCode ?? null,
    errorMsg: raw.errorMsg ?? null,
  };
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
        throw e;
      }
      const list: any[] = res?.result?.reviewSamplePriceList ?? res?.orderList ?? res?.list ?? res?.reviewList ?? [];
      if (!list.length) break;
      for (const o of list) {
        const platformOrderId = String(o.orderId ?? o.reviewOrderId ?? '');
        if (!platformOrderId) continue;
        const platformSkuId = firstSkuId(o);
        const status = normalizeReviewStatus(o.orderStatus ?? o.status);
        await (this.prisma as any).priceReview.upsert({
          where: { shopId_platformOrderId: { shopId, platformOrderId } },
          create: {
            orgId: shop.orgId,
            shopId,
            platformOrderId,
            platformProductId: o.productId != null ? String(o.productId) : null,
            platformSkuId,
            skuTitle: o.productName ?? o.skuName ?? null,
            currentPriceCents: toBigInt(o.supplyPrice ?? o.currentPrice ?? o.currentSupplierPrice),
            suggestedPriceCents: toBigInt(o.suggestSupplyPrice ?? o.suggestedPrice ?? o.suggestSupplierPrice),
            currency: o.priceCurrency ?? o.suggestPriceCurrency ?? o.currency ?? null,
            reason: o.reason ?? o.adjustReason ?? null,
            status,
            deadlineAt: o.deadline ? new Date(o.deadline) : null,
            platformPayload: o,
          },
          update: {
            skuTitle: o.productName ?? o.skuName ?? null,
            platformSkuId,
            currentPriceCents: toBigInt(o.supplyPrice ?? o.currentPrice ?? o.currentSupplierPrice),
            suggestedPriceCents: toBigInt(o.suggestSupplyPrice ?? o.suggestedPrice ?? o.suggestSupplierPrice),
            currency: o.priceCurrency ?? o.suggestPriceCurrency ?? o.currency ?? null,
            reason: o.reason ?? o.adjustReason ?? null,
            status,
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
    const detailed = await this.syncAllActiveShopsDetailed(orgId);
    return detailed.total;
  }

  async syncAllActiveShopsDetailed(orgId?: string): Promise<{
    total: number;
    skipped: boolean;
    shops: Array<{
      shopId: string;
      displayName: string | null;
      platformShopId: string;
      shopType: string;
      region: string;
      ok: boolean;
      touched: number;
      error?: ReturnType<typeof apiErrorSummary>;
    }>;
  }> {
    let lock: string | null = null;
    try { lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX'); }
    catch (e: any) { this.logger.warn(`price-review lock acquire failed: ${e.message}`); }
    if (lock !== 'OK') {
      this.logger.warn('price-review sync skipped (lock held or redis down)');
      return { total: 0, skipped: true, shops: [] };
    }
    try {
      const where: any = { status: 'active' };
      if (orgId) where.orgId = orgId;
      const shops = await (this.prisma as any).shop.findMany({ where });
      let total = 0;
      const results: Array<{
        shopId: string;
        displayName: string | null;
        platformShopId: string;
        shopType: string;
        region: string;
        ok: boolean;
        touched: number;
        error?: ReturnType<typeof apiErrorSummary>;
      }> = [];
      for (const s of shops) {
        try {
          const touched = await this.syncShop(s.id);
          total += touched;
          results.push({
            shopId: s.id,
            displayName: s.displayName,
            platformShopId: s.platformShopId,
            shopType: s.shopType,
            region: s.region,
            ok: true,
            touched,
          });
        } catch (e: any) {
          this.logger.error(`shop ${s.id} sync failed: ${e.message}`);
          results.push({
            shopId: s.id,
            displayName: s.displayName,
            platformShopId: s.platformShopId,
            shopType: s.shopType,
            region: s.region,
            ok: false,
            touched: 0,
            error: apiErrorSummary(e),
          });
        }
      }
      return { total, skipped: false, shops: results };
    } finally {
      try { await this.redis.del(LOCK_KEY); }
      catch (e: any) { this.logger.warn(`price-review lock release failed: ${e.message}`); }
    }
  }
}
