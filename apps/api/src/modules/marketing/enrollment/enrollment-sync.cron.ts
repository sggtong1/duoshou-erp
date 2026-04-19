import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnrollmentSyncService } from './enrollment-sync.service';

@Injectable()
export class EnrollmentSyncCron {
  private logger = new Logger(EnrollmentSyncCron.name);
  constructor(private sync: EnrollmentSyncService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`enrollment cron: touched ${total}`);
  }
}
