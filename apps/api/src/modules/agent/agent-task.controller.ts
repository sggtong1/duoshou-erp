import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ZodValidationPipe } from '../../infra/zod-pipe';
import { AgentTaskService } from './agent-task.service';
import {
  ClaimTasksDto,
  CreateTaskDto,
  HeartbeatDto,
  ListTasksDto,
  ReportResultDto,
  type ClaimTasksInput,
  type CreateTaskInput,
  type HeartbeatInput,
  type ReportResultInput,
} from './agent-task.dto';

/**
 * Agent Task 队列接口
 *
 * 来自 ERP UI 的：create / list / get / cancel
 * 来自 Chrome 插件的：claim / heartbeat / report-result
 *
 * 目前两端共用同一个 user JWT（AuthGuard）。pluginInstanceId 只是用于多插件之间
 * 区分租约归属，不是身份验证。
 */
@Controller('agent/tasks')
@UseGuards(AuthGuard)
export class AgentTaskController {
  constructor(
    private svc: AgentTaskService,
    private tenant: TenantService,
  ) {}

  // ── ERP UI / cron ───────────────────────────────────────────────────────────
  @Post()
  @UsePipes(new ZodValidationPipe(CreateTaskDto))
  async create(@Req() req: any, @Body() body: CreateTaskInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.create(m.orgId, req.user?.id ?? null, body);
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('shopId') shopId?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    const parsed = ListTasksDto.safeParse({ shopId, status, kind, limit });
    if (!parsed.success) throw new BadRequestException(parsed.error.format());
    return this.svc.list(m.orgId, parsed.data);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    const t = await this.svc.findOne(m.orgId, id);
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.cancel(m.orgId, id);
  }

  // ── 插件端 ──────────────────────────────────────────────────────────────────
  @Post('claim')
  @UsePipes(new ZodValidationPipe(ClaimTasksDto))
  async claim(@Req() req: any, @Body() body: ClaimTasksInput) {
    const m = await this.tenant.resolveForUser(req.user);
    const tasks = await this.svc.claim(m.orgId, body);
    return { tasks };
  }

  @Post(':id/heartbeat')
  async heartbeat(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HeartbeatDto)) body: HeartbeatInput,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.heartbeat(m.orgId, id, body);
  }

  @Post(':id/result')
  async result(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReportResultDto)) body: ReportResultInput,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.reportResult(m.orgId, id, body);
  }
}
