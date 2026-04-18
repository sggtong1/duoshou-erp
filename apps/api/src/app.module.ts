import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ShopModule } from './modules/shop/shop.module';

@Module({
  imports: [PrismaModule, HealthModule, ShopModule],
})
export class AppModule {}
