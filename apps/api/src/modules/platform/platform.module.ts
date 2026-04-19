import { Global, Module } from '@nestjs/common';
import { TemuClientFactoryService } from './temu/temu-client-factory.service';

@Global()
@Module({
  providers: [TemuClientFactoryService],
  exports: [TemuClientFactoryService],
})
export class PlatformModule {}
