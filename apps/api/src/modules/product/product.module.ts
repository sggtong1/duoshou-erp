import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';

@Module({
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService, PublishDispatcherService],
  exports: [ProductTemplateService, PublishDispatcherService],
})
export class ProductModule {}
