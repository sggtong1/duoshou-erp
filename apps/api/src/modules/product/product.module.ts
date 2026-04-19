import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { PublishProcessor } from './publish/publish.processor';

@Module({
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService, PublishDispatcherService, PublishProcessor],
  exports: [ProductTemplateService, PublishDispatcherService],
})
export class ProductModule {}
