import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';

/**
 * AgentResultIngestor
 *
 * Agent 任务上报 success 时被调用，根据 task.kind 把结果落到对应业务表。
 *
 * 现状（Step 1）：
 *   - 骨架建好 + 按 kind 派发
 *   - 各 kind 处理器目前只打 log，不真正写库
 *   - stub 结果（result.stub === true）直接跳过
 *
 * 后续步骤：
 *   Step 3-A：marketing-activity 真 UPSERT 到 Activity / ActivityEnrollment
 *   Step 3-B：其它 kind 逐个补
 *
 * 设计原则：
 *   - 这是 best-effort：ingest 出错不影响 task 标 success（业务跟踪在 ingest_log）
 *   - 不长期阻塞 result API 响应（所以 reportResult 那边 fire-and-forget）
 */
@Injectable()
export class AgentResultIngestor {
  private readonly logger = new Logger(AgentResultIngestor.name);

  constructor(private prisma: PrismaService) {}

  async ingest(task: {
    id: string;
    kind: string;
    shopId: string | null;
    orgId: string;
    result: any;
    payload: any;
  }): Promise<{ ingested: boolean; rowsAffected?: number; reason?: string }> {
    if (!task.result || typeof task.result !== 'object') {
      return { ingested: false, reason: 'empty-result' };
    }

    // stub 结果是占位符（dispatch 还没真接到 transform）—— 跳过
    if ((task.result as any).stub === true) {
      this.logger.log(
        `[ingest] task ${task.id.slice(0, 8)} kind=${task.kind} stub 占位 → 跳过入库（dispatch 接真 transform 后会自动有效）`,
      );
      return { ingested: false, reason: 'stub' };
    }

    switch (task.kind) {
      case 'scrape:marketing-activity':
        return this.ingestMarketingActivity(task);

      // TODO[Step3-B]：以下 kind 逐个补 handler
      case 'scrape:activity-data':
      case 'scrape:settlement':
      case 'scrape:flux-analysis':
      case 'scrape:sales-30d':
      case 'scrape:declared-price':
      case 'scrape:promo':
        this.logger.debug(
          `[ingest] kind=${task.kind} 还没接 handler，task.result 已存到 agent_task.result`,
        );
        return { ingested: false, reason: 'no-handler-yet' };

      default:
        this.logger.warn(`[ingest] 未知 kind=${task.kind}，无法 ingest`);
        return { ingested: false, reason: 'unknown-kind' };
    }
  }

  // ── 营销活动 ingest（真 UPSERT） ──────────────────────────────────
  // 插件 transform/activity_transform.js 输出 "SKU × 日期" 粒度的行：
  //   [{ '日期','店铺名称','sku_id','活动ID','活动名称','活动类型','活动价格'(元),
  //      '日常价格'(元),'ext_code','活动开始时间','活动结束时间' }, ...]
  //
  // 落库策略：
  //   1. 按 活动ID group → UPSERT Activity (org × region × platformActivityId)
  //   2. 同一活动里 (SKU × 日期) → 同一 SKU 取最新非空价格 → UPSERT ActivityEnrollment
  //      (因为 ActivityEnrollment 的唯一键不含日期，同一 SKU 在多天里只存最新一条)
  //
  // 注意：插件传的"活动价格"是 元，DB 里 activityPriceCents 是 分，× 100 转换
  private async ingestMarketingActivity(task: {
    id: string;
    shopId: string | null;
    orgId: string;
    result: any;
  }) {
    const rows = Array.isArray(task.result?.rows)
      ? task.result.rows
      : Array.isArray(task.result)
        ? task.result
        : [];

    if (rows.length === 0) {
      this.logger.log(`[ingest:marketing-activity] task ${task.id.slice(0, 8)} 收到 0 行`);
      return { ingested: true, rowsAffected: 0 };
    }
    if (!task.shopId) {
      this.logger.warn(`[ingest:marketing-activity] task ${task.id.slice(0, 8)} 没有 shopId，跳过`);
      return { ingested: false, reason: 'no-shopId' };
    }

    const shop = await (this.prisma as any).shop.findUnique({ where: { id: task.shopId } });
    if (!shop) {
      return { ingested: false, reason: 'shop-not-found' };
    }
    const orgId = shop.orgId;
    const region = shop.region;  // 跟现有 enrollment-sync 保持一致

    // 1. 按 活动ID group
    const byActivity = new Map<string, { meta: any; rows: any[] }>();
    for (const r of rows) {
      const aid = String(r['活动ID'] ?? r.activityId ?? '').trim();
      if (!aid) continue;
      let g = byActivity.get(aid);
      if (!g) { g = { meta: r, rows: [] }; byActivity.set(aid, g); }
      g.rows.push(r);
    }

    let activitiesUpserted = 0;
    let enrollmentsUpserted = 0;
    let enrollmentsFailed = 0;

    for (const [platformActivityId, group] of byActivity) {
      const meta = group.meta;
      const startAt = meta['活动开始时间'] ? new Date(meta['活动开始时间']) : null;
      const endAt   = meta['活动结束时间'] ? new Date(meta['活动结束时间']) : null;
      const status  = endAt && endAt.getTime() < Date.now() ? 'ended' : 'open';

      // ── UPSERT Activity ─────────────────────────────────────────
      const activityCommon = {
        title: meta['活动名称'] ?? null,
        activityType: meta['活动类型'] ?? null,
        startAt, endAt,
        status,
        platformPayload: meta as any,
      };
      const activity = await (this.prisma as any).activity.upsert({
        where: { orgId_region_platformActivityId: { orgId, region, platformActivityId } },
        create: { orgId, region, platformActivityId, ...activityCommon },
        update: activityCommon,
      });
      activitiesUpserted++;

      // ── UPSERT ActivityEnrollment ────────────────────────────────
      // 同 SKU 多天 → 折叠为一条，价格取最新非空
      const skuLatest = new Map<string, any>();
      for (const r of group.rows) {
        const skuId = String(r['sku_id'] ?? r.skuId ?? '').trim();
        if (!skuId) continue;
        const cur = skuLatest.get(skuId);
        if (!cur) { skuLatest.set(skuId, r); continue; }
        // 价格非空 优先
        if (r['活动价格'] != null && cur['活动价格'] == null) skuLatest.set(skuId, r);
        // 否则按日期更晚的优先
        else if ((r['日期'] || '') > (cur['日期'] || '')) skuLatest.set(skuId, r);
      }

      for (const [platformSkuId, r] of skuLatest) {
        try {
          const priceYuan = r['活动价格'];
          const activityPriceCents = priceYuan != null
            ? BigInt(Math.round(Number(priceYuan) * 100))
            : null;

          const createData = {
            orgId,
            shopId: task.shopId!,
            activityId: activity.id,
            sessionId: null as string | null,
            platformSkuId,
            skuTitle: r['ext_code'] ?? null,
            activityPriceCents,
            currency: null,
            status: 'enrolled',
            platformPayload: r as any,
          };
          const updateData = {
            skuTitle: createData.skuTitle,
            activityPriceCents: createData.activityPriceCents,
            platformPayload: createData.platformPayload,
            lastSyncedAt: new Date(),
          };

          // sessionId=null 时 PG 唯一约束失效，必须 findFirst 兜底（沿用现有 enrollment-sync 的写法）
          const existing = await (this.prisma as any).activityEnrollment.findFirst({
            where: { shopId: task.shopId, activityId: activity.id, sessionId: null, platformSkuId },
          });
          if (existing) {
            await (this.prisma as any).activityEnrollment.update({ where: { id: existing.id }, data: updateData });
          } else {
            await (this.prisma as any).activityEnrollment.create({ data: createData });
          }
          enrollmentsUpserted++;
        } catch (e: any) {
          enrollmentsFailed++;
          this.logger.warn(`[ingest:marketing-activity] enrollment fail sku=${platformSkuId}: ${e?.message ?? e}`);
        }
      }
    }

    this.logger.log(
      `[ingest:marketing-activity] task ${task.id.slice(0, 8)} ✓ ` +
      `activities=${activitiesUpserted} enrollments=${enrollmentsUpserted}` +
      (enrollmentsFailed > 0 ? ` (failed=${enrollmentsFailed})` : ''),
    );

    return {
      ingested: true,
      rowsAffected: enrollmentsUpserted,
      reason: enrollmentsFailed > 0 ? 'partial' : undefined,
    };
  }
}
