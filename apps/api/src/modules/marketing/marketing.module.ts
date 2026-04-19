import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ActivityProductsService } from './activity/activity-products.service';
import { ActivitySyncService } from './activity/activity-sync.service';
import { ActivitySyncCron } from './activity/activity-sync.cron';
import { EnrollmentController } from './enrollment/enrollment.controller';
import { EnrollmentService } from './enrollment/enrollment.service';

@Module({
  controllers: [ActivityController, EnrollmentController],
  providers: [ActivityService, ActivityProductsService, ActivitySyncService, ActivitySyncCron, EnrollmentService],
  exports: [ActivityService, ActivityProductsService, ActivitySyncService, EnrollmentService],
})
export class MarketingModule {}
