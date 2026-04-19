import { Body, Controller, Get, HttpCode, Logger, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentSyncService } from './enrollment-sync.service';
import { SubmitEnrollmentDto, type SubmitEnrollmentInput } from './enrollment.dto';

@Controller('enrollments')
@UseGuards(AuthGuard)
export class EnrollmentController {
  private logger = new Logger(EnrollmentController.name);

  constructor(
    private svc: EnrollmentService,
    private tenant: TenantService,
    private syncSvc: EnrollmentSyncService,
  ) {}

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

  @Post('sync/now')
  @HttpCode(202)
  async syncNow(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    // fire-and-forget:同步可能跑数分钟,不要阻塞 HTTP;后端后台执行,
    // 用户稍后通过「手动刷新」读到新数据。错误在后台捕获并记录。
    void this.syncSvc.syncAllActiveShops(m.orgId).catch((e: any) => {
      this.logger.error(`org ${m.orgId} enrollment sync failed in background: ${e.message}`);
    });
    return { accepted: true, startedAt: new Date().toISOString() };
  }
}
