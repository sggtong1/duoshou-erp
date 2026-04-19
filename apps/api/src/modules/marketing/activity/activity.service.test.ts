import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityService } from './activity.service';

describe('ActivityService.list', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = {
      activity: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'a1', orgId: 'org-1', platformActivityId: '1001', region: 'pa',
            title: '618', status: 'open',
            shopVisibility: [
              { shopId: 's1', shopName: 'A', canEnroll: true },
              { shopId: 's2', shopName: 'B', canEnroll: true },
            ],
            sessions: [],
          },
        ]),
      },
      activityEnrollment: {
        groupBy: vi.fn().mockResolvedValue([
          { activityId: 'a1', shopId: 's1', _count: { _all: 3 } },
          { activityId: 'a1', shopId: 's2', _count: { _all: 2 } },
        ]),
      },
    };
  });

  it('按 orgId 隔离', async () => {
    const svc = new ActivityService(prisma, {} as any);
    await svc.list('org-1', {});
    expect(prisma.activity.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
  });

  it('聚合统计列: shopCount / enrolledShopCount / enrolledSkuCount', async () => {
    const svc = new ActivityService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    const a = r.items[0];
    expect(a.shopCount).toBe(2);
    expect(a.enrolledShopCount).toBe(2);
    expect(a.enrolledSkuCount).toBe(5);
  });

  it('shopId 筛选生成 Prisma @> 的 array_contains', async () => {
    const svc = new ActivityService(prisma, {} as any);
    await svc.list('org-1', { shopId: 's1' });
    const where = prisma.activity.findMany.mock.calls[0][0].where;
    expect(where.shopVisibility).toEqual({ array_contains: [{ shopId: 's1' }] });
  });
});

describe('ActivityService.get', () => {
  it('返回详情含 sessions + 聚合列,missing 抛 NotFound', async () => {
    const prisma: any = {
      activity: {
        findFirst: vi.fn().mockResolvedValueOnce({
          id: 'a1', orgId: 'org-1', platformActivityId: '1001', region: 'pa',
          title: '618', status: 'open',
          shopVisibility: [{ shopId: 's1', shopName: 'A', canEnroll: true }],
          sessions: [{ id: 'sess-1', platformSessionId: 's1', title: 'D1' }],
        }).mockResolvedValueOnce(null),
      },
      activityEnrollment: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };
    const svc = new ActivityService(prisma, {} as any);
    const r = await svc.get('org-1', 'a1');
    expect(r.title).toBe('618');
    expect(r.sessions).toHaveLength(1);
    expect(r.shopCount).toBe(1);
    await expect(svc.get('org-1', 'missing')).rejects.toThrow();
  });
});
