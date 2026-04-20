import { Body, Controller, Get, Post, UsePipes, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ShopService } from './shop.service';
import { ConnectShopDto, type ConnectShopInput, TestConnectionDto, type TestConnectionInput } from './shop.dto';
import { ZodValidationPipe } from '../../infra/zod-pipe';

@Controller('shops')
@UseGuards(AuthGuard)
export class ShopController {
  constructor(
    private shopService: ShopService,
    private tenant: TenantService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ConnectShopDto))
  async connect(@Req() req: any, @Body() body: ConnectShopInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.shopService.connect(m.orgId, body);
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
}
