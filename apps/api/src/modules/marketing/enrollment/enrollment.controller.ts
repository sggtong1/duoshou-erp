import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { EnrollmentService } from './enrollment.service';
import { SubmitEnrollmentDto, type SubmitEnrollmentInput } from './enrollment.dto';

@Controller('enrollments')
@UseGuards(AuthGuard)
export class EnrollmentController {
  constructor(private svc: EnrollmentService, private tenant: TenantService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('activityId') activityId?: string,
    @Query('shopId') shopId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, {
      activityId, shopId, status: status as any,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post('submit')
  @UsePipes(new ZodValidationPipe(SubmitEnrollmentDto))
  async submit(@Req() req: any, @Body() body: SubmitEnrollmentInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.submit(m.orgId, body);
  }

  @Post(':id/refresh')
  async refresh(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.refresh(m.orgId, id);
  }
}
