import { Controller, Get, HttpCode, Logger, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { DashboardService } from './dashboard.service';
import { SkuSnapshotSyncService } from '../snapshot/sku-snapshot-sync.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  private logger = new Logger(DashboardController.name);

  constructor(
    private svc: DashboardService,
    private sync: SkuSnapshotSyncService,
    private tenant: TenantService,
  ) {}

  @Get('summary')
  async summary(@Req() req: any, @Query('shopId') shopId?: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.summary(m.orgId, { shopId });
  }

  @Post('sync/now')
  @HttpCode(202)
  async syncNow(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    void this.sync.syncAllActiveShops(m.orgId).catch((e: any) => {
      this.logger.error(`org ${m.orgId} sku-snapshot sync failed in background: ${e.message}`);
    });
    return { accepted: true, startedAt: new Date().toISOString() };
  }
}
