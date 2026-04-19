import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infra/prisma.service';
import { ProductSyncService } from './product-sync.service';

@Injectable()
export class ProductSyncCron {
  private logger = new Logger(ProductSyncCron.name);
  constructor(
    private prisma: PrismaService,
    private sync: ProductSyncService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllOrgs() {
    const orgs = await (this.prisma as any).organization.findMany({
      where: { status: 'active' },
    });
    for (const o of orgs) {
      try { await this.sync.syncAllShopsForOrg(o.id); }
      catch (e: any) { this.logger.error(`org ${o.id} sync failed: ${e.message}`); }
    }
  }
}
