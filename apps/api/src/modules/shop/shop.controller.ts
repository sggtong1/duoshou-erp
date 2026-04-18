import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ConnectShopDto, type ConnectShopInput } from './shop.dto';
import { ZodValidationPipe } from '../../infra/zod-pipe';

// TODO W0-T14: derive orgId from authenticated request context
// For now, use DEV_ORG_ID env var for integration testing
const HARDCODED_ORG_ID = process.env.DEV_ORG_ID ?? '00000000-0000-0000-0000-000000000000';

@Controller('shops')
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ConnectShopDto))
  connect(@Body() body: ConnectShopInput) {
    return this.shopService.connect(HARDCODED_ORG_ID, body);
  }

  @Get()
  list() {
    return this.shopService.list(HARDCODED_ORG_ID);
  }
}
