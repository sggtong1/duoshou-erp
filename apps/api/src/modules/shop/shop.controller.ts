import { Body, Controller, Delete, Get, Logger, Param, Post, UsePipes, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ShopService } from './shop.service';
import { SkuSnapshotSyncService } from '../analytics/snapshot/sku-snapshot-sync.service';
import { ProductSyncService } from '../product/sync/product-sync.service';
import { ConnectShopDto, type ConnectShopInput, TestConnectionDto, type TestConnectionInput } from './shop.dto';
import { ZodValidationPipe } from '../../infra/zod-pipe';

@Controller('shops')
@UseGuards(AuthGuard)
export class ShopController {
  private logger = new Logger(ShopController.name);

  constructor(
    private shopService: ShopService,
    private tenant: TenantService,
    private snapshotSync: SkuSnapshotSyncService,
    private productSync: ProductSyncService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ConnectShopDto))
  async connect(@Req() req: any, @Body() body: ConnectShopInput) {
    const m = await this.tenant.resolveForUser(req.user);
    const shop = await this.shopService.connect(m.orgId, body);
    // UX:连店后立即触发 SKU snapshot(Dashboard 数据源)+ product(「我的商品」数据源)同步,
    // 避免用户打开任何页面看到空白。
    if (shop?.id && shop.shopType === 'full') {
      void this.snapshotSync.syncShop(shop.id).catch((e: any) => {
        this.logger.error(`shop ${shop.id} initial snapshot sync failed: ${e.message}`);
      });
      void this.productSync.syncShop(shop.id).catch((e: any) => {
        this.logger.error(`shop ${shop.id} initial product sync failed: ${e.message}`);
      });
    }
    return shop;
  }

  @Post('test-connection')
  @UsePipes(new ZodValidationPipe(TestConnectionDto))
  async testConnection(@Body() body: TestConnectionInput) {
    return this.shopService.testConnection(body);
  }

  @Get()
  async list(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.shopService.list(m.orgId);
  }

  @Delete(':id')
  async disconnect(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.shopService.disconnect(m.orgId, id);
  }
}
