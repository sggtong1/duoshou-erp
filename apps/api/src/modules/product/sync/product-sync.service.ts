import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';

@Injectable()
export class ProductSyncService {
  private logger = new Logger(ProductSyncService.name);
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async syncShop(shopId: string): Promise<number> {
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop) { this.logger.warn(`shop ${shopId} missing`); return 0; }
    const client = await this.clientFactory.forShop(shopId);
    const interfaceType = shop.region === 'pa' ? 'bg.glo.goods.list.get' : 'bg.goods.list.get';
    const res: any = await client.call(interfaceType, { pageNum: 1, pageSize: 50 });
    const list: any[] = res?.goodsList ?? res?.list ?? [];
    let touched = 0;
    for (const g of list) {
      const platformProductId = String(g.productId ?? g.spuId ?? '');
      if (!platformProductId) continue;
      await (this.prisma as any).product.upsert({
        where: { shopId_platformProductId: { shopId, platformProductId } },
        create: {
          orgId: shop.orgId,
          shopId,
          platform: 'temu',
          platformProductId,
          title: g.productName ?? g.title ?? '',
          status: g.productStatus ?? 'unknown',
          platformSpecific: g,
        },
        update: {
          title: g.productName ?? g.title ?? '',
          status: g.productStatus ?? 'unknown',
          platformSpecific: g,
          lastSyncedAt: new Date(),
        },
      });
      touched++;
    }
    this.logger.log(`synced ${touched} products for shop ${shopId}`);
    return touched;
  }

  async syncAllShopsForOrg(orgId: string): Promise<number> {
    const shops = await (this.prisma as any).shop.findMany({
      where: { orgId, status: 'active' },
    });
    let total = 0;
    for (const s of shops) {
      try { total += await this.syncShop(s.id); }
      catch (e: any) { this.logger.error(`sync failed for shop ${s.id}: ${e.message}`); }
    }
    return total;
  }
}
