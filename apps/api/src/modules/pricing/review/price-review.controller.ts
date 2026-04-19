import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { PriceReviewService } from './price-review.service';
import {
  BatchConfirmDto, BatchRejectDto,
  type BatchConfirmInput, type BatchRejectInput,
} from './price-review.dto';

@Controller('price-reviews')
@UseGuards(AuthGuard)
export class PriceReviewController {
  constructor(private svc: PriceReviewService, private tenant: TenantService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('shopId') shopId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, {
      shopId, status: status as any, search,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.get(m.orgId, id);
  }

  @Post('batch-confirm')
  @UsePipes(new ZodValidationPipe(BatchConfirmDto))
  async batchConfirm(@Req() req: any, @Body() body: BatchConfirmInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.batchConfirm(m.orgId, body.reviewIds);
  }

  @Post('batch-reject')
  @UsePipes(new ZodValidationPipe(BatchRejectDto))
  async batchReject(@Req() req: any, @Body() body: BatchRejectInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.batchReject(m.orgId, body.reviewIds, body.counterPriceCents);
  }
}
