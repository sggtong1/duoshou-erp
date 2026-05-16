import { Body, Controller, Get, Post, Req, UseGuards, UsePipes, Query } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { PriceAdjustmentService } from './price-adjustment.service';
import {
  BatchReviewAdjustmentDto,
  SubmitAdjustmentDto,
  type BatchReviewAdjustmentInput,
  type SubmitAdjustmentInput,
} from './price-adjustment.dto';

@Controller('price-adjustments')
@UseGuards(AuthGuard)
export class PriceAdjustmentController {
  constructor(private svc: PriceAdjustmentService, private tenant: TenantService) {}

  @Get('orders')
  async listPlatformOrders(
    @Req() req: any,
    @Query('shopId') shopId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('priceOrderSn') priceOrderSn?: string,
    @Query('search') search?: string,
    @Query('priceType') priceType?: string,
    @Query('source') source?: string,
    @Query('siteId') siteId?: string,
    @Query('createdAtBegin') createdAtBegin?: string,
    @Query('createdAtEnd') createdAtEnd?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.listPlatformOrders(m.orgId, {
      shopId,
      status: status !== undefined && status !== '' ? Number(status) : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      priceOrderSn,
      search,
      priceType: priceType !== undefined && priceType !== '' ? Number(priceType) : undefined,
      source: source !== undefined && source !== '' ? Number(source) : undefined,
      siteId: siteId !== undefined && siteId !== '' ? Number(siteId) : undefined,
      createdAtBegin: createdAtBegin ? Number(createdAtBegin) : undefined,
      createdAtEnd: createdAtEnd ? Number(createdAtEnd) : undefined,
    });
  }

  @Get('supplier-prices')
  async supplierPrices(
    @Req() req: any,
    @Query('shopId') shopId: string,
    @Query('productSkuIds') productSkuIds: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.getSupplierPrices(m.orgId, shopId, productSkuIds);
  }

  @Post('batch-review')
  @UsePipes(new ZodValidationPipe(BatchReviewAdjustmentDto))
  async batchReview(@Req() req: any, @Body() body: BatchReviewAdjustmentInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.batchReview(m.orgId, body);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(SubmitAdjustmentDto))
  async submit(@Req() req: any, @Body() body: SubmitAdjustmentInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.submit(m.orgId, body);
  }

  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, limit ? Number(limit) : 50);
  }
}
