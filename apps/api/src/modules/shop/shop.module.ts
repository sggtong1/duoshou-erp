import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ProductModule } from '../product/product.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [TenantModule, AnalyticsModule, ProductModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
