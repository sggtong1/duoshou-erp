import { Body, Controller, Get, Post, Req, UseGuards, UsePipes, Query } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { PriceAdjustmentService } from './price-adjustment.service';
import { SubmitAdjustmentDto, type SubmitAdjustmentInput } from './price-adjustment.dto';

@Controller('price-adjustments')
@UseGuards(AuthGuard)
export class PriceAdjustmentController {
  constructor(private svc: PriceAdjustmentService, private tenant: TenantService) {}

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
