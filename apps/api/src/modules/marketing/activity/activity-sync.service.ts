import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { sharedRedis } from '../../../infra/redis';
import { marketingEndpoints } from '../marketing-endpoints';

const LOCK_KEY = 'lock:activity-sync';
const LOCK_TTL_SECONDS = 1800;

function toDate(x: any): Date | null {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class ActivitySyncService {
  private logger = new Logger(ActivitySyncService.name);
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
        res = await client.call(ep.listActivities, { pageNo, pageSize: 50 });
      } catch (e: any) {
        this.logger.warn(`shop ${shopId} listActivities failed: ${e.message}`);
        break;
      }
      const list: any[] = res?.activityList ?? res?.list ?? [];
      if (!list.length) break;
      for (const a of list) {
        const platformActivityId = String(a.activityId ?? a.id ?? '');
        if (!platformActivityId) continue;

        const existing = await (this.prisma as any).activity.findUnique({
          where: { orgId_region_platformActivityId: { orgId: shop.orgId, region: shop.region, platformActivityId } },
        });

        const shopVisEntry = {
          shopId,
          shopName: shop.displayName ?? shop.platformShopId,
          canEnroll: a.canEnroll !== false,
          lastSeenAt: new Date().toISOString(),
        };
        const shopVisibility = mergeShopVisibility(existing?.shopVisibility ?? [], shopVisEntry);

        // status 状态流转由 flipStatuses() 独占。upsert update 不重置 status,
        // 避免 closed/archived 活动每轮 cron 被翻回 open。create 时保留 'open' 作为首次落库默认。
        const mutableData = {
          title: a.title ?? a.name ?? null,
          activityType: a.type ?? a.activityType ?? null,
          startAt: toDate(a.startTime ?? a.beginTime),
          endAt: toDate(a.endTime),
          enrollStartAt: toDate(a.enrollStartTime ?? a.signupStartTime),
          enrollEndAt: toDate(a.enrollEndTime ?? a.signupEndTime),
          shopVisibility,
          platformPayload: a,
        };

        const activity = await (this.prisma as any).activity.upsert({
          where: { orgId_region_platformActivityId: { orgId: shop.orgId, region: shop.region, platformActivityId } },
          create: { orgId: shop.orgId, region: shop.region, platformActivityId, status: 'open', ...mutableData },
          update: mutableData,
        });

        try {
          const sessRes: any = await client.call(ep.listSessions, {
            activityId: platformActivityId,
          });
          const sessions: any[] = sessRes?.sessionList ?? sessRes?.list ?? [];
          for (const s of sessions) {
            const platformSessionId = String(s.sessionId ?? s.id ?? '');
            if (!platformSessionId) continue;
            await (this.prisma as any).activitySession.upsert({
              where: { activityId_platformSessionId: { activityId: activity.id, platformSessionId } },
              create: {
                activityId: activity.id,
                platformSessionId,
                title: s.title ?? null,
                startAt: toDate(s.startTime),
                endAt: toDate(s.endTime),
                status: 'open',
                platformPayload: s,
              },
              update: {
                title: s.title ?? null,
                startAt: toDate(s.startTime),
                endAt: toDate(s.endTime),
                platformPayload: s,
              },
            });
          }
        } catch (e: any) {
          this.logger.warn(`activity ${platformActivityId} sessions fetch failed: ${e.message}`);
        }

        touched++;
      }
      if (list.length < 50) break;
    }
    this.logger.log(`shop ${shopId} synced ${touched} activities`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    let lock: string | null = null;
    try { lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX'); }
    catch (e: any) { this.logger.warn(`activity lock acquire failed: ${e.message}`); }
    if (lock !== 'OK') {
      this.logger.warn('activity sync skipped (lock held or redis down)');
      return 0;
    }
    try {
      const where: any = { status: 'active' };
      if (orgId) where.orgId = orgId;
      const shops = await (this.prisma as any).shop.findMany({ where });
      let total = 0;
      for (const s of shops) {
        try { total += await this.syncShop(s.id); }
        catch (e: any) { this.logger.error(`shop ${s.id} sync failed: ${e.message}`); }
      }
      await this.flipStatuses();
      return total;
    } finally {
      try { await this.redis.del(LOCK_KEY); }
      catch (e: any) { this.logger.warn(`activity lock release failed: ${e.message}`); }
    }
  }

  private async flipStatuses() {
    const now = new Date();
    const archiveCutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    await (this.prisma as any).activity.updateMany({
      where: { status: 'open', enrollEndAt: { lt: now } },
      data: { status: 'closed' },
    });
    await (this.prisma as any).activity.updateMany({
      where: { status: 'closed', endAt: { lt: archiveCutoff } },
      data: { status: 'archived' },
    });
  }
}

function mergeShopVisibility(existing: any, entry: any): any[] {
  const arr: any[] = Array.isArray(existing) ? [...existing] : [];
  const idx = arr.findIndex((x) => x?.shopId === entry.shopId);
  if (idx >= 0) arr[idx] = { ...arr[idx], ...entry };
  else arr.push(entry);
  return arr;
}
