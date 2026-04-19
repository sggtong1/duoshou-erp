import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ActivityProductsService } from './activity/activity-products.service';
import { ActivitySyncService } from './activity/activity-sync.service';
import { ActivitySyncCron } from './activity/activity-sync.cron';
import { EnrollmentController } from './enrollment/enrollment.controller';
import { EnrollmentService } from './enrollment/enrollment.service';
import { EnrollmentSyncService } from './enrollment/enrollment-sync.service';
import { EnrollmentSyncCron } from './enrollment/enrollment-sync.cron';

@Module({
  controllers: [ActivityController, EnrollmentController],
  providers: [ActivityService, ActivityProductsService, ActivitySyncService, ActivitySyncCron, EnrollmentService, EnrollmentSyncService, EnrollmentSyncCron],
  exports: [ActivityService, ActivityProductsService, ActivitySyncService, EnrollmentService, EnrollmentSyncService],
})
export class MarketingModule {}
