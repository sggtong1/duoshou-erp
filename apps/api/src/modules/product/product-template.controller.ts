import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ZodValidationPipe } from '../../infra/zod-pipe';
import { ProductTemplateService } from './product-template.service';
import {
  CreateProductTemplateDto,
  UpdateProductTemplateDto,
  type CreateProductTemplateInput,
  type UpdateProductTemplateInput,
} from './product-template.dto';

@Controller('product-templates')
@UseGuards(AuthGuard)
export class ProductTemplateController {
  constructor(private svc: ProductTemplateService, private tenant: TenantService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateProductTemplateDto))
  async create(@Req() req: any, @Body() body: CreateProductTemplateInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.create(m.orgId, body);
  }

  @Get()
  async list(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.findOne(m.orgId, id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateProductTemplateDto))
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateProductTemplateInput,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.update(m.orgId, id, body);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.delete(m.orgId, id);
  }
}
