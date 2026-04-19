import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { sharedRedis } from '../../../infra/redis';
import { marketingEndpoints } from '../marketing-endpoints';

const CACHE_TTL_SECONDS = 300;

export function productsCacheKey(shopId: string, activityId: string) {
  return `activity:products:${shopId}:${activityId}`;
}

@Injectable()
export class ActivityProductsService {
  private logger = new Logger(ActivityProductsService.name);
  private get redis(): Redis {
    return sharedRedis();
  }

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async list(orgId: string, activityId: string, shopId: string) {
    const activity = await (this.prisma as any).activity.findFirst({
      where: { id: activityId, orgId },
    });
    if (!activity) throw new NotFoundException(`Activity ${activityId} not found`);

    const shop = await (this.prisma as any).shop.findFirst({ where: { id: shopId, orgId } });
    if (!shop) throw new NotFoundException(`Shop ${shopId} not found`);

    const cacheKey = productsCacheKey(shopId, activityId);
    let cached: string | null = null;
    try { cached = await this.redis.get(cacheKey); }
    catch (e: any) { this.logger.warn(`redis get ${cacheKey} failed: ${e.message}`); }
    if (cached) {
      try { return { cached: true, ...JSON.parse(cached) }; }
      catch { /* fallthrough */ }
    }

    const ep = marketingEndpoints({ region: activity.region });
    const client = await this.clientFactory.forShop(shopId);
    let items: any[] = [];
    try {
      const res: any = await client.call(ep.listProducts, {
        activityId: activity.platformActivityId,
        pageNo: 1,
        pageSize: 100,
      });
      items = res?.productList ?? res?.skuList ?? res?.list ?? [];
    } catch (e: any) {
      this.logger.warn(`activity ${activityId} products fetch failed: ${e.message}`);
      return { cached: false, items: [], error: e.message };
    }

    const normalized = items.map((it) => ({
      platformSkuId: String(it.skuId ?? it.productSkuId ?? ''),
      platformProductId: it.productId != null ? String(it.productId) : null,
      skuTitle: it.productName ?? it.skuName ?? null,
      currentPriceCents: toPriceCents(it.currentPrice ?? it.supplierPrice ?? it.price),
      stockQty: it.stockQty ?? it.availableQty ?? null,
      currency: it.currency ?? null,
    })).filter((x) => x.platformSkuId);

    const payload = { items: normalized, fetchedAt: new Date().toISOString() };
    try { await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(payload)); }
    catch (e: any) { this.logger.warn(`redis setex ${cacheKey} failed: ${e.message}`); }
    return { cached: false, ...payload };
  }
}

function toPriceCents(x: any): number | null {
  if (x == null || x === '') return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}
