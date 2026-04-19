import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ZodValidationPipe } from '../../infra/zod-pipe';
import { BulkJobService } from './bulk-job.service';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { DispatchPublishDto, type DispatchPublishInput } from './bulk-job.dto';

@Controller('bulk-jobs')
@UseGuards(AuthGuard)
export class BulkJobController {
  constructor(
    private jobs: BulkJobService,
    private dispatcher: PublishDispatcherService,
    private tenant: TenantService,
  ) {}

  @Post('publish')
  @UsePipes(new ZodValidationPipe(DispatchPublishDto))
  async dispatchPublish(@Req() req: any, @Body() body: DispatchPublishInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.dispatcher.dispatch(m.orgId, body.templateId, body.shopIds, {
      priceCentsOverrides: body.priceCentsOverrides,
      semiSitesByShop: body.semiSitesByShop,
      freightTemplatesByShop: body.freightTemplatesByShop,
    });
  }

  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.jobs.list(m.orgId, limit ? Number(limit) : 20);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.jobs.get(m.orgId, id);
  }
}
