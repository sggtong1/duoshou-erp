import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';

@Module({
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService],
  exports: [ProductTemplateService],
})
export class ProductModule {}
