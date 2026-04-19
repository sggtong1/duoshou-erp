import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infra/prisma.module';
import { QueueModule } from './infra/queue.module';
import { HealthModule } from './modules/health/health.module';
import { ShopModule } from './modules/shop/shop.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PlatformModule } from './modules/platform/platform.module';
import { TemuProxyModule } from './modules/temu-proxy/temu-proxy.module';
import { ProductModule } from './modules/product/product.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { MarketingModule } from './modules/marketing/marketing.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    PlatformModule,
    HealthModule,
    TenantModule,
    ShopModule,
    AuthModule,
    TemuProxyModule,
    ProductModule,
    PricingModule,
    MarketingModule,
  ],
})
export class AppModule {}
