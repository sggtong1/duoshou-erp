import { Module } from '@nestjs/common';
import { PriceReviewService } from './review/price-review.service';
import { PriceReviewController } from './review/price-review.controller';
import { PriceReviewSyncService } from './review/price-review-sync.service';
import { PriceReviewSyncCron } from './review/price-review-sync.cron';
import { PriceAdjustmentService } from './adjustment/price-adjustment.service';
import { PriceAdjustmentController } from './adjustment/price-adjustment.controller';

@Module({
  controllers: [PriceReviewController, PriceAdjustmentController],
  providers: [PriceReviewService, PriceReviewSyncService, PriceReviewSyncCron, PriceAdjustmentService],
  exports: [PriceReviewService, PriceReviewSyncService, PriceAdjustmentService],
})
export class PricingModule {}
