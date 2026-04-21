import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [TenantModule, AnalyticsModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
