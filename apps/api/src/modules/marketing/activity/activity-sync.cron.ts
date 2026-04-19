import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivitySyncService } from './activity-sync.service';

@Injectable()
export class ActivitySyncCron {
  private logger = new Logger(ActivitySyncCron.name);
  constructor(private sync: ActivitySyncService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`activity cron: touched ${total}`);
  }
}
