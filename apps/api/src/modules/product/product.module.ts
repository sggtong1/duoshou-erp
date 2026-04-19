import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { PublishProcessor } from './publish/publish.processor';
import { BulkJobService } from './bulk-job.service';
import { BulkJobController } from './bulk-job.controller';
import { ProductSyncService } from './sync/product-sync.service';
import { ProductSyncCron } from './sync/product-sync.cron';

@Module({
  controllers: [ProductTemplateController, BulkJobController],
  providers: [
    ProductTemplateService,
    PublishDispatcherService,
    PublishProcessor,
    BulkJobService,
    ProductSyncService,
    ProductSyncCron,
  ],
  exports: [ProductTemplateService, PublishDispatcherService, ProductSyncService],
})
export class ProductModule {}
