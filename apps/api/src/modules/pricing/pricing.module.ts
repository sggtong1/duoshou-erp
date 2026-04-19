import { Module } from '@nestjs/common';
import { PriceReviewService } from './review/price-review.service';
import { PriceReviewController } from './review/price-review.controller';

@Module({
  controllers: [PriceReviewController],
  providers: [PriceReviewService],
  exports: [PriceReviewService],
})
export class PricingModule {}
