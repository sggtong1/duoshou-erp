import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { makeRedisClient } from '../../../infra/redis';
import { marketingEndpoints } from '../marketing-endpoints';

const CACHE_TTL_SECONDS = 300;

@Injectable()
export class ActivityProductsService {
  private logger = new Logger(ActivityProductsService.name);
  private redis = makeRedisClient();

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

    const cacheKey = `activity:products:${shopId}:${activityId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return { cached: true, ...JSON.parse(cached) }; }
      catch { /* fallthrough to refresh */ }
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
      currentPriceCents: toBigIntNumber(it.currentPrice ?? it.supplierPrice ?? it.price),
      stockQty: it.stockQty ?? it.availableQty ?? null,
      currency: it.currency ?? null,
      raw: it,
    })).filter((x) => x.platformSkuId);

    const payload = { items: normalized, fetchedAt: new Date().toISOString() };
    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(payload));
    return { cached: false, ...payload };
  }
}

function toBigIntNumber(x: any): number | null {
  if (x == null || x === '') return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}
