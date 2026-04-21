import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { sharedRedis } from '../../../infra/redis';

const LOCK_KEY = 'lock:sku-snapshot-sync';
const LOCK_TTL_SECONDS = 1800;
const PAGE_SIZE = 50;
const MAX_PAGES = 200;

function toIntOr0(x: any): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function supplierPriceToCents(x: any): bigint | null {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n * 100));
}

@Injectable()
export class SkuSnapshotSyncService {
  private logger = new Logger(SkuSnapshotSyncService.name);
  private get redis(): Redis { return sharedRedis(); }

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async syncShop(shopId: string): Promise<number> {
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop) return 0;
    if (shop.shopType !== 'full') {
      this.logger.log(`shop ${shopId} (shopType=${shop.shopType}) skipped — only full shops are supported`);
      return 0;
    }

    const client = await this.clientFactory.forShop(shopId);
    let touched = 0;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      let res: any;
      try {
        res = await client.call('bg.goods.salesv2.get', { pageNo, pageSize: PAGE_SIZE });
      } catch (e: any) {
        this.logger.warn(`shop ${shopId} salesv2.get failed at pageNo=${pageNo}: ${e.message}`);
        break;
      }
      const list: any[] = res?.subOrderList ?? [];
      if (!list.length) break;

      for (const spu of list) {
        const skuDetails: any[] = spu?.skuQuantityDetailList ?? [];
        for (const sku of skuDetails) {
          const platformSkuId = String(sku.productSkuId ?? '');
          if (!platformSkuId) continue;

          const sales30d = toIntOr0(sku.lastThirtyDaysSaleVolume);
          const warehouseQty = toIntOr0(sku?.inventoryNumInfo?.warehouseInventoryNum);
          const avgDailySales = sales30d / 30;
          const daysRemaining = avgDailySales > 0 ? warehouseQty / avgDailySales : null;

          const data = {
            orgId: shop.orgId,
            shopId,
            platformSkuId,
            productName: spu.productName ?? null,
            className: sku.className ?? null,
            skuExtCode: sku.skuExtCode ?? null,
            todaySaleVolume: toIntOr0(sku.todaySaleVolume),
            sales7dVolume: toIntOr0(sku.lastSevenDaysSaleVolume),
            sales30dVolume: sales30d,
            totalSaleVolume: toIntOr0(sku.totalSaleVolume),
            warehouseQty,
            waitReceiveQty: toIntOr0(sku?.inventoryNumInfo?.waitReceiveNum),
            waitOnShelfQty: toIntOr0(sku?.inventoryNumInfo?.waitOnShelfNum),
            waitDeliveryQty: toIntOr0(sku?.inventoryNumInfo?.waitDeliveryInventoryNum),
            avgDailySales,
            daysRemaining,
            supplierPriceCents: supplierPriceToCents(sku.supplierPrice),
            platformPayload: sku,
          };

          await (this.prisma as any).shopSkuSnapshot.upsert({
            where: { shopId_platformSkuId: { shopId, platformSkuId } },
            create: data,
            update: data,
          });
          touched++;
        }
      }

      if (list.length < PAGE_SIZE) break;
    }

    this.logger.log(`shop ${shopId} synced ${touched} SKU snapshots`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    let lock: string | null = null;
    try { lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX'); }
    catch (e: any) { this.logger.warn(`sku-snapshot lock acquire failed: ${e.message}`); }
    if (lock !== 'OK') {
      this.logger.warn('sku-snapshot sync skipped (lock held or redis down)');
      return 0;
    }
    try {
      const where: any = { status: 'active', shopType: 'full' };
      if (orgId) where.orgId = orgId;
      const shops = await (this.prisma as any).shop.findMany({ where });
      let total = 0;
      for (const s of shops) {
        try { total += await this.syncShop(s.id); }
        catch (e: any) { this.logger.error(`shop ${s.id} snapshot sync failed: ${e.message}`); }
      }
      return total;
    } finally {
      try { await this.redis.del(LOCK_KEY); }
      catch (e: any) { this.logger.warn(`sku-snapshot lock release failed: ${e.message}`); }
    }
  }
}
