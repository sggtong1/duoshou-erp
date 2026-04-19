import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ActivityService } from './activity.service';
import { ActivityProductsService } from './activity-products.service';

@Controller('activities')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(
    private svc: ActivityService,
    private products: ActivityProductsService,
    private tenant: TenantService,
  ) {}

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
