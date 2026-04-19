import { Module } from '@nestjs/common';
import { PriceReviewService } from './review/price-review.service';
import { PriceReviewController } from './review/price-review.controller';
import { PriceReviewSyncService } from './review/price-review-sync.service';
import { PriceReviewSyncCron } from './review/price-review-sync.cron';

@Module({
  controllers: [PriceReviewController],
  providers: [PriceReviewService, PriceReviewSyncService, PriceReviewSyncCron],
  exports: [PriceReviewService, PriceReviewSyncService],
})
export class PricingModule {}
