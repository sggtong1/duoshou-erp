import { Module } from '@nestjs/common';
import { TemuProxyController } from './temu-proxy.controller';
import { TemuProxyService } from './temu-proxy.service';

@Module({
  controllers: [TemuProxyController],
  providers: [TemuProxyService],
  exports: [TemuProxyService],
})
export class TemuProxyModule {}
