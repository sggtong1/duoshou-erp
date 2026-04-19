import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { marketingEndpoints } from '../marketing-endpoints';
import type { ListEnrollmentsFilterInput, SubmitEnrollmentInput } from './enrollment.dto';

function bigIntToNumber(v: bigint | null | undefined): number | null {
  return v == null ? null : Number(v);
}

function serialize(r: any) {
  return {
    ...r,
    activityPriceCents: bigIntToNumber(r.activityPriceCents),
  };
}

@Injectable()
export class EnrollmentService {
  private logger = new Logger(EnrollmentService.name);

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async submit(orgId: string, input: SubmitEnrollmentInput) {
    const activity = await (this.prisma as any).activity.findFirst({
      where: { id: input.activityId, orgId },
    });
    if (!activity) throw new NotFoundException(`Activity ${input.activityId} not found`);
    if (activity.status !== 'open') throw new BadRequestException(`Activity is ${activity.status}, not open`);
    if (activity.enrollEndAt && new Date(activity.enrollEndAt) < new Date()) {
      throw new BadRequestException('Activity enrollment has ended');
    }

    let session: any = null;
    if (input.sessionId) {
      session = await (this.prisma as any).activitySession.findFirst({
        where: { id: input.sessionId, activityId: activity.id },
      });
      if (!session) throw new NotFoundException(`Session ${input.sessionId} not in activity`);
    }

    const shopVis: any[] = Array.isArray(activity.shopVisibility) ? activity.shopVisibility : [];
    const visibleShopIds = new Set(shopVis.map((x) => x?.shopId).filter(Boolean));

    const byShop = new Map<string, typeof input.items>();
    for (const it of input.items) {
      if (!byShop.has(it.shopId)) byShop.set(it.shopId, []);
      byShop.get(it.shopId)!.push(it);
    }

    const ep = marketingEndpoints({ region: activity.region });
    const results: Array<{ shopId: string; platformSkuId: string; ok: boolean; enrollmentId?: string; error?: string }> = [];

    for (const [shopId, items] of byShop.entries()) {
      if (!visibleShopIds.has(shopId)) {
        for (const it of items) {
          results.push({ shopId, platformSkuId: it.platformSkuId, ok: false, error: 'shop not in activity visibility' });
        }
        continue;
      }

      // 去重 (shop, activity, session, platformSkuId) —— sessionId nullable 下 Postgres 唯一约束对 NULL 不生效,
      // 应用层保护:同一批次内同 SKU 重复先合并。
      const seenKeys = new Set<string>();
      const deduped = items.filter((it) => {
        const k = `${it.platformSkuId}`;
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
      });

      const createdRecords: Record<string, any> = {};
      for (const it of deduped) {
        const r = await (this.prisma as any).activityEnrollment.create({
          data: {
            orgId,
            shopId,
            activityId: activity.id,
            sessionId: session?.id ?? null,
            platformSkuId: it.platformSkuId,
            skuTitle: it.skuTitle,
            activityPriceCents: BigInt(it.activityPriceCents),
            currency: it.currency,
            status: 'pending',
          },
        });
        createdRecords[it.platformSkuId] = r;
      }

      const client = await this.clientFactory.forShop(shopId);
      try {
        const payloadItems = deduped.map((it) => ({
          skuId: it.platformSkuId,
          activityPrice: String(it.activityPriceCents),
          currency: it.currency ?? 'USD',
        }));
        const res: any = await client.call(ep.submitEnroll, {
          activityId: activity.platformActivityId,
          sessionId: session?.platformSessionId,
          items: payloadItems,
        });
        for (const it of deduped) {
          await (this.prisma as any).activityEnrollment.update({
            where: { id: createdRecords[it.platformSkuId].id },
            data: { platformPayload: res, status: 'pending' },
          });
          results.push({ shopId, platformSkuId: it.platformSkuId, ok: true, enrollmentId: createdRecords[it.platformSkuId].id });
        }
      } catch (e: any) {
        for (const it of deduped) {
          await (this.prisma as any).activityEnrollment.update({
            where: { id: createdRecords[it.platformSkuId].id },
            data: { status: 'failed', error: { message: e.message }, resolvedAt: new Date() },
          });
          results.push({ shopId, platformSkuId: it.platformSkuId, ok: false, error: e.message });
        }
      }

      // 把重复项(被 dedup 丢弃的)作为 "skipped" 记在 result 里以示透明
      for (const it of items) {
        if (!deduped.includes(it)) {
          results.push({ shopId, platformSkuId: it.platformSkuId, ok: false, error: 'duplicate in batch, skipped' });
        }
      }
    }

    return { total: input.items.length, results };
  }

  async list(orgId: string, filter: ListEnrollmentsFilterInput) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: any = { orgId };
    if (filter.activityId) where.activityId = filter.activityId;
    if (filter.shopId) where.shopId = filter.shopId;
    if (filter.status) where.status = filter.status;

    const [total, items] = await Promise.all([
      (this.prisma as any).activityEnrollment.count({ where }),
      (this.prisma as any).activityEnrollment.findMany({
        where,
        include: {
          shop: { select: { id: true, displayName: true, platformShopId: true } },
          activity: { select: { id: true, title: true, region: true, platformActivityId: true } },
        },
        orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: items.map(serialize) };
  }

  async refresh(orgId: string, enrollmentId: string) {
    const e = await (this.prisma as any).activityEnrollment.findFirst({
      where: { id: enrollmentId, orgId },
      include: { activity: true },
    });
    if (!e) throw new NotFoundException(`Enrollment ${enrollmentId} not found`);

    const ep = marketingEndpoints({ region: e.activity.region });
    const client = await this.clientFactory.forShop(e.shopId);
    try {
      const res: any = await client.call(ep.listEnrollments, {
        activityId: e.activity.platformActivityId,
        skuId: e.platformSkuId,
        pageNo: 1, pageSize: 10,
      });
      const list: any[] = res?.enrollList ?? res?.list ?? [];
      const match = list.find((x) => String(x.skuId ?? x.productSkuId) === e.platformSkuId);
      if (!match) return serialize(e);
      const status = mapTemuStatus(match.status);
      const updated = await (this.prisma as any).activityEnrollment.update({
        where: { id: e.id },
        data: {
          status,
          rejectReason: match.rejectReason ?? null,
          resolvedAt: status === 'approved' || status === 'rejected' ? new Date() : e.resolvedAt,
          platformPayload: match,
        },
      });
      return serialize(updated);
    } catch (err: any) {
      this.logger.warn(`refresh enrollment ${enrollmentId} failed: ${err.message}`);
      return serialize(e);
    }
  }
}

function mapTemuStatus(s: any): 'pending' | 'approved' | 'rejected' | 'withdrawn' {
  if (s === 1 || s === 'approved') return 'approved';
  if (s === 2 || s === 'rejected') return 'rejected';
  if (s === 3 || s === 'withdrawn') return 'withdrawn';
  return 'pending';
}
