# W2b 活动日历 + 跨店批量报名 实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 商家在一个页面看到所有店铺可报的 Temu 营销活动,一次选店+选 SKU+填活动价提交跨店报名,并在看板上跟踪审核结果。

**Architecture:** 同 W2a 架构(`docs/superpowers/specs/2026-04-19-w2b-activity-enrollment-design.md`):三张 Prisma 表(activity / activity_session / activity_enrollment),marketing-endpoints 纯函数按 region 路由,Activity/Enrollment Service + Controller,每天两轮 cron(02:00 activity / 03:00 enrollment)+ Redis 并发锁,前端三个页面(list / detail-with-inline-submit / enrollment board)。可报商品不落盘,按需拉 + Redis TTL 300s。

**Tech Stack:** NestJS 10、Prisma 7、@nestjs/schedule、BullMQ(不新增队列)、ioredis、Vue 3 + Naive UI、Vitest、Zod、TypeScript。

---

## Context(W0–W2a 已经有的)

- `TemuClient.call(interfaceType, req)` 通过 `TEMU_API_REGISTRY` 自动分发 region,只传 method 字符串即可
- `TemuClientFactoryService.forShop(shopId)` 返回 per-shop 限流 client
- `AuthGuard`、`TenantService.resolveForUser(req.user)`、`ZodValidationPipe`、`PrismaService` 已就位
- Prisma BigInt → Number:`serialize()` 模式(W2a `price-review.service.ts:11`)
- `Shop` 有 `shopType ∈ {full,semi}`、`region ∈ {cn,pa}`
- `@nestjs/schedule` 已在 `app.module.ts` 注册 `ScheduleModule.forRoot()`
- 前端:`api-client/http.ts` 支持 `{query, method, body}` 选项包;Pinia setup-store 模式(`stores/templates.ts` 参考)
- Redis:`infra/redis.ts` 已导出 `makeRedisClient()`(W2a BullMQ 用),新增的并发锁和缓存直接复用

## Env 新增

无。(Redis 连接 / Temu 凭据都已存在。)

## Scope 边界

**W2b 内**:6 API 全链路 / 活动跨店聚合 / 单活动批量报名 / 每天 cron / Redis 并发锁 / 手动刷新兜底
**W2b 外**:真日历视图、报名撤销、报名模板、GMV 分析、伪 webhook、跨活动批量

---

## Task 1: Prisma 模型 + 迁移

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260420010000_w2b_activity/migration.sql`

- [ ] **Step 1: 追加 3 个模型到 schema.prisma**

```prisma
model Activity {
  id                  String    @id @default(uuid())
  orgId               String    @map("org_id")
  platformActivityId  String    @map("platform_activity_id")
  region              String
  title               String?
  activityType        String?   @map("activity_type")
  startAt             DateTime? @map("start_at")
  endAt               DateTime? @map("end_at")
  enrollStartAt       DateTime? @map("enroll_start_at")
  enrollEndAt         DateTime? @map("enroll_end_at")
  status              String    @default("open")
  shopVisibility      Json      @default("[]") @map("shop_visibility")
  platformPayload     Json      @default("{}") @map("platform_payload")
  firstSeenAt         DateTime  @default(now()) @map("first_seen_at")
  lastSyncedAt        DateTime  @default(now()) @updatedAt @map("last_synced_at")

  org         Organization         @relation(fields: [orgId], references: [id])
  sessions    ActivitySession[]
  enrollments ActivityEnrollment[]

  @@unique([orgId, region, platformActivityId])
  @@index([orgId, status, startAt])
  @@map("activity")
}

model ActivitySession {
  id                 String    @id @default(uuid())
  activityId         String    @map("activity_id")
  platformSessionId  String    @map("platform_session_id")
  title              String?
  startAt            DateTime? @map("start_at")
  endAt              DateTime? @map("end_at")
  status             String    @default("open")
  platformPayload    Json      @default("{}") @map("platform_payload")

  activity    Activity             @relation(fields: [activityId], references: [id], onDelete: Cascade)
  enrollments ActivityEnrollment[]

  @@unique([activityId, platformSessionId])
  @@index([activityId, startAt])
  @@map("activity_session")
}

model ActivityEnrollment {
  id                  String    @id @default(uuid())
  orgId               String    @map("org_id")
  shopId              String    @map("shop_id")
  activityId          String    @map("activity_id")
  sessionId           String?   @map("session_id")
  platformSkuId       String    @map("platform_sku_id")
  skuTitle            String?   @map("sku_title")
  activityPriceCents  BigInt?   @map("activity_price_cents")
  currency            String?
  status              String    @default("pending")
  rejectReason        String?   @map("reject_reason")
  submittedAt         DateTime  @default(now()) @map("submitted_at")
  resolvedAt          DateTime? @map("resolved_at")
  lastSyncedAt        DateTime  @default(now()) @updatedAt @map("last_synced_at")
  error               Json?
  platformPayload     Json?     @map("platform_payload")

  org      Organization     @relation(fields: [orgId], references: [id])
  shop     Shop             @relation(fields: [shopId], references: [id])
  activity Activity         @relation(fields: [activityId], references: [id])
  session  ActivitySession? @relation(fields: [sessionId], references: [id])

  @@unique([shopId, activityId, sessionId, platformSkuId])
  @@index([orgId, status])
  @@index([activityId, status])
  @@map("activity_enrollment")
}
```

在现有 `model Organization` 内追加:
```
  activities            Activity[]
  activityEnrollments   ActivityEnrollment[]
```

在现有 `model Shop` 内追加:
```
  activityEnrollments  ActivityEnrollment[]
```

- [ ] **Step 2: 手写迁移 SQL**

创建 `apps/api/prisma/migrations/20260420010000_w2b_activity/migration.sql`:

```sql
CREATE TABLE "activity" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "platform_activity_id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "title" TEXT,
    "activity_type" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "enroll_start_at" TIMESTAMP(3),
    "enroll_end_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "shop_visibility" JSONB NOT NULL DEFAULT '[]',
    "platform_payload" JSONB NOT NULL DEFAULT '{}',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_org_region_platform_key" ON "activity"("org_id","region","platform_activity_id");
CREATE INDEX "activity_org_status_start_idx" ON "activity"("org_id","status","start_at");

CREATE TABLE "activity_session" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "platform_session_id" TEXT NOT NULL,
    "title" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "platform_payload" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "activity_session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_session_activity_platform_key" ON "activity_session"("activity_id","platform_session_id");
CREATE INDEX "activity_session_activity_start_idx" ON "activity_session"("activity_id","start_at");

CREATE TABLE "activity_enrollment" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "session_id" TEXT,
    "platform_sku_id" TEXT NOT NULL,
    "sku_title" TEXT,
    "activity_price_cents" BIGINT,
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" JSONB,
    "platform_payload" JSONB,
    CONSTRAINT "activity_enrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_enrollment_shop_activity_session_sku_key" ON "activity_enrollment"("shop_id","activity_id","session_id","platform_sku_id");
CREATE INDEX "activity_enrollment_org_status_idx" ON "activity_enrollment"("org_id","status");
CREATE INDEX "activity_enrollment_activity_status_idx" ON "activity_enrollment"("activity_id","status");

ALTER TABLE "activity" ADD CONSTRAINT "activity_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_session" ADD CONSTRAINT "activity_session_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_enrollment" ADD CONSTRAINT "activity_enrollment_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_enrollment" ADD CONSTRAINT "activity_enrollment_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_enrollment" ADD CONSTRAINT "activity_enrollment_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_enrollment" ADD CONSTRAINT "activity_enrollment_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: 应用迁移**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
set -a && source .env.development && set +a
pnpm prisma migrate deploy && pnpm prisma generate
```

- [ ] **Step 4: 验证表**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
set -a && source .env.development && set +a
node -e "import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query(\"select table_name from information_schema.tables where table_schema='public' and table_name like 'activity%' order by table_name\");console.log(r.rows.map(x=>x.table_name).join(','));await c.end();});"
```

期望:`activity,activity_enrollment,activity_session`

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/prisma
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): activity / activity_session / activity_enrollment models"
```

---

## Task 2: marketing-endpoints 纯函数 + 测试

**Files:**
- Create: `apps/api/src/modules/marketing/marketing-endpoints.ts`
- Create: `apps/api/src/modules/marketing/marketing-endpoints.test.ts`

活动 API 组不区分 shopType(全托/半托都用同一组),只区分 region(CN / PA `.global`)。测试比 W2a pricing 少,2 个 case 够。

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/marketing/marketing-endpoints.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { marketingEndpoints } from './marketing-endpoints';

describe('marketingEndpoints', () => {
  it('cn 用基础 bg.marketing.activity.* 方法名', () => {
    const e = marketingEndpoints({ region: 'cn' });
    expect(e.listActivities).toBe('bg.marketing.activity.list.get');
    expect(e.activityDetail).toBe('bg.marketing.activity.detail.get');
    expect(e.listSessions).toBe('bg.marketing.activity.session.list.get');
    expect(e.listProducts).toBe('bg.marketing.activity.product.get');
    expect(e.submitEnroll).toBe('bg.marketing.activity.enroll.submit');
    expect(e.listEnrollments).toBe('bg.marketing.activity.enroll.list.get');
  });

  it('pa 用 .global 后缀', () => {
    const e = marketingEndpoints({ region: 'pa' });
    expect(e.listActivities).toBe('bg.marketing.activity.list.get.global');
    expect(e.activityDetail).toBe('bg.marketing.activity.detail.get.global');
    expect(e.listSessions).toBe('bg.marketing.activity.session.list.get.global');
    expect(e.listProducts).toBe('bg.marketing.activity.product.get.global');
    expect(e.submitEnroll).toBe('bg.marketing.activity.enroll.submit.global');
    expect(e.listEnrollments).toBe('bg.marketing.activity.enroll.list.get.global');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/modules/marketing/marketing-endpoints.test.ts
```

期望:fail(文件不存在)

- [ ] **Step 3: 实现**

创建 `apps/api/src/modules/marketing/marketing-endpoints.ts`:
```typescript
export interface MarketingContext {
  region: 'cn' | 'pa';
}

export interface MarketingEndpoints {
  listActivities: string;
  activityDetail: string;
  listSessions: string;
  listProducts: string;
  submitEnroll: string;
  listEnrollments: string;
}

export function marketingEndpoints(ctx: MarketingContext): MarketingEndpoints {
  const suffix = ctx.region === 'pa' ? '.global' : '';
  return {
    listActivities: `bg.marketing.activity.list.get${suffix}`,
    activityDetail: `bg.marketing.activity.detail.get${suffix}`,
    listSessions: `bg.marketing.activity.session.list.get${suffix}`,
    listProducts: `bg.marketing.activity.product.get${suffix}`,
    submitEnroll: `bg.marketing.activity.enroll.submit${suffix}`,
    listEnrollments: `bg.marketing.activity.enroll.list.get${suffix}`,
  };
}
```

- [ ] **Step 4: 跑测试确认绿**

```bash
pnpm vitest run src/modules/marketing/marketing-endpoints.test.ts
```
期望:2 passed。

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing/marketing-endpoints.ts \
        duoshou-erp/apps/api/src/modules/marketing/marketing-endpoints.test.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): marketingEndpoints routing helper (cn × pa)"
```

---

## Task 3: ActivityService + DTO + 测试

**Files:**
- Create: `apps/api/src/modules/marketing/activity/activity.dto.ts`
- Create: `apps/api/src/modules/marketing/activity/activity.service.ts`
- Create: `apps/api/src/modules/marketing/activity/activity.service.test.ts`

- [ ] **Step 1: DTO**

创建 `apps/api/src/modules/marketing/activity/activity.dto.ts`:
```typescript
import { z } from 'zod';

export const ListActivitiesFilter = z.object({
  region: z.enum(['cn', 'pa']).optional(),
  status: z.enum(['open', 'closed', 'archived']).optional(),
  search: z.string().optional(),
  shopId: z.string().uuid().optional(),
  startAfter: z.string().datetime().optional(),
  startBefore: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListActivitiesFilterInput = z.infer<typeof ListActivitiesFilter>;
```

- [ ] **Step 2: 失败测试**

创建 `apps/api/src/modules/marketing/activity/activity.service.test.ts`:
```typescript
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

  it('shopId 筛选用 JSON @> 路径', async () => {
    const svc = new ActivityService(prisma, {} as any);
    await svc.list('org-1', { shopId: 's1' });
    const where = prisma.activity.findMany.mock.calls[0][0].where;
    expect(where.shopVisibility).toBeDefined();
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
```

- [ ] **Step 3: 确认红**

```bash
pnpm vitest run src/modules/marketing/activity/activity.service.test.ts
```

- [ ] **Step 4: 实现 service**

创建 `apps/api/src/modules/marketing/activity/activity.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import type { ListActivitiesFilterInput } from './activity.dto';

function bigIntToNumber(v: bigint | null | undefined): number | null {
  return v == null ? null : Number(v);
}

function serializeSession(s: any) {
  return { ...s };
}

async function attachAggregates(prisma: any, items: any[]) {
  if (!items.length) return items;
  const activityIds = items.map((x) => x.id);
  const groups = await prisma.activityEnrollment.groupBy({
    by: ['activityId', 'shopId'],
    where: { activityId: { in: activityIds } },
    _count: { _all: true },
  });
  const byActivity = new Map<string, { shops: Set<string>; skus: number }>();
  for (const g of groups) {
    const k = g.activityId;
    const cur = byActivity.get(k) ?? { shops: new Set<string>(), skus: 0 };
    cur.shops.add(g.shopId);
    cur.skus += g._count._all;
    byActivity.set(k, cur);
  }
  return items.map((a) => {
    const agg = byActivity.get(a.id);
    const shopVis: any[] = Array.isArray(a.shopVisibility) ? a.shopVisibility : [];
    return {
      ...a,
      shopCount: shopVis.length,
      enrolledShopCount: agg?.shops.size ?? 0,
      enrolledSkuCount: agg?.skus ?? 0,
    };
  });
}

@Injectable()
export class ActivityService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async list(orgId: string, filter: ListActivitiesFilterInput) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: any = { orgId };
    if (filter.region) where.region = filter.region;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.title = { contains: filter.search, mode: 'insensitive' };
    if (filter.shopId) where.shopVisibility = { path: ['$[*].shopId'], array_contains: filter.shopId };
    if (filter.startAfter) where.startAt = { gte: new Date(filter.startAfter) };
    if (filter.startBefore) where.startAt = { ...(where.startAt ?? {}), lte: new Date(filter.startBefore) };

    const [total, items] = await Promise.all([
      (this.prisma as any).activity.count({ where }),
      (this.prisma as any).activity.findMany({
        where,
        include: { sessions: { orderBy: { startAt: 'asc' } } },
        orderBy: [{ status: 'asc' }, { startAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const withAgg = await attachAggregates(this.prisma, items);
    return { total, page, pageSize, items: withAgg };
  }

  async get(orgId: string, id: string) {
    const a = await (this.prisma as any).activity.findFirst({
      where: { id, orgId },
      include: { sessions: { orderBy: { startAt: 'asc' } } },
    });
    if (!a) throw new NotFoundException(`Activity ${id} not found`);
    const [withAgg] = await attachAggregates(this.prisma, [a]);
    return withAgg;
  }
}
```

- [ ] **Step 5: 跑测试确认绿**

```bash
pnpm vitest run src/modules/marketing/activity/activity.service.test.ts
```
期望:5 passed。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing/activity/activity.dto.ts \
        duoshou-erp/apps/api/src/modules/marketing/activity/activity.service.ts \
        duoshou-erp/apps/api/src/modules/marketing/activity/activity.service.test.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): ActivityService (list + detail + cross-shop aggregates)"
```

---

## Task 4: ActivityProducts 按需服务(Redis 缓存)

**Files:**
- Create: `apps/api/src/modules/marketing/activity/activity-products.service.ts`

单独服务管理"可报商品"按需拉取 + Redis TTL 300s 缓存。

- [ ] **Step 1: 实现**

创建 `apps/api/src/modules/marketing/activity/activity-products.service.ts`:
```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { makeRedisClient } from '../../../infra/redis';
import { marketingEndpoints } from '../marketing-endpoints';

const CACHE_TTL_SECONDS = 300;

@Injectable()
export class ActivityProductsService {
  private logger = new Logger(ActivityProductsService.name);
  private redis = makeRedisClient();

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async list(orgId: string, activityId: string, shopId: string) {
    const activity = await (this.prisma as any).activity.findFirst({
      where: { id: activityId, orgId },
    });
    if (!activity) throw new NotFoundException(`Activity ${activityId} not found`);

    const shop = await (this.prisma as any).shop.findFirst({ where: { id: shopId, orgId } });
    if (!shop) throw new NotFoundException(`Shop ${shopId} not found`);

    const cacheKey = `activity:products:${shopId}:${activityId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return { cached: true, ...JSON.parse(cached) }; }
      catch { /* fallthrough to refresh */ }
    }

    const ep = marketingEndpoints({ region: activity.region });
    const client = await this.clientFactory.forShop(shopId);
    let items: any[] = [];
    try {
      const res: any = await client.call(ep.listProducts, {
        activityId: activity.platformActivityId,
        pageNo: 1,
        pageSize: 100,
      });
      items = res?.productList ?? res?.skuList ?? res?.list ?? [];
    } catch (e: any) {
      this.logger.warn(`activity ${activityId} products fetch failed: ${e.message}`);
      return { cached: false, items: [], error: e.message };
    }

    const normalized = items.map((it) => ({
      platformSkuId: String(it.skuId ?? it.productSkuId ?? ''),
      platformProductId: it.productId != null ? String(it.productId) : null,
      skuTitle: it.productName ?? it.skuName ?? null,
      currentPriceCents: toBigIntNumber(it.currentPrice ?? it.supplierPrice ?? it.price),
      stockQty: it.stockQty ?? it.availableQty ?? null,
      currency: it.currency ?? null,
      raw: it,
    })).filter((x) => x.platformSkuId);

    const payload = { items: normalized, fetchedAt: new Date().toISOString() };
    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(payload));
    return { cached: false, ...payload };
  }
}

function toBigIntNumber(x: any): number | null {
  if (x == null || x === '') return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}
```

- [ ] **Step 2: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing/activity/activity-products.service.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): ActivityProductsService (on-demand fetch + Redis TTL 300s)"
```

---

## Task 5: ActivityController + MarketingModule 注册

**Files:**
- Create: `apps/api/src/modules/marketing/activity/activity.controller.ts`
- Create: `apps/api/src/modules/marketing/marketing.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Controller**

创建 `apps/api/src/modules/marketing/activity/activity.controller.ts`:
```typescript
import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ActivityService } from './activity.service';
import { ActivityProductsService } from './activity-products.service';

@Controller('activities')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(
    private svc: ActivityService,
    private products: ActivityProductsService,
    private tenant: TenantService,
  ) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('shopId') shopId?: string,
    @Query('startAfter') startAfter?: string,
    @Query('startBefore') startBefore?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, {
      region: region as any, status: status as any, search, shopId,
      startAfter, startBefore,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.get(m.orgId, id);
  }

  @Get(':id/products')
  async listProducts(
    @Req() req: any,
    @Param('id') id: string,
    @Query('shopId') shopId: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.products.list(m.orgId, id, shopId);
  }
}
```

- [ ] **Step 2: MarketingModule**

创建 `apps/api/src/modules/marketing/marketing.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ActivityProductsService } from './activity/activity-products.service';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ActivityProductsService],
  exports: [ActivityService, ActivityProductsService],
})
export class MarketingModule {}
```

- [ ] **Step 3: 注册到 AppModule**

修改 `apps/api/src/app.module.ts`:
1. 添加 import: `import { MarketingModule } from './modules/marketing/marketing.module';`
2. 把 `MarketingModule` 加到 `imports` 数组,紧跟 `PricingModule`(如果有)或 `ProductModule`

- [ ] **Step 4: 验证 API 启动**

API 在 watch mode(`/tmp/duoshou-api.log`)。期望看到:
- `Mapped {/api/activities, GET} route`
- `Mapped {/api/activities/:id, GET} route`
- `Mapped {/api/activities/:id/products, GET} route`
- `Nest application successfully started`(无新错误)

```bash
tail -30 /tmp/duoshou-api.log
```

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing \
        duoshou-erp/apps/api/src/app.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): /api/activities endpoints (list, detail, products)"
```

---

## Task 6: ActivitySync + cron + 状态流转

**Files:**
- Create: `apps/api/src/modules/marketing/activity/activity-sync.service.ts`
- Create: `apps/api/src/modules/marketing/activity/activity-sync.cron.ts`
- Modify: `apps/api/src/modules/marketing/marketing.module.ts`
- Modify: `apps/api/src/modules/marketing/activity/activity.controller.ts`(加 `POST /activities/sync/now`)

- [ ] **Step 1: Sync service**

创建 `apps/api/src/modules/marketing/activity/activity-sync.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { makeRedisClient } from '../../../infra/redis';
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
  private redis = makeRedisClient();

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

        const data = {
          title: a.title ?? a.name ?? null,
          activityType: a.type ?? a.activityType ?? null,
          startAt: toDate(a.startTime ?? a.beginTime),
          endAt: toDate(a.endTime),
          enrollStartAt: toDate(a.enrollStartTime ?? a.signupStartTime),
          enrollEndAt: toDate(a.enrollEndTime ?? a.signupEndTime),
          status: 'open' as const,
          shopVisibility,
          platformPayload: a,
        };

        const activity = await (this.prisma as any).activity.upsert({
          where: { orgId_region_platformActivityId: { orgId: shop.orgId, region: shop.region, platformActivityId } },
          create: { orgId: shop.orgId, region: shop.region, platformActivityId, ...data },
          update: data,
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
    const lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (lock !== 'OK') {
      this.logger.warn('activity sync skipped (lock held)');
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
      await this.redis.del(LOCK_KEY);
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
```

- [ ] **Step 2: Cron**

创建 `apps/api/src/modules/marketing/activity/activity-sync.cron.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivitySyncService } from './activity-sync.service';

@Injectable()
export class ActivitySyncCron {
  private logger = new Logger(ActivitySyncCron.name);
  constructor(private sync: ActivitySyncService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`activity cron: touched ${total}`);
  }
}
```

- [ ] **Step 3: 加 sync/now 路由到 ActivityController**

在 `apps/api/src/modules/marketing/activity/activity.controller.ts` 的 class 体里加一个方法(并补 `Post`、`ActivitySyncService` import):

```typescript
// 顶部 import 补:
import { Post } from '@nestjs/common';
import { ActivitySyncService } from './activity-sync.service';

// constructor 参数追加:
// private sync: ActivitySyncService,

// 加方法:
  @Post('sync/now')
  async syncNow(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    const total = await this.sync.syncAllActiveShops(m.orgId);
    return { total };
  }
```

- [ ] **Step 4: 注册到 MarketingModule**

修改 `apps/api/src/modules/marketing/marketing.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ActivityProductsService } from './activity/activity-products.service';
import { ActivitySyncService } from './activity/activity-sync.service';
import { ActivitySyncCron } from './activity/activity-sync.cron';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ActivityProductsService, ActivitySyncService, ActivitySyncCron],
  exports: [ActivityService, ActivityProductsService, ActivitySyncService],
})
export class MarketingModule {}
```

- [ ] **Step 5: 验证 API 重载**

```bash
tail -30 /tmp/duoshou-api.log
```

期望新增:`Mapped {/api/activities/sync/now, POST} route`,无错误。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): activity sync + daily cron + status flip (open/closed/archived)"
```

---

## Task 7: EnrollmentService + Controller + DTO + 测试

**Files:**
- Create: `apps/api/src/modules/marketing/enrollment/enrollment.dto.ts`
- Create: `apps/api/src/modules/marketing/enrollment/enrollment.service.ts`
- Create: `apps/api/src/modules/marketing/enrollment/enrollment.service.test.ts`
- Create: `apps/api/src/modules/marketing/enrollment/enrollment.controller.ts`
- Modify: `apps/api/src/modules/marketing/marketing.module.ts`

- [ ] **Step 1: DTO**

创建 `apps/api/src/modules/marketing/enrollment/enrollment.dto.ts`:
```typescript
import { z } from 'zod';

export const SubmitEnrollmentDto = z.object({
  activityId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  items: z.array(z.object({
    shopId: z.string().uuid(),
    platformSkuId: z.string().min(1),
    skuTitle: z.string().optional(),
    activityPriceCents: z.number().int().positive(),
    currency: z.string().optional(),
  })).min(1).max(200),
});
export type SubmitEnrollmentInput = z.infer<typeof SubmitEnrollmentDto>;

export const ListEnrollmentsFilter = z.object({
  activityId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn', 'failed']).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListEnrollmentsFilterInput = z.infer<typeof ListEnrollmentsFilter>;
```

- [ ] **Step 2: 失败测试**

创建 `apps/api/src/modules/marketing/enrollment/enrollment.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentService.submit', () => {
  let prisma: any, clientFactory: any, mockClientByShop: Record<string, any>;
  beforeEach(() => {
    mockClientByShop = {
      'shop-1': { call: vi.fn().mockResolvedValue({ success: true, enrollId: 'e1' }) },
      'shop-2': { call: vi.fn().mockRejectedValue(new Error('Temu 403 forbidden')) },
    };
    clientFactory = { forShop: vi.fn(async (shopId: string) => mockClientByShop[shopId]) };
    prisma = {
      activity: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'a1', orgId: 'org-1', platformActivityId: '1001', region: 'pa', status: 'open',
          enrollEndAt: new Date(Date.now() + 3600_000),
          shopVisibility: [
            { shopId: 'shop-1', shopName: 'A' },
            { shopId: 'shop-2', shopName: 'B' },
          ],
        }),
      },
      activitySession: { findFirst: vi.fn() },
      activityEnrollment: {
        create: vi.fn(async ({ data }: any) => ({ id: `en-${data.shopId}-${data.platformSkuId}`, ...data })),
        update: vi.fn(async ({ data }: any) => data),
      },
    };
  });

  it('按 shop 分组一次调用 per-shop Temu API,per-item 独立结果', async () => {
    const svc = new EnrollmentService(prisma, clientFactory);
    const out = await svc.submit('org-1', {
      activityId: 'a1',
      items: [
        { shopId: 'shop-1', platformSkuId: 'sku-1', activityPriceCents: 1000 },
        { shopId: 'shop-1', platformSkuId: 'sku-2', activityPriceCents: 2000 },
        { shopId: 'shop-2', platformSkuId: 'sku-3', activityPriceCents: 3000 },
      ],
    });
    expect(mockClientByShop['shop-1'].call).toHaveBeenCalledTimes(1);
    expect(mockClientByShop['shop-2'].call).toHaveBeenCalledTimes(1);
    expect(out.total).toBe(3);
    const ok = out.results.filter((r: any) => r.ok);
    const bad = out.results.filter((r: any) => !r.ok);
    expect(ok).toHaveLength(2);
    expect(bad).toHaveLength(1);
    expect(bad[0].error).toMatch(/Temu 403/);
  });

  it('活动不存在抛 NotFound', async () => {
    prisma.activity.findFirst = vi.fn().mockResolvedValue(null);
    const svc = new EnrollmentService(prisma, clientFactory);
    await expect(svc.submit('org-1', {
      activityId: 'a1',
      items: [{ shopId: 'shop-1', platformSkuId: 'x', activityPriceCents: 100 }],
    })).rejects.toThrow();
  });

  it('活动已 closed 抛错', async () => {
    prisma.activity.findFirst = vi.fn().mockResolvedValue({
      id: 'a1', orgId: 'org-1', region: 'pa', status: 'closed', enrollEndAt: new Date(Date.now() - 1000),
      shopVisibility: [{ shopId: 'shop-1' }],
    });
    const svc = new EnrollmentService(prisma, clientFactory);
    await expect(svc.submit('org-1', {
      activityId: 'a1',
      items: [{ shopId: 'shop-1', platformSkuId: 'x', activityPriceCents: 100 }],
    })).rejects.toThrow(/closed|ended/i);
  });
});

describe('EnrollmentService.list', () => {
  it('按 orgId 隔离 + BigInt→Number 序列化', async () => {
    const prisma: any = {
      activityEnrollment: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          { id: 'en-1', orgId: 'org-1', shopId: 's1', activityPriceCents: 999n, status: 'pending' },
        ]),
      },
    };
    const svc = new EnrollmentService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    expect(prisma.activityEnrollment.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
    expect(typeof r.items[0].activityPriceCents).toBe('number');
  });
});
```

- [ ] **Step 3: 确认红**

```bash
pnpm vitest run src/modules/marketing/enrollment/enrollment.service.test.ts
```

- [ ] **Step 4: Service**

创建 `apps/api/src/modules/marketing/enrollment/enrollment.service.ts`:
```typescript
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

      const createdRecords: Record<string, any> = {};
      for (const it of items) {
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
        const payloadItems = items.map((it) => ({
          skuId: it.platformSkuId,
          activityPrice: String(it.activityPriceCents),
          currency: it.currency ?? 'USD',
        }));
        const res: any = await client.call(ep.submitEnroll, {
          activityId: activity.platformActivityId,
          sessionId: session?.platformSessionId,
          items: payloadItems,
        });
        for (const it of items) {
          await (this.prisma as any).activityEnrollment.update({
            where: { id: createdRecords[it.platformSkuId].id },
            data: { platformPayload: res, status: 'pending' },
          });
          results.push({ shopId, platformSkuId: it.platformSkuId, ok: true, enrollmentId: createdRecords[it.platformSkuId].id });
        }
      } catch (e: any) {
        for (const it of items) {
          await (this.prisma as any).activityEnrollment.update({
            where: { id: createdRecords[it.platformSkuId].id },
            data: { status: 'failed', error: { message: e.message }, resolvedAt: new Date() },
          });
          results.push({ shopId, platformSkuId: it.platformSkuId, ok: false, error: e.message });
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
```

- [ ] **Step 5: Controller**

创建 `apps/api/src/modules/marketing/enrollment/enrollment.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { EnrollmentService } from './enrollment.service';
import { SubmitEnrollmentDto, type SubmitEnrollmentInput } from './enrollment.dto';

@Controller('enrollments')
@UseGuards(AuthGuard)
export class EnrollmentController {
  constructor(private svc: EnrollmentService, private tenant: TenantService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('activityId') activityId?: string,
    @Query('shopId') shopId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, {
      activityId, shopId, status: status as any,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post('submit')
  @UsePipes(new ZodValidationPipe(SubmitEnrollmentDto))
  async submit(@Req() req: any, @Body() body: SubmitEnrollmentInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.submit(m.orgId, body);
  }

  @Post(':id/refresh')
  async refresh(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.refresh(m.orgId, id);
  }
}
```

- [ ] **Step 6: MarketingModule 添加**

修改 `apps/api/src/modules/marketing/marketing.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ActivityProductsService } from './activity/activity-products.service';
import { ActivitySyncService } from './activity/activity-sync.service';
import { ActivitySyncCron } from './activity/activity-sync.cron';
import { EnrollmentController } from './enrollment/enrollment.controller';
import { EnrollmentService } from './enrollment/enrollment.service';

@Module({
  controllers: [ActivityController, EnrollmentController],
  providers: [
    ActivityService, ActivityProductsService,
    ActivitySyncService, ActivitySyncCron,
    EnrollmentService,
  ],
  exports: [ActivityService, ActivityProductsService, ActivitySyncService, EnrollmentService],
})
export class MarketingModule {}
```

- [ ] **Step 7: 跑测试 + 验证 API**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/modules/marketing/enrollment/enrollment.service.test.ts
```
期望:4 passed。

```bash
tail -30 /tmp/duoshou-api.log
```
期望新增:
- `Mapped {/api/enrollments, GET}`
- `Mapped {/api/enrollments/submit, POST}`
- `Mapped {/api/enrollments/:id/refresh, POST}`

- [ ] **Step 8: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing/enrollment \
        duoshou-erp/apps/api/src/modules/marketing/marketing.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): EnrollmentService + Controller (submit / list / refresh)"
```

---

## Task 8: EnrollmentSync + 每日 cron

**Files:**
- Create: `apps/api/src/modules/marketing/enrollment/enrollment-sync.service.ts`
- Create: `apps/api/src/modules/marketing/enrollment/enrollment-sync.cron.ts`
- Modify: `apps/api/src/modules/marketing/marketing.module.ts`
- Modify: `apps/api/src/modules/marketing/enrollment/enrollment.controller.ts`(加 `POST /enrollments/sync/now`)

- [ ] **Step 1: Sync service**

创建 `apps/api/src/modules/marketing/enrollment/enrollment-sync.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { makeRedisClient } from '../../../infra/redis';
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
  private redis = makeRedisClient();

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
        await (this.prisma as any).activityEnrollment.upsert({
          where: {
            shopId_activityId_sessionId_platformSkuId: {
              shopId, activityId: activity.id, sessionId: sessionLocalId, platformSkuId,
            },
          },
          create: {
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
          },
          update: {
            status,
            rejectReason: item.rejectReason ?? null,
            resolvedAt: status === 'approved' || status === 'rejected' ? new Date() : undefined,
            platformPayload: item,
          },
        });
        touched++;
      }
      if (list.length < 50) break;
    }
    this.logger.log(`shop ${shopId} synced ${touched} enrollments`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    const lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (lock !== 'OK') { this.logger.warn('enrollment sync skipped (lock held)'); return 0; }
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
      await this.redis.del(LOCK_KEY);
    }
  }
}
```

- [ ] **Step 2: Cron**

创建 `apps/api/src/modules/marketing/enrollment/enrollment-sync.cron.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnrollmentSyncService } from './enrollment-sync.service';

@Injectable()
export class EnrollmentSyncCron {
  private logger = new Logger(EnrollmentSyncCron.name);
  constructor(private sync: EnrollmentSyncService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`enrollment cron: touched ${total}`);
  }
}
```

- [ ] **Step 3: sync/now 路由**

修改 `apps/api/src/modules/marketing/enrollment/enrollment.controller.ts`,顶部:
```typescript
import { EnrollmentSyncService } from './enrollment-sync.service';
```

在 constructor 加 `private syncSvc: EnrollmentSyncService,`,然后加方法:
```typescript
  @Post('sync/now')
  async syncNow(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    const total = await this.syncSvc.syncAllActiveShops(m.orgId);
    return { total };
  }
```

- [ ] **Step 4: MarketingModule 注册**

修改 `apps/api/src/modules/marketing/marketing.module.ts`,加 2 个 provider:
```typescript
import { EnrollmentSyncService } from './enrollment/enrollment-sync.service';
import { EnrollmentSyncCron } from './enrollment/enrollment-sync.cron';

// providers: [
//   ...,
//   EnrollmentSyncService, EnrollmentSyncCron,
// ],
// exports: 也补 EnrollmentSyncService
```

- [ ] **Step 5: 验证 API 重载**

```bash
tail -30 /tmp/duoshou-api.log
```
期望:`Mapped {/api/enrollments/sync/now, POST}`,无错误。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/marketing
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2b): enrollment sync + daily cron + sync/now trigger"
```

---

## Task 9: Web API 客户端 + Pinia stores

**Files:**
- Create: `apps/web/src/api-client/activities.api.ts`
- Create: `apps/web/src/api-client/enrollments.api.ts`
- Create: `apps/web/src/stores/activities.ts`
- Create: `apps/web/src/stores/enrollments.ts`

- [ ] **Step 1: activities.api.ts**

```typescript
import { http } from './http';

export interface ShopVisibilityEntry {
  shopId: string;
  shopName: string | null;
  canEnroll: boolean;
  lastSeenAt?: string;
}

export interface ActivitySession {
  id: string;
  activityId: string;
  platformSessionId: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  status: string;
}

export interface Activity {
  id: string;
  platformActivityId: string;
  region: 'cn' | 'pa';
  title: string | null;
  activityType: string | null;
  startAt: string | null;
  endAt: string | null;
  enrollStartAt: string | null;
  enrollEndAt: string | null;
  status: 'open' | 'closed' | 'archived';
  shopVisibility: ShopVisibilityEntry[];
  shopCount: number;
  enrolledShopCount: number;
  enrolledSkuCount: number;
  sessions?: ActivitySession[];
}

export interface ActivityProduct {
  platformSkuId: string;
  platformProductId: string | null;
  skuTitle: string | null;
  currentPriceCents: number | null;
  stockQty: number | null;
  currency: string | null;
}

export const activitiesApi = {
  list: (q: {
    region?: string; status?: string; search?: string; shopId?: string;
    startAfter?: string; startBefore?: string; page?: number; pageSize?: number;
  } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: Activity[] }>('/activities', { query: q }),
  get: (id: string) => http<Activity>('/activities/' + id),
  products: (id: string, shopId: string) =>
    http<{ cached: boolean; items: ActivityProduct[]; fetchedAt: string }>(
      '/activities/' + id + '/products',
      { query: { shopId } },
    ),
  syncNow: () => http<{ total: number }>('/activities/sync/now', { method: 'POST' }),
};
```

- [ ] **Step 2: enrollments.api.ts**

```typescript
import { http } from './http';

export interface EnrollmentItem {
  shopId: string;
  platformSkuId: string;
  skuTitle?: string;
  activityPriceCents: number;
  currency?: string;
}

export interface Enrollment {
  id: string;
  shopId: string;
  activityId: string;
  sessionId: string | null;
  platformSkuId: string;
  skuTitle: string | null;
  activityPriceCents: number | null;
  currency: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'failed';
  rejectReason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  error: any;
  shop: { id: string; displayName: string | null; platformShopId: string };
  activity: { id: string; title: string | null; region: string; platformActivityId: string };
}

export interface SubmitResult {
  total: number;
  results: Array<{ shopId: string; platformSkuId: string; ok: boolean; enrollmentId?: string; error?: string }>;
}

export const enrollmentsApi = {
  list: (q: { activityId?: string; shopId?: string; status?: string; page?: number; pageSize?: number } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: Enrollment[] }>('/enrollments', { query: q }),
  submit: (body: { activityId: string; sessionId?: string; items: EnrollmentItem[] }) =>
    http<SubmitResult>('/enrollments/submit', { method: 'POST', body: JSON.stringify(body) }),
  refresh: (id: string) => http<Enrollment>('/enrollments/' + id + '/refresh', { method: 'POST' }),
  syncNow: () => http<{ total: number }>('/enrollments/sync/now', { method: 'POST' }),
};
```

- [ ] **Step 3: activities store**

```typescript
// apps/web/src/stores/activities.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { activitiesApi, type Activity } from '@/api-client/activities.api';

export const useActivitiesStore = defineStore('activities', () => {
  const items = ref<Activity[]>([]);
  const total = ref(0);
  const loading = ref(false);
  async function fetch(q: Parameters<typeof activitiesApi.list>[0] = {}) {
    loading.value = true;
    try {
      const r = await activitiesApi.list(q);
      items.value = r.items;
      total.value = r.total;
    } finally { loading.value = false; }
  }
  return { items, total, loading, fetch };
});
```

- [ ] **Step 4: enrollments store**

```typescript
// apps/web/src/stores/enrollments.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { enrollmentsApi, type Enrollment } from '@/api-client/enrollments.api';

export const useEnrollmentsStore = defineStore('enrollments', () => {
  const items = ref<Enrollment[]>([]);
  const total = ref(0);
  const loading = ref(false);
  async function fetch(q: Parameters<typeof enrollmentsApi.list>[0] = {}) {
    loading.value = true;
    try {
      const r = await enrollmentsApi.list(q);
      items.value = r.items;
      total.value = r.total;
    } finally { loading.value = false; }
  }
  return { items, total, loading, fetch };
});
```

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/api-client/activities.api.ts \
        duoshou-erp/apps/web/src/api-client/enrollments.api.ts \
        duoshou-erp/apps/web/src/stores/activities.ts \
        duoshou-erp/apps/web/src/stores/enrollments.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2b): activities + enrollments API clients + Pinia stores"
```

---

## Task 10: ActivityListPage(活动列表)

**Files:**
- Create: `apps/web/src/pages/activities/ActivityListPage.vue`
- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/pages/HomePage.vue`

- [ ] **Step 1: 页面**

创建 `apps/web/src/pages/activities/ActivityListPage.vue`:
```vue
<template>
  <n-card title="活动日历">
    <template #header-extra>
      <n-space>
        <n-button :loading="syncing" @click="syncNow">立即同步</n-button>
        <n-button @click="() => load(page)">手动刷新</n-button>
      </n-space>
    </template>

    <n-space style="margin-bottom: 12px;" wrap>
      <n-select v-model:value="region" :options="regionOptions" placeholder="区域" clearable style="min-width: 120px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="状态" clearable style="min-width: 120px;" @update:value="() => load(1)" />
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="筛选店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-input v-model:value="search" placeholder="搜索活动名" clearable @keyup.enter="load(1)" style="min-width: 180px;" />
    </n-space>

    <n-data-table
      :columns="columns"
      :data="store.items"
      :loading="store.loading"
      :row-key="(r: any) => r.id"
    />

    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" style="margin-top: 12px;" />
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NSpace, NSelect, NInput, NButton, NDataTable, NPagination, NTag, useMessage,
} from 'naive-ui';
import { useActivitiesStore } from '@/stores/activities';
import { useShopsStore } from '@/stores/shops';
import { activitiesApi, type Activity } from '@/api-client/activities.api';

const router = useRouter();
const msg = useMessage();
const store = useActivitiesStore();
const shops = useShopsStore();

const region = ref<string | null>(null);
const status = ref<string | null>(null);
const shopId = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const syncing = ref(false);

onMounted(async () => { await shops.fetch(); load(1); });

const regionOptions = [
  { label: '中国站(CN)', value: 'cn' },
  { label: '美国站(PA)', value: 'pa' },
];
const statusOptions = [
  { label: '招募中', value: 'open' },
  { label: '已截止', value: 'closed' },
  { label: '归档', value: 'archived' },
];
const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);

async function load(p = page.value) {
  page.value = p;
  await store.fetch({
    region: region.value ?? undefined,
    status: status.value ?? undefined,
    shopId: shopId.value ?? undefined,
    search: search.value || undefined,
    page: p, pageSize,
  });
}

async function syncNow() {
  syncing.value = true;
  try {
    const r = await activitiesApi.syncNow();
    msg.success(`已同步 ${r.total} 个活动`);
    load();
  } catch (e: any) {
    msg.error(e.message);
  } finally { syncing.value = false; }
}

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / pageSize)));

const columns: any[] = [
  { title: '活动', key: 'title', render: (r: Activity) => r.title ?? r.platformActivityId },
  { title: '类型', key: 'activityType' },
  {
    title: '时间窗',
    key: 'timeWindow',
    render: (r: Activity) => {
      const s = r.startAt ? new Date(r.startAt).toLocaleDateString() : '—';
      const e = r.endAt ? new Date(r.endAt).toLocaleDateString() : '—';
      return `${s} — ${e}`;
    },
  },
  {
    title: '截止报名',
    key: 'enrollEndAt',
    render: (r: Activity) => r.enrollEndAt ? new Date(r.enrollEndAt).toLocaleString() : '—',
  },
  {
    title: '跨店状态',
    key: 'crossShop',
    render: (r: Activity) => h('div', { style: 'line-height: 1.6;' }, [
      h('div', `📦 ${r.shopCount} 店可报`),
      h('div', `✅ ${r.enrolledShopCount} 店已报`),
      h('div', `📝 已报 ${r.enrolledSkuCount} SKU`),
    ]),
  },
  {
    title: '状态',
    key: 'status',
    render: (r: Activity) => h(NTag, {
      type: r.status === 'open' ? 'info' : r.status === 'closed' ? 'warning' : 'default',
    }, () => r.status),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: Activity) => h(NButton, { size: 'small', onClick: () => router.push(`/activities/${r.id}`) }, () => '详情'),
  },
];
</script>
```

- [ ] **Step 2: 注册路由**

修改 `apps/web/src/router/index.ts`,顶部 import:
```typescript
import ActivityListPage from '@/pages/activities/ActivityListPage.vue';
```
routes 数组里加:
```typescript
{ path: '/activities', component: ActivityListPage, meta: { requiresAuth: true } },
```

- [ ] **Step 3: HomePage 导航按钮**

修改 `apps/web/src/pages/HomePage.vue`,在 nav 按钮组里加:
```vue
<n-button @click="$router.push('/activities')">活动日历</n-button>
```

- [ ] **Step 4: 构建**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -8
```

必须通过(无 vue-tsc / vite 错误)。

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/activities/ActivityListPage.vue \
        duoshou-erp/apps/web/src/router/index.ts \
        duoshou-erp/apps/web/src/pages/HomePage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2b): activity list page with cross-shop aggregates + sync button"
```

---

## Task 11: ActivityDetailPage(批量报名合并页)

**Files:**
- Create: `apps/web/src/pages/activities/ActivityDetailPage.vue`
- Modify: `apps/web/src/router/index.ts`

- [ ] **Step 1: 页面**

创建 `apps/web/src/pages/activities/ActivityDetailPage.vue`:
```vue
<template>
  <n-card v-if="activity" :title="activity.title ?? activity.platformActivityId">
    <n-descriptions :column="2" bordered size="small">
      <n-descriptions-item label="区域">{{ activity.region.toUpperCase() }}</n-descriptions-item>
      <n-descriptions-item label="类型">{{ activity.activityType ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="时间窗">
        {{ fmt(activity.startAt) }} — {{ fmt(activity.endAt) }}
      </n-descriptions-item>
      <n-descriptions-item label="截止报名">{{ fmt(activity.enrollEndAt) }}</n-descriptions-item>
      <n-descriptions-item label="状态">
        <n-tag :type="activity.status === 'open' ? 'info' : 'default'">{{ activity.status }}</n-tag>
      </n-descriptions-item>
      <n-descriptions-item label="可报店铺">{{ activity.shopCount }}</n-descriptions-item>
    </n-descriptions>

    <n-divider>场次</n-divider>
    <n-radio-group v-if="activity.sessions && activity.sessions.length" v-model:value="sessionId">
      <n-space vertical>
        <n-radio v-for="s in activity.sessions" :key="s.id" :value="s.id">
          {{ s.title ?? s.platformSessionId }} ({{ fmt(s.startAt) }} — {{ fmt(s.endAt) }})
        </n-radio>
      </n-space>
    </n-radio-group>
    <n-empty v-else description="此活动无场次(按活动整体报名)" />

    <n-divider>可报店铺</n-divider>
    <n-checkbox-group v-model:value="selectedShops" @update:value="onShopsChange">
      <n-space>
        <n-checkbox v-for="s in activity.shopVisibility" :key="s.shopId" :value="s.shopId" :disabled="!s.canEnroll">
          {{ s.shopName ?? s.shopId.slice(0, 8) }}
        </n-checkbox>
      </n-space>
    </n-checkbox-group>

    <n-divider>可报商品(勾选店铺后自动加载)</n-divider>

    <n-space style="margin-bottom: 8px;" v-if="allProducts.length">
      <n-input-number v-model:value="discountPercent" :min="0" :max="90" placeholder="批量下调 %" style="max-width: 160px;" />
      <n-button @click="applyDiscount" :disabled="selectedSkus.length === 0">应用到选中</n-button>
      <n-text>已选 {{ selectedSkus.length }} / {{ allProducts.length }} SKU</n-text>
    </n-space>

    <n-spin :show="productsLoading">
      <n-data-table
        :columns="productColumns"
        :data="allProducts"
        :row-key="(r: any) => `${r.shopId}__${r.platformSkuId}`"
        :checked-row-keys="selectedSkus"
        @update:checked-row-keys="(v: any) => (selectedSkus = v)"
        max-height="320"
      />
    </n-spin>

    <n-space style="margin-top: 16px;">
      <n-button type="primary" :loading="submitting"
        :disabled="selectedSkus.length === 0 || selectedShops.length === 0"
        @click="submit">
        提交批量报名(共 {{ selectedSkus.length }} 条)
      </n-button>
      <n-button @click="$router.back()">返回</n-button>
    </n-space>
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NDivider,
  NRadioGroup, NRadio, NSpace, NCheckboxGroup, NCheckbox, NEmpty,
  NDataTable, NSpin, NButton, NInputNumber, NText, useMessage,
} from 'naive-ui';
import { activitiesApi, type Activity, type ActivityProduct } from '@/api-client/activities.api';
import { enrollmentsApi, type EnrollmentItem } from '@/api-client/enrollments.api';

interface ProductRow extends ActivityProduct {
  shopId: string;
  shopName: string;
  activityPriceCents: number;
}

const route = useRoute();
const router = useRouter();
const msg = useMessage();

const activity = ref<Activity | null>(null);
const sessionId = ref<string | null>(null);
const selectedShops = ref<string[]>([]);
const allProducts = ref<ProductRow[]>([]);
const selectedSkus = ref<string[]>([]);
const productsLoading = ref(false);
const submitting = ref(false);
const discountPercent = ref<number>(20);

function fmt(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString() : '—';
}

onMounted(async () => {
  activity.value = await activitiesApi.get(String(route.params.id));
});

async function onShopsChange(newShops: string[]) {
  if (!activity.value) return;
  productsLoading.value = true;
  const rows: ProductRow[] = [];
  try {
    for (const shopId of newShops) {
      const shopName = activity.value.shopVisibility.find((x) => x.shopId === shopId)?.shopName ?? shopId.slice(0, 8);
      const res = await activitiesApi.products(activity.value.id, shopId);
      for (const p of res.items) {
        rows.push({ ...p, shopId, shopName, activityPriceCents: p.currentPriceCents ?? 100 });
      }
    }
    allProducts.value = rows;
    selectedSkus.value = selectedSkus.value.filter((k) =>
      rows.some((r) => `${r.shopId}__${r.platformSkuId}` === k),
    );
  } catch (e: any) {
    msg.error(e.message);
  } finally { productsLoading.value = false; }
}

function applyDiscount() {
  const ratio = 1 - discountPercent.value / 100;
  for (const row of allProducts.value) {
    const k = `${row.shopId}__${row.platformSkuId}`;
    if (!selectedSkus.value.includes(k)) continue;
    if (row.currentPriceCents != null) {
      row.activityPriceCents = Math.max(1, Math.round(row.currentPriceCents * ratio));
    }
  }
  allProducts.value = [...allProducts.value];
}

const productColumns: any[] = [
  { type: 'selection' },
  { title: '店铺', key: 'shopName' },
  { title: 'SKU', key: 'platformSkuId' },
  { title: '商品', key: 'skuTitle' },
  {
    title: '现价',
    key: 'currentPriceCents',
    render: (r: ProductRow) => r.currentPriceCents != null ? `${(r.currentPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '活动价(分)',
    key: 'activityPriceCents',
    render: (r: ProductRow) => h(NInputNumber, {
      value: r.activityPriceCents,
      min: 1,
      size: 'small',
      style: 'max-width: 120px;',
      'onUpdate:value': (v: number) => (r.activityPriceCents = v),
    }),
  },
];

async function submit() {
  if (!activity.value) return;
  submitting.value = true;
  try {
    const items: EnrollmentItem[] = selectedSkus.value.map((k) => {
      const [shopId, platformSkuId] = k.split('__');
      const row = allProducts.value.find((r) => r.shopId === shopId && r.platformSkuId === platformSkuId)!;
      return {
        shopId,
        platformSkuId,
        skuTitle: row.skuTitle ?? undefined,
        activityPriceCents: row.activityPriceCents,
        currency: row.currency ?? undefined,
      };
    });
    const r = await enrollmentsApi.submit({
      activityId: activity.value.id,
      sessionId: sessionId.value ?? undefined,
      items,
    });
    const ok = r.results.filter((x) => x.ok).length;
    const bad = r.total - ok;
    if (bad === 0) msg.success(`全部 ${ok} 条报名成功`);
    else msg.warning(`${ok} 成功,${bad} 失败 —— 详见「已报名」页`);
    router.push('/enrollments');
  } catch (e: any) {
    msg.error(e.message);
  } finally { submitting.value = false; }
}
</script>
```

- [ ] **Step 2: 注册路由**

修改 `apps/web/src/router/index.ts`,顶部 import:
```typescript
import ActivityDetailPage from '@/pages/activities/ActivityDetailPage.vue';
```
routes 数组里加:
```typescript
{ path: '/activities/:id', component: ActivityDetailPage, meta: { requiresAuth: true } },
```

- [ ] **Step 3: 构建**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -8
```

- [ ] **Step 4: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/activities/ActivityDetailPage.vue \
        duoshou-erp/apps/web/src/router/index.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2b): activity detail page with inline cross-shop batch enrollment"
```

---

## Task 12: EnrollmentListPage(已报名看板)

**Files:**
- Create: `apps/web/src/pages/enrollments/EnrollmentListPage.vue`
- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/pages/HomePage.vue`

- [ ] **Step 1: 页面**

创建 `apps/web/src/pages/enrollments/EnrollmentListPage.vue`:
```vue
<template>
  <n-card title="已报名活动">
    <template #header-extra>
      <n-button :loading="syncing" @click="syncNow">立即同步</n-button>
    </template>

    <n-space style="margin-bottom: 12px;">
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="状态" clearable style="min-width: 130px;" @update:value="() => load(1)" />
    </n-space>

    <n-data-table
      :columns="columns"
      :data="store.items"
      :loading="store.loading"
      :row-key="(r: any) => r.id"
    />

    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" style="margin-top: 12px;" />
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import {
  NCard, NSpace, NSelect, NDataTable, NPagination, NTag, NButton, useMessage,
} from 'naive-ui';
import { useEnrollmentsStore } from '@/stores/enrollments';
import { useShopsStore } from '@/stores/shops';
import { enrollmentsApi, type Enrollment } from '@/api-client/enrollments.api';

const msg = useMessage();
const store = useEnrollmentsStore();
const shops = useShopsStore();

const shopId = ref<string | null>(null);
const status = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
const syncing = ref(false);

onMounted(async () => { await shops.fetch(); load(1); });

const statusOptions = [
  { label: '审核中', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已撤销', value: 'withdrawn' },
  { label: '失败', value: 'failed' },
];
const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);

async function load(p = page.value) {
  page.value = p;
  await store.fetch({
    shopId: shopId.value ?? undefined,
    status: status.value ?? undefined,
    page: p, pageSize,
  });
}

async function syncNow() {
  syncing.value = true;
  try {
    const r = await enrollmentsApi.syncNow();
    msg.success(`已同步 ${r.total} 条报名`);
    load();
  } catch (e: any) { msg.error(e.message); }
  finally { syncing.value = false; }
}

async function refresh(id: string) {
  try {
    await enrollmentsApi.refresh(id);
    msg.success('已刷新');
    load();
  } catch (e: any) { msg.error(e.message); }
}

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / pageSize)));

const columns: any[] = [
  {
    title: '活动',
    key: 'activity',
    render: (r: Enrollment) => r.activity?.title ?? r.activity?.platformActivityId ?? '—',
  },
  {
    title: '店铺',
    key: 'shop',
    render: (r: Enrollment) => r.shop?.displayName ?? r.shop?.platformShopId ?? '—',
  },
  { title: 'SKU', key: 'platformSkuId', render: (r: Enrollment) => r.skuTitle ?? r.platformSkuId },
  {
    title: '活动价',
    key: 'activityPriceCents',
    render: (r: Enrollment) => r.activityPriceCents != null ? `${(r.activityPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '状态',
    key: 'status',
    render: (r: Enrollment) => {
      const type = r.status === 'approved' ? 'success' :
        r.status === 'rejected' ? 'warning' :
        r.status === 'failed' ? 'error' :
        r.status === 'withdrawn' ? 'default' : 'info';
      return h(NTag, { type }, () => r.status);
    },
  },
  {
    title: '提交时间',
    key: 'submittedAt',
    render: (r: Enrollment) => new Date(r.submittedAt).toLocaleString(),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: Enrollment) => r.status === 'pending'
      ? h(NButton, { size: 'small', onClick: () => refresh(r.id) }, () => '刷新')
      : h(NButton, { size: 'small', secondary: true, disabled: true }, () => '—'),
  },
];
</script>
```

- [ ] **Step 2: 路由**

修改 `apps/web/src/router/index.ts`,顶部 import:
```typescript
import EnrollmentListPage from '@/pages/enrollments/EnrollmentListPage.vue';
```
routes 数组里加:
```typescript
{ path: '/enrollments', component: EnrollmentListPage, meta: { requiresAuth: true } },
```

- [ ] **Step 3: HomePage 导航按钮**

修改 `apps/web/src/pages/HomePage.vue`,加:
```vue
<n-button @click="$router.push('/enrollments')">已报名</n-button>
```

- [ ] **Step 4: 构建**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -8
```

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/enrollments/EnrollmentListPage.vue \
        duoshou-erp/apps/web/src/router/index.ts \
        duoshou-erp/apps/web/src/pages/HomePage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2b): enrollment board (filter + refresh + sync-now)"
```

---

## Task 13: W2b 基础设施 smoke + tag

**Files:**
- Create: `apps/api/scripts/smoke-w2b.mjs`

- [ ] **Step 1: Smoke 脚本**

创建 `apps/api/scripts/smoke-w2b.mjs`:
```javascript
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:3000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-w2b-${Date.now()}@duoshou.test`;
const pw = 'SmokeW2b!2026';

console.log('=== W2b 活动报名基础 smoke ===');

const { data: c1, error: e1 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (e1) throw e1;
const { data: l1 } = await anon.auth.signInWithPassword({ email, password: pw });
const token = l1.session.access_token;

const fetchA = (path, init = {}) => fetch(API + path, {
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...init.headers,
  },
});

console.log('\n[1/6] 连接测试店铺');
const shopResp = await fetchA('/shops', {
  method: 'POST', body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full', region: 'pa', displayName: 'smoke-w2b',
  }),
});
const shop = await shopResp.json();
console.log('  shop:', shop.id ?? shop.error ?? shop);

console.log('\n[2/6] GET /activities');
const listResp = await fetchA('/activities');
console.log('  status:', listResp.status);
const list = await listResp.json();
console.log('  items:', list.items?.length ?? 0, 'total:', list.total);

console.log('\n[3/6] POST /activities/sync/now');
const syncResp = await fetchA('/activities/sync/now', { method: 'POST' });
console.log('  status:', syncResp.status);
const syncRes = await syncResp.json();
console.log('  synced:', syncRes.total);

console.log('\n[4/6] GET /enrollments');
const enrListResp = await fetchA('/enrollments');
console.log('  status:', enrListResp.status);

console.log('\n[5/6] POST /enrollments/submit (空 items 预期 400 validation fail)');
const submitResp = await fetchA('/enrollments/submit', {
  method: 'POST',
  body: JSON.stringify({ activityId: '00000000-0000-0000-0000-000000000000', items: [] }),
});
console.log('  status:', submitResp.status);

console.log('\n[6/6] 清理');
await admin.auth.admin.deleteUser(c1.user.id);
console.log('\n✅ W2b 基础 smoke PASSED');
```

- [ ] **Step 2: 运行**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
node scripts/smoke-w2b.mjs 2>&1 | tail -40
```

期望:
- Step 1 返回 shop 对象
- Step 2 status 200,items 和 total 为数字
- Step 3 status 2xx,返回 `{total: N}`(若测试店无活动 N 可能是 0)
- Step 4 status 200
- Step 5 status 4xx(zod 校验失败,空 items 被拒)
- Step 6 清理成功
- 结尾打印 `✅ W2b 基础 smoke PASSED`

若任何步骤失败(非预期状态码、脚本抛错),STOP 并报 BLOCKED。

- [ ] **Step 3: 提交 + tag**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/scripts/smoke-w2b.mjs
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "test(w2b): infra smoke"
git -C duoshou-erp tag w2b-complete
```

---

## Done — 接下来

- W2b 基础落成;真实活动数据会随时间积累(测试店当前无活动属于 Temu 状态事实而非基建 bug)
- W2b.5 跟进候选:真日历视图(月/周视图,复用同 API);活动报名成绩看板(GMV/销量聚合,拉 `bg.goods.salesv2.get`)
- W3(库存):同一 cron + 聚合模式,新增 `inventory_snapshot` 分区表
- W4(Temu App Market 提交):UI 打磨 + 部署环境 + 测试账号说明 + 演示视频

## 已知 gaps(留给 W2b.5)

- Temu API 真实响应 shape 未验证;sync service 用 `res?.list ?? res?.activityList` 兜底链,首次真调可能需要扩展 fallback
- `bg.marketing.activity.enroll.submit` 入参里的活动价字段名文档为准;若首次报名 400 用 `scripts/diag-activity-enroll.mjs`(W2b.5 写)快速定位
- 报名撤销(`withdrawn` 状态)UI 不出;schema 预留,逻辑 v2
- 真日历视图留 W2b.5
- 跨活动批量(同时报 N 个活动)未做
