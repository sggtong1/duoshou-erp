import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { AgentResultIngestor } from './ingestors/agent-result-ingestor.service';
import type {
  CreateTaskInput, ListTasksInput, ClaimTasksInput, ReportResultInput, HeartbeatInput,
} from './agent-task.dto';

export interface TaskRecord {
  id: string;
  org_id: string;
  shop_id: string | null;
  kind: string;
  payload: any;
  status: string;
  plugin_instance_id: string | null;
  attempts: number;
  max_attempts: number;
  priority: number;
  created_at: Date;
  claimed_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
  result: any;
  error_code: string | null;
  error_message: string | null;
}

@Injectable()
export class AgentTaskService {
  private readonly logger = new Logger(AgentTaskService.name);

  constructor(
    private prisma: PrismaService,
    private ingestor: AgentResultIngestor,
  ) {}

  // ── 创建任务（来自 ERP UI / cron） ─────────────────────────────────
  async create(orgId: string, userId: string | null, input: CreateTaskInput) {
    return (this.prisma as any).agentTask.create({
      data: {
        orgId,
        shopId: input.shopId ?? null,
        createdBy: userId,
        kind: input.kind,
        payload: input.payload ?? {},
        priority: input.priority ?? 0,
        maxAttempts: input.maxAttempts ?? 3,
      },
    });
  }

  // ── 列表 ─────────────────────────────────────────────────────────
  async list(orgId: string, q: ListTasksInput) {
    return (this.prisma as any).agentTask.findMany({
      where: {
        orgId,
        ...(q.shopId ? { shopId: q.shopId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: q.limit,
    });
  }

  // ── 单条详情 ────────────────────────────────────────────────────
  async findOne(orgId: string, id: string) {
    return (this.prisma as any).agentTask.findFirst({ where: { id, orgId } });
  }

  // ── 取消（仅 pending / claimed） ──────────────────────────────────
  async cancel(orgId: string, id: string) {
    const r = await (this.prisma as any).agentTask.updateMany({
      where: { id, orgId, status: { in: ['pending', 'claimed'] } },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    return { cancelled: r.count === 1 };
  }

  // ── 原子领取（插件长轮询） ─────────────────────────────────────
  // 用 Postgres FOR UPDATE SKIP LOCKED 保证多插件并发安全
  async claim(orgId: string, input: ClaimTasksInput): Promise<TaskRecord[]> {
    const expires = new Date(Date.now() + input.leaseSeconds * 1000);
    const hasShopFilter = input.shopIds && input.shopIds.length > 0;

    // 两条独立 SQL，避免动态 $n 偏移
    const sqlWithShops = `
      WITH picked AS (
        SELECT id FROM agent_task
        WHERE org_id = $1 AND status = 'pending' AND shop_id = ANY($2::text[])
        ORDER BY priority DESC, created_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      UPDATE agent_task t
      SET status = 'claimed', plugin_instance_id = $4,
          attempts = attempts + 1, claimed_at = NOW(), expires_at = $5
      WHERE t.id IN (SELECT id FROM picked)
      RETURNING *;
    `;
    const sqlAllShops = `
      WITH picked AS (
        SELECT id FROM agent_task
        WHERE org_id = $1 AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE agent_task t
      SET status = 'claimed', plugin_instance_id = $3,
          attempts = attempts + 1, claimed_at = NOW(), expires_at = $4
      WHERE t.id IN (SELECT id FROM picked)
      RETURNING *;
    `;

    const rows: TaskRecord[] = hasShopFilter
      ? await (this.prisma as any).$queryRawUnsafe(
          sqlWithShops, orgId, input.shopIds, input.limit, input.pluginInstanceId, expires,
        )
      : await (this.prisma as any).$queryRawUnsafe(
          sqlAllShops, orgId, input.limit, input.pluginInstanceId, expires,
        );
    this.logger.debug(`agent.claim org=${orgId} plugin=${input.pluginInstanceId} → ${rows.length} task(s)`);
    return rows;
  }

  // ── 心跳 / 续租 ───────────────────────────────────────────────
  async heartbeat(orgId: string, id: string, input: HeartbeatInput) {
    const expires = new Date(Date.now() + input.leaseSeconds * 1000);
    const r = await (this.prisma as any).agentTask.updateMany({
      where: {
        id, orgId,
        status: { in: ['claimed', 'running'] },
        pluginInstanceId: input.pluginInstanceId,
      },
      data: { expiresAt: expires, status: 'running', startedAt: new Date() },
    });
    return { ok: r.count === 1 };
  }

  // ── 上报结果 ─────────────────────────────────────────────────────
  // 成功 → success；失败：判断是否还有重试次数 — 是则回 pending，否则 failed
  async reportResult(orgId: string, id: string, input: ReportResultInput) {
    const task = await (this.prisma as any).agentTask.findFirst({
      where: { id, orgId, pluginInstanceId: input.pluginInstanceId },
    });
    if (!task) return { ok: false, reason: 'not-owner-or-not-found' };
    if (task.status === 'success' || task.status === 'failed' || task.status === 'cancelled') {
      return { ok: false, reason: 'already-final' };
    }

    if (input.status === 'success') {
      const updated = await (this.prisma as any).agentTask.update({
        where: { id },
        data: {
          status: 'success',
          result: (input.result ?? null) as any,
          completedAt: new Date(),
          pluginInstanceId: null,
        },
      });

      // 异步 ingest，不阻塞 result API 的响应
      // 失败仅打 log，不影响 task 标 success（业务回执已经存在 agent_task.result）
      this.ingestor
        .ingest({
          id: updated.id,
          kind: updated.kind,
          shopId: updated.shopId,
          orgId: updated.orgId,
          result: updated.result,
          payload: updated.payload,
        })
        .then((r) => {
          if (r.ingested) this.logger.log(`ingest done task=${id.slice(0, 8)} rows=${r.rowsAffected}`);
        })
        .catch((e) => this.logger.warn(`ingest failed task=${id.slice(0, 8)}: ${e?.message ?? e}`));

      return { ok: true, finalStatus: 'success' };
    }

    // failed
    const canRetry = task.attempts < task.maxAttempts;
    await (this.prisma as any).agentTask.update({
      where: { id },
      data: {
        status: canRetry ? 'pending' : 'failed',
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        pluginInstanceId: null,
        claimedAt: null,
        expiresAt: null,
        ...(canRetry ? {} : { completedAt: new Date() }),
      },
    });
    return { ok: true, finalStatus: canRetry ? 'pending' : 'failed' };
  }

  // ── 服务端 sweeper：把超过 lease 的 claimed/running 回收成 pending ─
  // 应在 cron 每 60s 调用一次
  async sweepExpired(): Promise<number> {
    const r = await (this.prisma as any).agentTask.updateMany({
      where: {
        status: { in: ['claimed', 'running'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'pending', pluginInstanceId: null, claimedAt: null, expiresAt: null },
    });
    if (r.count > 0) this.logger.warn(`sweepExpired requeued ${r.count} stalled task(s)`);
    return r.count;
  }
}
