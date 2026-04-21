import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SkuSnapshotSyncService } from './sku-snapshot-sync.service';

@Injectable()
export class SkuSnapshotSyncCron {
  private logger = new Logger(SkuSnapshotSyncCron.name);
  constructor(private sync: SkuSnapshotSyncService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`sku-snapshot cron: touched ${total}`);
  }
}
