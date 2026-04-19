import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { PrismaService } from '../../infra/prisma.service';
import { TemuProxyService } from './temu-proxy.service';

@Controller('temu')
@UseGuards(AuthGuard)
export class TemuProxyController {
  constructor(
    private proxy: TemuProxyService,
    private tenant: TenantService,
    private prisma: PrismaService,
  ) {}

  private async assertShopBelongsToUser(req: any, shopId: string) {
    const member = await this.tenant.resolveForUser(req.user);
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.orgId !== member.orgId) {
      throw new BadRequestException('Shop not found or not owned by your organization');
    }
  }

  @Get('categories')
  async categories(
    @Req() req: any,
    @Query('shopId') shopId: string,
    @Query('parentCatId') parentCatId = '0',
  ) {
    if (!shopId) throw new BadRequestException('shopId is required');
    await this.assertShopBelongsToUser(req, shopId);
    return this.proxy.getCategoryChildren(shopId, Number(parentCatId));
  }

  @Get('category-attrs')
  async categoryAttrs(
    @Req() req: any,
    @Query('shopId') shopId: string,
    @Query('catId') catId: string,
  ) {
    if (!shopId || !catId) throw new BadRequestException('shopId and catId required');
    await this.assertShopBelongsToUser(req, shopId);
    return this.proxy.getCategoryAttrs(shopId, Number(catId));
  }
}
