import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PriceReviewSyncService } from './price-review-sync.service';

@Injectable()
export class PriceReviewSyncCron {
  private logger = new Logger(PriceReviewSyncCron.name);
  constructor(private sync: PriceReviewSyncService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`cron: touched ${total} reviews`);
  }
}
