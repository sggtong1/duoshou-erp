import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/prisma.module';
import { QueueModule } from './infra/queue.module';
import { HealthModule } from './modules/health/health.module';
import { ShopModule } from './modules/shop/shop.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PlatformModule } from './modules/platform/platform.module';

@Module({
  imports: [PrismaModule, QueueModule, PlatformModule, HealthModule, TenantModule, ShopModule, AuthModule],
})
export class AppModule {}
