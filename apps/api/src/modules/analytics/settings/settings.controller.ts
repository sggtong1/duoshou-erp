import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, type UpdateSettingsInput } from './settings.dto';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private svc: SettingsService, private tenant: TenantService) {}

  @Get()
  async get(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.get(m.orgId);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateSettingsDto))
  async update(@Req() req: any, @Body() body: UpdateSettingsInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.update(m.orgId, body);
  }
}
