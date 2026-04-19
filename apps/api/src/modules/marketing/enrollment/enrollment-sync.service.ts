import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { sharedRedis } from '../../../infra/redis';
import { marketingEndpoints } from '../marketing-endpoints';

const LOCK_KEY = 'lock:enrollment-sync';
const LOCK_TTL_SECONDS = 1800;

function mapTemuStatus(s: any): 'pending' | 'approved' | 'rejected' | 'withdrawn' {
  if (s === 1 || s === 'approved') return 'approved';
  if (s === 2 || s === 'rejected') return 'rejected';
  if (s === 3 || s === 'withdrawn') return 'withdrawn';
  return 'pending';
}

@Injectable()
export class EnrollmentSyncService {
  private logger = new Logger(EnrollmentSyncService.name);
  private get redis(): Redis { return sharedRedis(); }

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async syncShop(shopId: string): Promise<number> {
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop) return 0;
    const ep = marketingEndpoints({ region: shop.region });
    const client = await this.clientFactory.forShop(shopId);
    let touched = 0;

    for (let pageNo = 1; pageNo <= 10; pageNo++) {
      let res: any;
      try {
        res = await client.call(ep.listEnrollments, { pageNo, pageSize: 50 });
      } catch (e: any) {
        this.logger.warn(`shop ${shopId} listEnrollments failed: ${e.message}`);
        break;
      }
      const list: any[] = res?.enrollList ?? res?.list ?? [];
      if (!list.length) break;
      for (const item of list) {
        const platformActivityId = String(item.activityId ?? '');
        const platformSkuId = String(item.skuId ?? item.productSkuId ?? '');
        if (!platformActivityId || !platformSkuId) continue;

        const activity = await (this.prisma as any).activity.findUnique({
          where: { orgId_region_platformActivityId: { orgId: shop.orgId, region: shop.region, platformActivityId } },
        });
        if (!activity) continue;

        let sessionLocalId: string | null = null;
        const platformSessionId = item.sessionId != null ? String(item.sessionId) : null;
        if (platformSessionId) {
          const sess = await (this.prisma as any).activitySession.findUnique({
            where: { activityId_platformSessionId: { activityId: activity.id, platformSessionId } },
          });
          sessionLocalId = sess?.id ?? null;
        }

        const status = mapTemuStatus(item.status);
        const createData = {
          orgId: shop.orgId, shopId,
          activityId: activity.id,
          sessionId: sessionLocalId,
          platformSkuId,
          skuTitle: item.productName ?? item.skuName ?? null,
          activityPriceCents: item.activityPrice != null ? BigInt(Math.round(Number(item.activityPrice))) : null,
          currency: item.currency ?? null,
          status,
          rejectReason: item.rejectReason ?? null,
          platformPayload: item,
        };
        const updateData = {
          status,
          rejectReason: item.rejectReason ?? null,
          resolvedAt: status === 'approved' || status === 'rejected' ? new Date() : undefined,
          platformPayload: item,
        };

        // Postgres 唯一约束对 NULL 不相等,sessionId=null 时 upsert 永远走 create 造成重复。
        // 手动 findFirst + update|create 兜底。
        if (sessionLocalId === null) {
          const existing = await (this.prisma as any).activityEnrollment.findFirst({
            where: { shopId, activityId: activity.id, sessionId: null, platformSkuId },
          });
          if (existing) {
            await (this.prisma as any).activityEnrollment.update({
              where: { id: existing.id },
              data: updateData,
            });
          } else {
            await (this.prisma as any).activityEnrollment.create({ data: createData });
          }
        } else {
          await (this.prisma as any).activityEnrollment.upsert({
            where: {
              shopId_activityId_sessionId_platformSkuId: {
                shopId, activityId: activity.id, sessionId: sessionLocalId, platformSkuId,
              },
            },
            create: createData,
            update: updateData,
          });
        }
        touched++;
      }
      if (list.length < 50) break;
    }
    this.logger.log(`shop ${shopId} synced ${touched} enrollments`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    let lock: string | null = null;
    try { lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX'); }
    catch (e: any) { this.logger.warn(`enrollment lock acquire failed: ${e.message}`); }
    if (lock !== 'OK') {
      this.logger.warn('enrollment sync skipped (lock held or redis down)');
      return 0;
    }
    try {
      const where: any = { status: 'active' };
      if (orgId) where.orgId = orgId;
      const shops = await (this.prisma as any).shop.findMany({ where });
      let total = 0;
      for (const s of shops) {
        try { total += await this.syncShop(s.id); }
        catch (e: any) { this.logger.error(`shop ${s.id} enrollment sync failed: ${e.message}`); }
      }
      return total;
    } finally {
      try { await this.redis.del(LOCK_KEY); }
      catch (e: any) { this.logger.warn(`enrollment lock release failed: ${e.message}`); }
    }
  }
}
