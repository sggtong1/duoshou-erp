import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ActivityProductsService } from './activity/activity-products.service';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ActivityProductsService],
  exports: [ActivityService, ActivityProductsService],
})
export class MarketingModule {}
