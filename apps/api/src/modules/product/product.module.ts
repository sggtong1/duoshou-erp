import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { PublishProcessor } from './publish/publish.processor';
import { BulkJobService } from './bulk-job.service';
import { BulkJobController } from './bulk-job.controller';

@Module({
  controllers: [ProductTemplateController, BulkJobController],
  providers: [ProductTemplateService, PublishDispatcherService, PublishProcessor, BulkJobService],
  exports: [ProductTemplateService, PublishDispatcherService],
})
export class ProductModule {}
