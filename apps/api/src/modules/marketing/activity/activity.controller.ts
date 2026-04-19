import { Controller, Get, HttpCode, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ActivityService } from './activity.service';
import { ActivityProductsService } from './activity-products.service';
import { ActivitySyncService } from './activity-sync.service';

@Controller('activities')
@UseGuards(AuthGuard)
export class ActivityController {
  private logger = new Logger(ActivityController.name);

  constructor(
    private svc: ActivityService,
    private products: ActivityProductsService,
    private tenant: TenantService,
    private sync: ActivitySyncService,
  ) {}

  @Post('sync/now')
  @HttpCode(202)
  async syncNow(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    // fire-and-forget:同步可能跑数分钟,不要阻塞 HTTP;后端后台执行,
    // 用户稍后通过「手动刷新」读到新数据。错误在后台捕获并记录。
    void this.sync.syncAllActiveShops(m.orgId).catch((e: any) => {
      this.logger.error(`org ${m.orgId} activity sync failed in background: ${e.message}`);
    });
    return { accepted: true, startedAt: new Date().toISOString() };
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('shopId') shopId?: string,
    @Query('startAfter') startAfter?: string,
    @Query('startBefore') startBefore?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, {
      region: region as any, status: status as any, search, shopId,
      startAfter, startBefore,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.get(m.orgId, id);
  }

  @Get(':id/products')
  async listProducts(
    @Req() req: any,
    @Param('id') id: string,
    @Query('shopId') shopId: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.products.list(m.orgId, id, shopId);
  }
}
