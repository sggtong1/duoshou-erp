import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ShopModule } from './modules/shop/shop.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [PrismaModule, HealthModule, TenantModule, ShopModule, AuthModule],
})
export class AppModule {}
