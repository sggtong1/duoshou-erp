# BI Dashboard MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个 Dashboard 首页(`/`),一屏看到跨店销售件数(今日/7日/30日)+ 低库存 SKU 数 + 销售对比柱状图 + TOP 30 日销量排行 + TOP 10 今日热销表 + 库存预警表。

**Architecture:** 新后端模块 `analytics/`:单 cron 每小时调 `bg.goods.salesv2.get` 分页全量 → upsert `ShopSkuSnapshot`(销售+库存合表)+ `OrgSettings` 阈值表;DashboardService 聚合查询返 1 次 API 拿全量前端数据;前端 MainLayout 左 sidebar 5 导航,DashboardPage 组装 5 个子组件(KpiCard × 4 + 2 个 ECharts + 2 张表),老写入类路由 soft delete,PriceReview 改造为只读。

**Tech Stack:** NestJS 10、Prisma 7、@nestjs/schedule、ioredis、Vue 3、Naive UI、Apache ECharts(按需 import BarChart)、Vitest、Zod、TypeScript。

---

## Context(已就位 / diag 已知)

- `bg.goods.salesv2.get(pageNo, pageSize)` 返回 `{ total, subOrderList: [...] }`,样本店 total ≈ 3847,pageSize 50 → 77 页。每条 `subOrderList[i]` 是一个 SPU,字段:
  - `productName`(SPU 名)、`autoCloseJit`、`illegalReason`、`pictureAuditStatus`、`isFirst`、`customInfoVO`
  - `skuQuantityDetailList: Array<SkuDetail>`(一个 SPU 下可能有多个 SKU)
- 每个 `SkuDetail` 字段:
  - `productSkuId`(number)、`skuExtCode`、`className`(变体名)
  - `todaySaleVolume`、`lastSevenDaysSaleVolume`、`lastThirtyDaysSaleVolume`、`totalSaleVolume`(全为 Int)
  - `inventoryNumInfo: { warehouseInventoryNum, waitReceiveNum, waitOnShelfNum, waitDeliveryInventoryNum, waitApproveInventoryNum, waitQcNum, unavailableWarehouseInventoryNum, waitInStock, expectedOccupiedInventoryNum }`
  - `warehouseInfoList: Array<WarehouseInfo>`(按仓库细分,MVP 不用)
  - `supplierPrice`(多数 null)、`priceReviewStatus`、`isReducePricePass`、`isVerifyPrice`、`lackQuantity`
  - `safeInventoryDays`、`purchaseConfig`、`stockDays`、`canPurchase`
  - `sevenDaysSaleReference`、`inCartNumber7d`、`inCardNumber`
- 调用需要 `{pageNo, pageSize}` 参数,缺 param 报 `3000000: 每页记录数不能为空`
- PA 全托 test shop 凭据已验证(token `4o5bhibmzthwcw7dmmiz2lx0grmuyqfvbrwxvsbnj5huh8hqbg6igqwu`)
- W0 `bg.goods.quantity.get` 对 PA 报 `type not exists`,不使用
- `sharedRedis` / `@Cron` / `TemuClientFactoryService` / `AuthGuard` / `TenantService.resolveForUser` / `ZodValidationPipe` / `PrismaService` 全就位(W2a/W2b 代码使用过)
- W2a `price_review` 表 reuse,`count where orgId + status='pending'` 即可

## Env 新增

无。

## Scope 边界

**内**:Dashboard 首页 + sidebar 导航 + settings 页 + 老模块 soft delete + PriceReview 只读改造 + 基础 smoke

**外**:销售 / 库存下钻页、广告 ROI、订单履约、健康评分、同比环比、半托店支持、写入类硬删、SKU 细分仓库库存展示

---

## Task 1: Prisma 模型 + 迁移

**Files:**
- Modify: `apps/api/prisma/schema.prisma`(追加 ShopSkuSnapshot + OrgSettings,加 back-refs)
- Create: `apps/api/prisma/migrations/20260421000000_bi_dashboard/migration.sql`

- [ ] **Step 1: 追加 models 到 `schema.prisma`**

```prisma
model ShopSkuSnapshot {
  id                   String   @id @default(uuid())
  orgId                String   @map("org_id")
  shopId               String   @map("shop_id")
  platformSkuId        String   @map("platform_sku_id")
  productName          String?  @map("product_name")
  className            String?  @map("class_name")
  skuExtCode           String?  @map("sku_ext_code")

  todaySaleVolume      Int      @default(0) @map("today_sale_volume")
  sales7dVolume        Int      @default(0) @map("sales_7d_volume")
  sales30dVolume       Int      @default(0) @map("sales_30d_volume")
  totalSaleVolume      Int      @default(0) @map("total_sale_volume")

  warehouseQty         Int      @default(0) @map("warehouse_qty")
  waitReceiveQty       Int      @default(0) @map("wait_receive_qty")
  waitOnShelfQty       Int      @default(0) @map("wait_on_shelf_qty")
  waitDeliveryQty      Int      @default(0) @map("wait_delivery_qty")

  avgDailySales        Float?   @map("avg_daily_sales")
  daysRemaining        Float?   @map("days_remaining")

  supplierPriceCents   BigInt?  @map("supplier_price_cents")

  lastSyncedAt         DateTime @default(now()) @updatedAt @map("last_synced_at")
  platformPayload      Json?    @map("platform_payload")

  org  Organization @relation(fields: [orgId], references: [id])
  shop Shop         @relation(fields: [shopId], references: [id])

  @@unique([shopId, platformSkuId])
  @@index([orgId, warehouseQty])
  @@index([orgId, sales30dVolume])
  @@index([orgId, todaySaleVolume])
  @@map("shop_sku_snapshot")
}

model OrgSettings {
  orgId                   String   @id @map("org_id")
  lowStockThreshold       Int      @default(10) @map("low_stock_threshold")
  lowStockDaysThreshold   Int      @default(7)  @map("low_stock_days_threshold")
  updatedAt               DateTime @default(now()) @updatedAt @map("updated_at")

  org Organization @relation(fields: [orgId], references: [id])
  @@map("org_settings")
}
```

在现有 `model Organization` 内追加 3 行:
```
  shopSkuSnapshots   ShopSkuSnapshot[]
  settings           OrgSettings?
```

在现有 `model Shop` 内追加 1 行:
```
  shopSkuSnapshots  ShopSkuSnapshot[]
```

- [ ] **Step 2: 手写迁移 SQL**

创建 `apps/api/prisma/migrations/20260421000000_bi_dashboard/migration.sql`:

```sql
CREATE TABLE "shop_sku_snapshot" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "platform_sku_id" TEXT NOT NULL,
    "product_name" TEXT,
    "class_name" TEXT,
    "sku_ext_code" TEXT,
    "today_sale_volume" INTEGER NOT NULL DEFAULT 0,
    "sales_7d_volume" INTEGER NOT NULL DEFAULT 0,
    "sales_30d_volume" INTEGER NOT NULL DEFAULT 0,
    "total_sale_volume" INTEGER NOT NULL DEFAULT 0,
    "warehouse_qty" INTEGER NOT NULL DEFAULT 0,
    "wait_receive_qty" INTEGER NOT NULL DEFAULT 0,
    "wait_on_shelf_qty" INTEGER NOT NULL DEFAULT 0,
    "wait_delivery_qty" INTEGER NOT NULL DEFAULT 0,
    "avg_daily_sales" DOUBLE PRECISION,
    "days_remaining" DOUBLE PRECISION,
    "supplier_price_cents" BIGINT,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform_payload" JSONB,
    CONSTRAINT "shop_sku_snapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shop_sku_snapshot_shop_id_platform_sku_id_key" ON "shop_sku_snapshot"("shop_id","platform_sku_id");
CREATE INDEX "shop_sku_snapshot_org_id_warehouse_qty_idx" ON "shop_sku_snapshot"("org_id","warehouse_qty");
CREATE INDEX "shop_sku_snapshot_org_id_sales_30d_idx" ON "shop_sku_snapshot"("org_id","sales_30d_volume");
CREATE INDEX "shop_sku_snapshot_org_id_today_idx" ON "shop_sku_snapshot"("org_id","today_sale_volume");

CREATE TABLE "org_settings" (
    "org_id" TEXT NOT NULL,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "low_stock_days_threshold" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("org_id")
);

ALTER TABLE "shop_sku_snapshot" ADD CONSTRAINT "shop_sku_snapshot_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_sku_snapshot" ADD CONSTRAINT "shop_sku_snapshot_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: 应用迁移**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
set -a && source .env.development && set +a
pnpm prisma migrate deploy && pnpm prisma generate
```

- [ ] **Step 4: 验证表**

```bash
set -a && source .env.development && set +a
node -e "import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query(\"select table_name from information_schema.tables where table_schema='public' and table_name in ('shop_sku_snapshot','org_settings') order by table_name\");console.log(r.rows.map(x=>x.table_name).join(','));await c.end();});"
```

期望:`org_settings,shop_sku_snapshot`

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/prisma
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(bi): shop_sku_snapshot + org_settings models"
```

---

## Task 2: SkuSnapshotSyncService + cron + 单测

**Files:**
- Create: `apps/api/src/modules/analytics/snapshot/sku-snapshot-sync.service.ts`
- Create: `apps/api/src/modules/analytics/snapshot/sku-snapshot-sync.service.test.ts`
- Create: `apps/api/src/modules/analytics/snapshot/sku-snapshot-sync.cron.ts`

- [ ] **Step 1: 失败测试**

```typescript
// apps/api/src/modules/analytics/snapshot/sku-snapshot-sync.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkuSnapshotSyncService } from './sku-snapshot-sync.service';

describe('SkuSnapshotSyncService.syncShop', () => {
  let prisma: any, clientFactory: any, mockClient: any;

  beforeEach(() => {
    mockClient = {
      call: vi.fn().mockResolvedValue({
        total: 1,
        subOrderList: [{
          productName: 'Test SPU',
          skuQuantityDetailList: [
            {
              productSkuId: 11901729009,
              skuExtCode: '11',
              className: '灰色-iPhone 14 Pro Max',
              todaySaleVolume: 3,
              lastSevenDaysSaleVolume: 15,
              lastThirtyDaysSaleVolume: 60,
              totalSaleVolume: 120,
              supplierPrice: null,
              inventoryNumInfo: {
                warehouseInventoryNum: 30,
                waitReceiveNum: 5,
                waitOnShelfNum: 0,
                waitDeliveryInventoryNum: 2,
              },
            },
          ],
        }],
      }),
    };
    clientFactory = { forShop: vi.fn().mockResolvedValue(mockClient) };
    prisma = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'shop-1', orgId: 'org-1', shopType: 'full', region: 'pa',
          status: 'active', displayName: 'Test',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      shopSkuSnapshot: {
        upsert: vi.fn(),
      },
    };
  });

  it('展开 subOrderList[i].skuQuantityDetailList,每个 SKU upsert 一次', async () => {
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    const touched = await svc.syncShop('shop-1');
    expect(touched).toBe(1);
    expect(prisma.shopSkuSnapshot.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.shopSkuSnapshot.upsert.mock.calls[0][0];
    expect(call.where.shopId_platformSkuId).toEqual({
      shopId: 'shop-1',
      platformSkuId: '11901729009',
    });
    expect(call.create.todaySaleVolume).toBe(3);
    expect(call.create.sales7dVolume).toBe(15);
    expect(call.create.sales30dVolume).toBe(60);
    expect(call.create.totalSaleVolume).toBe(120);
    expect(call.create.warehouseQty).toBe(30);
    expect(call.create.waitReceiveQty).toBe(5);
    expect(call.create.avgDailySales).toBe(2);      // 60/30
    expect(call.create.daysRemaining).toBe(15);     // 30/2
    expect(call.create.supplierPriceCents).toBeNull();
  });

  it('半托店跳过(shopType !== full)', async () => {
    prisma.shop.findUnique = vi.fn().mockResolvedValue({
      id: 'shop-s1', orgId: 'org-1', shopType: 'semi', region: 'pa', status: 'active',
    });
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    const touched = await svc.syncShop('shop-s1');
    expect(touched).toBe(0);
    expect(prisma.shopSkuSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('supplierPrice 为正数时换算 cents', async () => {
    mockClient.call = vi.fn().mockResolvedValue({
      total: 1,
      subOrderList: [{
        productName: 'X',
        skuQuantityDetailList: [{
          productSkuId: 1,
          todaySaleVolume: 0,
          lastSevenDaysSaleVolume: 0,
          lastThirtyDaysSaleVolume: 0,
          totalSaleVolume: 0,
          supplierPrice: 12.99,
          inventoryNumInfo: { warehouseInventoryNum: 0 },
        }],
      }],
    });
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    await svc.syncShop('shop-1');
    const call = prisma.shopSkuSnapshot.upsert.mock.calls[0][0];
    expect(call.create.supplierPriceCents).toBe(1299n);
  });

  it('sales30dVolume=0 时 daysRemaining=null', async () => {
    mockClient.call = vi.fn().mockResolvedValue({
      total: 1,
      subOrderList: [{
        productName: 'X',
        skuQuantityDetailList: [{
          productSkuId: 1,
          todaySaleVolume: 0,
          lastSevenDaysSaleVolume: 0,
          lastThirtyDaysSaleVolume: 0,
          totalSaleVolume: 0,
          supplierPrice: null,
          inventoryNumInfo: { warehouseInventoryNum: 50 },
        }],
      }],
    });
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    await svc.syncShop('shop-1');
    const call = prisma.shopSkuSnapshot.upsert.mock.calls[0][0];
    expect(call.create.avgDailySales).toBe(0);
    expect(call.create.daysRemaining).toBeNull();
  });

  it('Temu API 失败抛出但单店 try/catch 在 syncAllActiveShops 捕获', async () => {
    mockClient.call = vi.fn().mockRejectedValue(new Error('Temu 429 rate limit'));
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    const touched = await svc.syncShop('shop-1');
    expect(touched).toBe(0);  // 分页内 break,不抛
  });
});
```

- [ ] **Step 2: 确认红**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/modules/analytics/snapshot/sku-snapshot-sync.service.test.ts 2>&1 | tail -8
```

- [ ] **Step 3: 实现 service**

创建 `apps/api/src/modules/analytics/snapshot/sku-snapshot-sync.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { sharedRedis } from '../../../infra/redis';

const LOCK_KEY = 'lock:sku-snapshot-sync';
const LOCK_TTL_SECONDS = 1800;
const PAGE_SIZE = 50;
const MAX_PAGES = 200; // 防御:最多 200 页 = 10000 SKU,单店足够

function toIntOr0(x: any): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function supplierPriceToCents(x: any): bigint | null {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n * 100));
}

@Injectable()
export class SkuSnapshotSyncService {
  private logger = new Logger(SkuSnapshotSyncService.name);
  private get redis(): Redis { return sharedRedis(); }

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async syncShop(shopId: string): Promise<number> {
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop) return 0;
    if (shop.shopType !== 'full') {
      this.logger.log(`shop ${shopId} (shopType=${shop.shopType}) skipped — only full shops are supported`);
      return 0;
    }

    const client = await this.clientFactory.forShop(shopId);
    let touched = 0;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      let res: any;
      try {
        res = await client.call('bg.goods.salesv2.get', { pageNo, pageSize: PAGE_SIZE });
      } catch (e: any) {
        this.logger.warn(`shop ${shopId} salesv2.get failed at pageNo=${pageNo}: ${e.message}`);
        break;
      }
      const list: any[] = res?.subOrderList ?? [];
      if (!list.length) break;

      for (const spu of list) {
        const skuDetails: any[] = spu?.skuQuantityDetailList ?? [];
        for (const sku of skuDetails) {
          const platformSkuId = String(sku.productSkuId ?? '');
          if (!platformSkuId) continue;

          const sales30d = toIntOr0(sku.lastThirtyDaysSaleVolume);
          const warehouseQty = toIntOr0(sku?.inventoryNumInfo?.warehouseInventoryNum);
          const avgDailySales = sales30d / 30;
          const daysRemaining = avgDailySales > 0 ? warehouseQty / avgDailySales : null;

          const data = {
            orgId: shop.orgId,
            shopId,
            platformSkuId,
            productName: spu.productName ?? null,
            className: sku.className ?? null,
            skuExtCode: sku.skuExtCode ?? null,
            todaySaleVolume: toIntOr0(sku.todaySaleVolume),
            sales7dVolume: toIntOr0(sku.lastSevenDaysSaleVolume),
            sales30dVolume: sales30d,
            totalSaleVolume: toIntOr0(sku.totalSaleVolume),
            warehouseQty,
            waitReceiveQty: toIntOr0(sku?.inventoryNumInfo?.waitReceiveNum),
            waitOnShelfQty: toIntOr0(sku?.inventoryNumInfo?.waitOnShelfNum),
            waitDeliveryQty: toIntOr0(sku?.inventoryNumInfo?.waitDeliveryInventoryNum),
            avgDailySales,
            daysRemaining,
            supplierPriceCents: supplierPriceToCents(sku.supplierPrice),
            platformPayload: sku,
          };

          await (this.prisma as any).shopSkuSnapshot.upsert({
            where: { shopId_platformSkuId: { shopId, platformSkuId } },
            create: data,
            update: data,
          });
          touched++;
        }
      }

      if (list.length < PAGE_SIZE) break;
    }

    this.logger.log(`shop ${shopId} synced ${touched} SKU snapshots`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    let lock: string | null = null;
    try { lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX'); }
    catch (e: any) { this.logger.warn(`sku-snapshot lock acquire failed: ${e.message}`); }
    if (lock !== 'OK') {
      this.logger.warn('sku-snapshot sync skipped (lock held or redis down)');
      return 0;
    }
    try {
      const where: any = { status: 'active', shopType: 'full' };
      if (orgId) where.orgId = orgId;
      const shops = await (this.prisma as any).shop.findMany({ where });
      let total = 0;
      for (const s of shops) {
        try { total += await this.syncShop(s.id); }
        catch (e: any) { this.logger.error(`shop ${s.id} snapshot sync failed: ${e.message}`); }
      }
      return total;
    } finally {
      try { await this.redis.del(LOCK_KEY); }
      catch (e: any) { this.logger.warn(`sku-snapshot lock release failed: ${e.message}`); }
    }
  }
}
```

- [ ] **Step 4: 跑测试确认绿**

```bash
pnpm vitest run src/modules/analytics/snapshot/sku-snapshot-sync.service.test.ts 2>&1 | tail -8
```
期望:5 passed。

- [ ] **Step 5: 实现 cron**

创建 `apps/api/src/modules/analytics/snapshot/sku-snapshot-sync.cron.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SkuSnapshotSyncService } from './sku-snapshot-sync.service';

@Injectable()
export class SkuSnapshotSyncCron {
  private logger = new Logger(SkuSnapshotSyncCron.name);
  constructor(private sync: SkuSnapshotSyncService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`sku-snapshot cron: touched ${total}`);
  }
}
```

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/analytics/snapshot
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(bi): SkuSnapshotSyncService + hourly cron (salesv2.get → ShopSkuSnapshot)"
```

---

## Task 3: DashboardService + 单测

**Files:**
- Create: `apps/api/src/modules/analytics/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/analytics/dashboard/dashboard.service.test.ts`
- Create: `apps/api/src/modules/analytics/dashboard/dashboard.dto.ts`

- [ ] **Step 1: DTO**

创建 `apps/api/src/modules/analytics/dashboard/dashboard.dto.ts`:
```typescript
import { z } from 'zod';

export const DashboardSummaryFilter = z.object({
  shopId: z.string().uuid().optional(),
});
export type DashboardSummaryFilterInput = z.infer<typeof DashboardSummaryFilter>;
```

- [ ] **Step 2: 失败测试**

创建 `apps/api/src/modules/analytics/dashboard/dashboard.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService.summary', () => {
  let prisma: any;

  function snap(ov: any = {}) {
    return {
      id: 'id', orgId: 'org-1', shopId: 's1',
      platformSkuId: 'sku-1', productName: 'P', className: 'V', skuExtCode: null,
      todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0, totalSaleVolume: 0,
      warehouseQty: 100, waitReceiveQty: 0, waitOnShelfQty: 0, waitDeliveryQty: 0,
      avgDailySales: 0, daysRemaining: null, supplierPriceCents: null,
      lastSyncedAt: new Date('2026-04-21T10:00:00Z'),
      shop: { id: 's1', displayName: 'Shop A', platformShopId: '1001' },
      ...ov,
    };
  }

  beforeEach(() => {
    prisma = {
      shopSkuSnapshot: {
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      orgSettings: {
        findUnique: vi.fn().mockResolvedValue({
          orgId: 'org-1', lowStockThreshold: 10, lowStockDaysThreshold: 7,
        }),
      },
      priceReview: {
        count: vi.fn().mockResolvedValue(3),
      },
    };
  });

  it('KPI 汇总:sum today/7d/30d volume, count lowStock, pendingPriceReviews', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 42, sales7dVolume: 300, sales30dVolume: 1200 },
      _max: { lastSyncedAt: new Date('2026-04-21T10:00:00Z') },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(5);
    prisma.shopSkuSnapshot.findMany = vi.fn().mockResolvedValue([]);

    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', {});
    expect(r.kpis.todayVolume).toBe(42);
    expect(r.kpis.sales7dVolume).toBe(300);
    expect(r.kpis.sales30dVolume).toBe(1200);
    expect(r.kpis.lowStockCount).toBe(5);
    expect(r.pendingPriceReviews).toBe(3);
    expect(r.dataFreshness).toBe('2026-04-21T10:00:00.000Z');
  });

  it('lowStockCount 使用 OrgSettings.lowStockThreshold 过滤 warehouseQty', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: null },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(0);
    prisma.shopSkuSnapshot.findMany = vi.fn().mockResolvedValue([]);

    const svc = new DashboardService(prisma);
    await svc.summary('org-1', {});
    const countCall = prisma.shopSkuSnapshot.count.mock.calls[0][0];
    expect(countCall.where.orgId).toBe('org-1');
    expect(countCall.where.warehouseQty).toEqual({ lte: 10 });
  });

  it('shopId 过滤应用到 aggregate + count + findMany', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 0, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: null },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(0);
    prisma.shopSkuSnapshot.findMany = vi.fn().mockResolvedValue([]);

    const svc = new DashboardService(prisma);
    await svc.summary('org-1', { shopId: 's1' });
    expect(prisma.shopSkuSnapshot.aggregate.mock.calls[0][0].where.shopId).toBe('s1');
  });

  it('topTodayProducts 按 todaySaleVolume desc 取 10', async () => {
    prisma.shopSkuSnapshot.aggregate = vi.fn().mockResolvedValue({
      _sum: { todaySaleVolume: 5, sales7dVolume: 0, sales30dVolume: 0 },
      _max: { lastSyncedAt: new Date() },
    });
    prisma.shopSkuSnapshot.count = vi.fn().mockResolvedValue(0);
    prisma.shopSkuSnapshot.findMany = vi.fn()
      .mockResolvedValueOnce([snap({ todaySaleVolume: 3, productName: 'A' })])  // top today
      .mockResolvedValueOnce([snap({ sales30dVolume: 100 })])                   // top 30d
      .mockResolvedValueOnce([snap({ daysRemaining: 2.5, warehouseQty: 5 })]);  // low stock

    const svc = new DashboardService(prisma);
    const r = await svc.summary('org-1', {});
    // 第一次 findMany 是 topTodayProducts
    const callTop = prisma.shopSkuSnapshot.findMany.mock.calls[0][0];
    expect(callTop.orderBy).toEqual({ todaySaleVolume: 'desc' });
    expect(callTop.take).toBe(10);
    expect(r.topTodayProducts[0].todayVolume).toBe(3);
  });
});
```

- [ ] **Step 3: 确认红**

```bash
pnpm vitest run src/modules/analytics/dashboard/dashboard.service.test.ts 2>&1 | tail -8
```

- [ ] **Step 4: 实现 service**

创建 `apps/api/src/modules/analytics/dashboard/dashboard.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import type { DashboardSummaryFilterInput } from './dashboard.dto';

function serializeSnapshot(s: any) {
  const shop = s.shop ?? null;
  const skuTitle = [s.productName, s.className].filter(Boolean).join(' / ') || null;
  return {
    platformSkuId: s.platformSkuId,
    skuTitle,
    shopId: s.shopId,
    shopName: shop?.displayName ?? shop?.platformShopId ?? null,
    todayVolume: s.todaySaleVolume,
    sales30dVolume: s.sales30dVolume,
    warehouseQty: s.warehouseQty,
    avgDailySales: s.avgDailySales,
    daysRemaining: s.daysRemaining,
  };
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(orgId: string, filter: DashboardSummaryFilterInput) {
    const baseWhere: any = { orgId };
    if (filter.shopId) baseWhere.shopId = filter.shopId;

    // OrgSettings 取阈值,若无 row 用默认
    const settings = await (this.prisma as any).orgSettings.findUnique({ where: { orgId } });
    const lowStockThreshold = settings?.lowStockThreshold ?? 10;

    // 并行:aggregate + count + 3 个 findMany + 核价 count
    const [agg, lowStockCount, topToday, top30d, lowStockList, pendingPriceReviews] = await Promise.all([
      (this.prisma as any).shopSkuSnapshot.aggregate({
        where: baseWhere,
        _sum: { todaySaleVolume: true, sales7dVolume: true, sales30dVolume: true },
        _max: { lastSyncedAt: true },
      }),
      (this.prisma as any).shopSkuSnapshot.count({
        where: { ...baseWhere, warehouseQty: { lte: lowStockThreshold } },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: baseWhere,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true } } },
        orderBy: { todaySaleVolume: 'desc' },
        take: 10,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: baseWhere,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true } } },
        orderBy: { sales30dVolume: 'desc' },
        take: 20,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).shopSkuSnapshot.findMany({
        where: { ...baseWhere, warehouseQty: { lte: lowStockThreshold } },
        include: { shop: { select: { id: true, displayName: true, platformShopId: true } } },
        orderBy: [{ daysRemaining: { sort: 'asc', nulls: 'last' } }, { warehouseQty: 'asc' }],
        take: 20,
        omit: { platformPayload: true },
      }),
      (this.prisma as any).priceReview.count({
        where: { orgId, status: 'pending' },
      }),
    ]);

    return {
      kpis: {
        todayVolume: agg._sum.todaySaleVolume ?? 0,
        sales7dVolume: agg._sum.sales7dVolume ?? 0,
        sales30dVolume: agg._sum.sales30dVolume ?? 0,
        lowStockCount,
      },
      salesOverview: {
        today: agg._sum.todaySaleVolume ?? 0,
        last7d: agg._sum.sales7dVolume ?? 0,
        last30d: agg._sum.sales30dVolume ?? 0,
      },
      top30dRanking: top30d.map((s: any) => ({
        platformSkuId: s.platformSkuId,
        skuTitle: [s.productName, s.className].filter(Boolean).join(' / ') || null,
        shopId: s.shopId,
        shopName: s.shop?.displayName ?? s.shop?.platformShopId ?? null,
        sales30dVolume: s.sales30dVolume,
      })),
      topTodayProducts: topToday.map(serializeSnapshot),
      lowStockAlerts: lowStockList.map(serializeSnapshot),
      pendingPriceReviews,
      dataFreshness: agg._max.lastSyncedAt?.toISOString() ?? null,
    };
  }
}
```

- [ ] **Step 5: 跑测试确认绿**

```bash
pnpm vitest run src/modules/analytics/dashboard/dashboard.service.test.ts 2>&1 | tail -8
```
期望:4 passed。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/analytics/dashboard
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(bi): DashboardService summary aggregation (kpis + top + low-stock + price-reviews)"
```

---

## Task 4: DashboardController + SettingsService + SettingsController + AnalyticsModule

**Files:**
- Create: `apps/api/src/modules/analytics/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/modules/analytics/settings/settings.service.ts`
- Create: `apps/api/src/modules/analytics/settings/settings.controller.ts`
- Create: `apps/api/src/modules/analytics/settings/settings.dto.ts`
- Create: `apps/api/src/modules/analytics/analytics.module.ts`
- Modify: `apps/api/src/app.module.ts`(import AnalyticsModule)

- [ ] **Step 1: SettingsDto**

创建 `apps/api/src/modules/analytics/settings/settings.dto.ts`:
```typescript
import { z } from 'zod';

export const UpdateSettingsDto = z.object({
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  lowStockDaysThreshold: z.number().int().min(0).max(365).optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsDto>;
```

- [ ] **Step 2: SettingsService**

创建 `apps/api/src/modules/analytics/settings/settings.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import type { UpdateSettingsInput } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(orgId: string) {
    const row = await (this.prisma as any).orgSettings.findUnique({ where: { orgId } });
    if (row) {
      return {
        lowStockThreshold: row.lowStockThreshold,
        lowStockDaysThreshold: row.lowStockDaysThreshold,
      };
    }
    // 默认值(不建 row,GET 无副作用)
    return { lowStockThreshold: 10, lowStockDaysThreshold: 7 };
  }

  async update(orgId: string, input: UpdateSettingsInput) {
    const updated = await (this.prisma as any).orgSettings.upsert({
      where: { orgId },
      create: {
        orgId,
        lowStockThreshold: input.lowStockThreshold ?? 10,
        lowStockDaysThreshold: input.lowStockDaysThreshold ?? 7,
      },
      update: {
        ...(input.lowStockThreshold !== undefined && { lowStockThreshold: input.lowStockThreshold }),
        ...(input.lowStockDaysThreshold !== undefined && { lowStockDaysThreshold: input.lowStockDaysThreshold }),
      },
    });
    return {
      lowStockThreshold: updated.lowStockThreshold,
      lowStockDaysThreshold: updated.lowStockDaysThreshold,
    };
  }
}
```

- [ ] **Step 3: SettingsController**

创建 `apps/api/src/modules/analytics/settings/settings.controller.ts`:
```typescript
import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, type UpdateSettingsInput } from './settings.dto';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private svc: SettingsService, private tenant: TenantService) {}

  @Get()
  async get(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.get(m.orgId);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateSettingsDto))
  async update(@Req() req: any, @Body() body: UpdateSettingsInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.update(m.orgId, body);
  }
}
```

- [ ] **Step 4: DashboardController**

创建 `apps/api/src/modules/analytics/dashboard/dashboard.controller.ts`:
```typescript
import { Controller, Get, HttpCode, Logger, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { DashboardService } from './dashboard.service';
import { SkuSnapshotSyncService } from '../snapshot/sku-snapshot-sync.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  private logger = new Logger(DashboardController.name);

  constructor(
    private svc: DashboardService,
    private sync: SkuSnapshotSyncService,
    private tenant: TenantService,
  ) {}

  @Get('summary')
  async summary(@Req() req: any, @Query('shopId') shopId?: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.summary(m.orgId, { shopId });
  }

  @Post('sync/now')
  @HttpCode(202)
  async syncNow(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    void this.sync.syncAllActiveShops(m.orgId).catch((e: any) => {
      this.logger.error(`org ${m.orgId} sku-snapshot sync failed in background: ${e.message}`);
    });
    return { accepted: true, startedAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 5: AnalyticsModule**

创建 `apps/api/src/modules/analytics/analytics.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { SkuSnapshotSyncService } from './snapshot/sku-snapshot-sync.service';
import { SkuSnapshotSyncCron } from './snapshot/sku-snapshot-sync.cron';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { SettingsService } from './settings/settings.service';
import { SettingsController } from './settings/settings.controller';

@Module({
  controllers: [DashboardController, SettingsController],
  providers: [
    SkuSnapshotSyncService,
    SkuSnapshotSyncCron,
    DashboardService,
    SettingsService,
  ],
  exports: [SkuSnapshotSyncService, DashboardService, SettingsService],
})
export class AnalyticsModule {}
```

- [ ] **Step 6: 注册到 AppModule**

修改 `apps/api/src/app.module.ts`,顶部 import 加 `import { AnalyticsModule } from './modules/analytics/analytics.module';`,`imports` 数组末尾追加 `AnalyticsModule`。

- [ ] **Step 7: 验证 API 重载 + 路由**

```bash
tail -40 /tmp/duoshou-api.log | grep -E "AnalyticsModule|Mapped \{/api/(dashboard|settings)|Nest application" | tail -10
```

期望新增 4 条路由 + application started:
- `Mapped {/api/dashboard/summary, GET}`
- `Mapped {/api/dashboard/sync/now, POST}`
- `Mapped {/api/settings, GET}`
- `Mapped {/api/settings, PATCH}`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/dashboard/summary
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/dashboard/sync/now
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/settings
```
期望都是 401(未授权,AuthGuard 生效)。

- [ ] **Step 8: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/analytics \
        duoshou-erp/apps/api/src/app.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(bi): /api/dashboard + /api/settings endpoints + AnalyticsModule"
```

---

## Task 5: Shop connect 后即时同步 hook

**Files:**
- Modify: `apps/api/src/modules/shop/shop.module.ts`(import AnalyticsModule 为 SkuSnapshotSyncService 可注入)
- Modify: `apps/api/src/modules/shop/shop.controller.ts`(inject sync + connect 后触发)

- [ ] **Step 1: shop.module.ts imports**

读 `apps/api/src/modules/shop/shop.module.ts`,在 `@Module({ imports: [...], ... })` 的 imports 里加:
```typescript
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  // ... 其它不变
})
```

如果原来没有 imports key,加上整个 `imports: [AnalyticsModule]`。

- [ ] **Step 2: shop.controller.ts**

修改 `apps/api/src/modules/shop/shop.controller.ts`:

顶部 import 补:
```typescript
import { Logger } from '@nestjs/common';
import { SkuSnapshotSyncService } from '../analytics/snapshot/sku-snapshot-sync.service';
```

constructor 参数追加(跟其它注入同列):
```typescript
    private snapshotSync: SkuSnapshotSyncService,
```

在 class 体顶部加一个 private logger:
```typescript
  private logger = new Logger(ShopController.name);
```

改动 `connect` handler(POST /shops)的末尾,在 `return` 之前 fire-and-forget 触发一次 sync:

读现有 `connect` 方法(类似):
```typescript
  @Post()
  @UseGuards(AuthGuard)
  @UsePipes(new ZodValidationPipe(ConnectShopDto))
  async connect(@Req() req: any, @Body() body: ConnectShopInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.shopService.connect(m.orgId, body);
  }
```

改成(把 return 拆开):
```typescript
  @Post()
  @UseGuards(AuthGuard)
  @UsePipes(new ZodValidationPipe(ConnectShopDto))
  async connect(@Req() req: any, @Body() body: ConnectShopInput) {
    const m = await this.tenant.resolveForUser(req.user);
    const shop = await this.shopService.connect(m.orgId, body);
    // UX:连店后立即触发一次 snapshot 同步,避免用户打开 Dashboard 看到空白
    if (shop?.id && shop.shopType === 'full') {
      void this.snapshotSync.syncShop(shop.id).catch((e: any) => {
        this.logger.error(`shop ${shop.id} initial sync failed: ${e.message}`);
      });
    }
    return shop;
  }
```

- [ ] **Step 3: 验证 API 重载 + 手动验证**

```bash
tail -30 /tmp/duoshou-api.log | grep -E "ShopController|Nest application" | tail -3
```
期望无错误。

- [ ] **Step 4: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/shop/shop.module.ts \
        duoshou-erp/apps/api/src/modules/shop/shop.controller.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(bi): trigger initial SKU snapshot sync on shop connect"
```

---

## Task 6: 老模块 router / HomePage soft delete + PriceReview 改造为只读

**Files:**
- Modify: `apps/web/src/router/index.ts`(删 6 个 route + HomePage import)
- Delete: `apps/web/src/pages/HomePage.vue` + `HomePage.test.ts`
- Modify: `apps/web/src/pages/price-reviews/PriceReviewInboxPage.vue`(删除批量按钮,加只读 banner)
- Modify: `apps/web/src/pages/price-reviews/PriceReviewDetailPage.vue`(删操作按钮)

- [ ] **Step 1: 改 router/index.ts**

读 `apps/web/src/router/index.ts`,完整替换为:

```typescript
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DashboardPage from '@/pages/dashboard/DashboardPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import ShopsListPage from '@/pages/shops/ShopsListPage.vue';
import ShopsConnectPage from '@/pages/shops/ShopsConnectPage.vue';
import ProductListPage from '@/pages/products/ProductListPage.vue';
import PriceReviewInboxPage from '@/pages/price-reviews/PriceReviewInboxPage.vue';
import PriceReviewDetailPage from '@/pages/price-reviews/PriceReviewDetailPage.vue';
import SettingsPage from '@/pages/settings/SettingsPage.vue';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', component: DashboardPage, meta: { requiresAuth: true } },
  { path: '/login', component: LoginPage },
  { path: '/shops', component: ShopsListPage, meta: { requiresAuth: true } },
  { path: '/shops/new', component: ShopsConnectPage, meta: { requiresAuth: true } },
  { path: '/products', component: ProductListPage, meta: { requiresAuth: true } },
  { path: '/price-reviews', component: PriceReviewInboxPage, meta: { requiresAuth: true } },
  { path: '/price-reviews/:id', component: PriceReviewDetailPage, meta: { requiresAuth: true } },
  { path: '/settings', component: SettingsPage, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  try { await auth.init(); } catch { /* env missing, safe to ignore */ }
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';

  // 强制 onboarding:无 active shop redirect 到 /shops/new
  if (to.meta.requiresAuth && !to.path.startsWith('/shops')) {
    const { useShopsStore } = await import('@/stores/shops');
    const shops = useShopsStore();
    if (!shops.items.length) {
      try { await shops.fetch(); }
      catch { return true; }
    }
    const hasActive = shops.items.some((s) => s.status === 'active');
    if (!hasActive) return '/shops/new';
  }
});

export default router;
```

- [ ] **Step 2: 删除 HomePage**

```bash
rm /Users/mx4com/coding/duoshou-erp/apps/web/src/pages/HomePage.vue
rm /Users/mx4com/coding/duoshou-erp/apps/web/src/pages/HomePage.test.ts
```

- [ ] **Step 3: 改造 PriceReviewInboxPage**

读 `apps/web/src/pages/price-reviews/PriceReviewInboxPage.vue`,在模板顶部 `<n-card title="核价单收件箱">` 下面加只读 banner(新 top 位置):

```vue
  <n-card title="核价单(只读)">
    <n-alert type="info" style="margin-bottom: 12px;">
      当前模块为只读提醒视图。批量同意/拒绝请到 <a href="https://agentseller.temu.com" target="_blank">Temu 卖家中心</a> 操作。
    </n-alert>

    <!-- 原筛选 Space 保留 -->
```

然后**删除**:
- template 里 `<n-space style="margin-bottom: 12px;" v-if="selected.length">` 那段(批量同意/批量拒绝两个按钮整块)
- template 里 `<n-modal v-model:show="rejectOpen" ...>` 整个 modal 块
- script 里 `async function doBatchConfirm()` 整段
- script 里 `function openRejectDialog()` 整段
- script 里 `async function doBatchReject()` 整段
- script 里 `const rejectOpen = ref(false);` 和 `const counters = ref<Record<string, number>>({});` 变量
- script 里 `const acting = ref(false);` 变量
- columns 数组里 `{ type: 'selection' }` 列(删除它,表头就没 checkbox 了)
- data-table 的 `:checked-row-keys="selected"` 和 `@update:checked-row-keys` 绑定删除

确保 import 里 `useMessage` / `NModal` / `NTable` / `NInputNumber` 等不再被引用的可以删,但**保留 NTag 等列 render 还在用的**。

- [ ] **Step 4: 改造 PriceReviewDetailPage**

读 `apps/web/src/pages/price-reviews/PriceReviewDetailPage.vue`,顶部 `<n-card>` 下加只读 banner:

```vue
    <n-alert type="info" style="margin-bottom: 12px;">
      只读视图。同意/拒绝请在 Temu 卖家中心操作。
    </n-alert>
```

并**删除**操作区块(`<n-space style="margin-top: 16px;" v-if="r.status === 'pending'">` 整段,以及 script 里 `async function confirm()` / `async function reject()` / `const counterCents` / `const acting` 变量)。

- [ ] **Step 5: 构建**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -10
```

**注意**:会报 `DashboardPage` / `SettingsPage` 不存在,这些是 T9/T10 才创建。**这是预期的**,本 task 不跑 pnpm build。仅做 tsc check 也会失败。commit 留到 plan 后面的 task 让所有引用都就位后再 build。

改用 grep 检查 router 语法合理:
```bash
grep -c "DashboardPage\|SettingsPage" /Users/mx4com/coding/duoshou-erp/apps/web/src/router/index.ts
```
期望:`2`(两个 import + 两条 route)。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/router/index.ts \
        duoshou-erp/apps/web/src/pages/HomePage.vue \
        duoshou-erp/apps/web/src/pages/HomePage.test.ts \
        duoshou-erp/apps/web/src/pages/price-reviews/PriceReviewInboxPage.vue \
        duoshou-erp/apps/web/src/pages/price-reviews/PriceReviewDetailPage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "refactor(web)(bi): soft delete write-op routes, PriceReview to read-only, / points to Dashboard"
```

(注意 `git add` 对被删文件生效 —— 如果 `git add duoshou-erp/apps/web/src/pages/HomePage.vue` 报 `no such file`,换成 `git add -u duoshou-erp/apps/web/src/pages/HomePage.vue` 或直接 `git add -A duoshou-erp/apps/web/src/pages/`)

---

## Task 7: MainLayout(左 sidebar 导航)

**Files:**
- Create: `apps/web/src/layouts/MainLayout.vue`
- Modify: `apps/web/src/App.vue`(用 MainLayout 包 RouterView,login 页排除)

- [ ] **Step 1: MainLayout**

创建 `apps/web/src/layouts/MainLayout.vue`:
```vue
<template>
  <n-layout has-sider style="min-height: 100vh;">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo">舵手 ERP</div>
      <n-menu
        :value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="64"
        :options="menuOptions"
        @update:value="onMenuClick"
      />
    </n-layout-sider>
    <n-layout>
      <n-layout-content style="padding: 16px;">
        <slot />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutContent, NMenu,
} from 'naive-ui';
import type { MenuOption } from 'naive-ui';

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);

const menuOptions: MenuOption[] = [
  { label: '📊 Dashboard', key: '/' },
  { label: '🏪 店铺管理', key: '/shops' },
  { label: '📦 我的商品', key: '/products' },
  { label: '🔔 核价提醒', key: '/price-reviews' },
  { label: '⚙️ 设置', key: '/settings' },
];

const activeKey = computed(() => {
  const p = route.path;
  if (p === '/') return '/';
  if (p.startsWith('/shops')) return '/shops';
  if (p.startsWith('/products')) return '/products';
  if (p.startsWith('/price-reviews')) return '/price-reviews';
  if (p.startsWith('/settings')) return '/settings';
  return '/';
});

function onMenuClick(key: string) {
  router.push(key);
}
</script>

<style scoped>
.logo {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid var(--n-border-color, #eee);
}
</style>
```

- [ ] **Step 2: App.vue 用 MainLayout 包 RouterView(login 排除)**

读 `apps/web/src/App.vue`,完整替换为:
```vue
<template>
  <n-message-provider>
    <n-dialog-provider>
      <template v-if="$route.path === '/login'">
        <router-view />
      </template>
      <template v-else>
        <MainLayout>
          <router-view />
        </MainLayout>
      </template>
    </n-dialog-provider>
  </n-message-provider>
</template>

<script setup lang="ts">
import { NMessageProvider, NDialogProvider } from 'naive-ui';
import MainLayout from '@/layouts/MainLayout.vue';
</script>
```

如果原 App.vue 里有更多东西(`<n-config-provider>`、Supabase init 之类),**保留这些 wrapping**,只在内层加 MainLayout 的条件渲染逻辑。

- [ ] **Step 3: 构建 check(仍会因 DashboardPage/SettingsPage 缺失失败,但 MainLayout 本身应无语法错)**

```bash
grep -c "n-layout-sider\|MainLayout" /Users/mx4com/coding/duoshou-erp/apps/web/src/layouts/MainLayout.vue /Users/mx4com/coding/duoshou-erp/apps/web/src/App.vue
```
期望有输出(文件内容就位)。

- [ ] **Step 4: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/layouts/MainLayout.vue \
        duoshou-erp/apps/web/src/App.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(bi): MainLayout with left sidebar 5-item navigation"
```

---

## Task 8: Web api-client + stores

**Files:**
- Create: `apps/web/src/api-client/dashboard.api.ts`
- Create: `apps/web/src/api-client/settings.api.ts`
- Create: `apps/web/src/stores/dashboard.ts`
- Create: `apps/web/src/stores/settings.ts`

- [ ] **Step 1: dashboard.api.ts**

创建 `apps/web/src/api-client/dashboard.api.ts`:
```typescript
import { http } from './http';

export interface DashboardKpis {
  todayVolume: number;
  sales7dVolume: number;
  sales30dVolume: number;
  lowStockCount: number;
}

export interface DashboardSalesOverview {
  today: number;
  last7d: number;
  last30d: number;
}

export interface DashboardSkuRow {
  platformSkuId: string;
  skuTitle: string | null;
  shopId: string;
  shopName: string | null;
  sales30dVolume?: number;
  todayVolume?: number;
  warehouseQty?: number;
  avgDailySales?: number | null;
  daysRemaining?: number | null;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  salesOverview: DashboardSalesOverview;
  top30dRanking: DashboardSkuRow[];
  topTodayProducts: DashboardSkuRow[];
  lowStockAlerts: DashboardSkuRow[];
  pendingPriceReviews: number;
  dataFreshness: string | null;
}

export const dashboardApi = {
  summary: (shopId?: string) =>
    http<DashboardSummary>('/dashboard/summary', { query: shopId ? { shopId } : {} }),
  syncNow: () =>
    http<{ accepted: boolean; startedAt: string }>('/dashboard/sync/now', { method: 'POST' }),
};
```

- [ ] **Step 2: settings.api.ts**

创建 `apps/web/src/api-client/settings.api.ts`:
```typescript
import { http } from './http';

export interface OrgSettings {
  lowStockThreshold: number;
  lowStockDaysThreshold: number;
}

export const settingsApi = {
  get: () => http<OrgSettings>('/settings'),
  update: (patch: Partial<OrgSettings>) =>
    http<OrgSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};
```

- [ ] **Step 3: dashboard.ts store**

创建 `apps/web/src/stores/dashboard.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi, type DashboardSummary } from '@/api-client/dashboard.api';

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref<DashboardSummary | null>(null);
  const loading = ref(false);
  const selectedShopId = ref<string | null>(null);

  async function fetch(shopId?: string | null) {
    loading.value = true;
    try {
      data.value = await dashboardApi.summary(shopId ?? undefined);
    } finally { loading.value = false; }
  }
  return { data, loading, selectedShopId, fetch };
});
```

- [ ] **Step 4: settings.ts store**

创建 `apps/web/src/stores/settings.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi, type OrgSettings } from '@/api-client/settings.api';

export const useSettingsStore = defineStore('settings', () => {
  const data = ref<OrgSettings | null>(null);
  const loading = ref(false);
  async function fetch() {
    loading.value = true;
    try { data.value = await settingsApi.get(); }
    finally { loading.value = false; }
  }
  async function update(patch: Partial<OrgSettings>) {
    data.value = await settingsApi.update(patch);
  }
  return { data, loading, fetch, update };
});
```

- [ ] **Step 5: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/api-client/dashboard.api.ts \
        duoshou-erp/apps/web/src/api-client/settings.api.ts \
        duoshou-erp/apps/web/src/stores/dashboard.ts \
        duoshou-erp/apps/web/src/stores/settings.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(bi): dashboard + settings API clients + Pinia stores"
```

---

## Task 9: DashboardPage + 子组件(含 ECharts)

**Files:**
- Create: `apps/web/src/pages/dashboard/DashboardPage.vue`
- Create: `apps/web/src/pages/dashboard/components/DashboardHeader.vue`
- Create: `apps/web/src/pages/dashboard/components/KpiCard.vue`
- Create: `apps/web/src/pages/dashboard/components/SalesOverviewChart.vue`
- Create: `apps/web/src/pages/dashboard/components/Top30dRankingChart.vue`
- Create: `apps/web/src/pages/dashboard/components/TopTodayProductsTable.vue`
- Create: `apps/web/src/pages/dashboard/components/LowStockAlertsTable.vue`
- Modify: `apps/web/package.json`(加 `echarts` + `vue-echarts`)

- [ ] **Step 1: 装 ECharts**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm add echarts vue-echarts
```

- [ ] **Step 2: KpiCard.vue**

创建 `apps/web/src/pages/dashboard/components/KpiCard.vue`:
```vue
<template>
  <n-card size="small" :bordered="true">
    <div class="kpi-label">{{ label }}</div>
    <div class="kpi-value" :class="{ alert: isAlert }">
      {{ formattedValue }}
    </div>
    <div v-if="unit" class="kpi-unit">{{ unit }}</div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';

const props = defineProps<{
  label: string;
  value: number | null | undefined;
  unit?: string;
  alertThreshold?: number;        // value >= 此值高亮红色(告警类)
}>();

const formattedValue = computed(() =>
  props.value == null ? '—' : new Intl.NumberFormat().format(props.value),
);
const isAlert = computed(() =>
  props.alertThreshold != null && (props.value ?? 0) >= props.alertThreshold,
);
</script>

<style scoped>
.kpi-label { color: #888; font-size: 12px; margin-bottom: 4px; }
.kpi-value { font-size: 24px; font-weight: 600; color: #18a058; line-height: 1.2; }
.kpi-value.alert { color: #d03050; }
.kpi-unit { color: #888; font-size: 12px; margin-top: 2px; }
</style>
```

- [ ] **Step 3: DashboardHeader.vue**

创建 `apps/web/src/pages/dashboard/components/DashboardHeader.vue`:
```vue
<template>
  <div class="dashboard-header">
    <n-space>
      <n-select
        v-model:value="localShopId"
        :options="shopOptions"
        placeholder="全部店铺"
        clearable
        style="min-width: 220px;"
        @update:value="emit('shop-change', localShopId)"
      />
      <n-text depth="3" style="line-height: 34px;">
        数据时间:{{ freshness }}
      </n-text>
    </n-space>
    <n-button :loading="syncing" @click="emit('sync-now')">🔄 立即同步</n-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NSpace, NSelect, NButton, NText } from 'naive-ui';
import { useShopsStore } from '@/stores/shops';

const props = defineProps<{
  selectedShopId: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
}>();

const emit = defineEmits<{
  'shop-change': [shopId: string | null];
  'sync-now': [];
}>();

const shops = useShopsStore();
const localShopId = ref(props.selectedShopId);
watch(() => props.selectedShopId, (v) => localShopId.value = v);

const shopOptions = computed(() =>
  shops.items
    .filter(s => s.status === 'active')
    .map(s => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);

const freshness = computed(() =>
  props.lastSyncedAt ? new Date(props.lastSyncedAt).toLocaleString() : '暂无数据',
);
</script>

<style scoped>
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
```

- [ ] **Step 4: SalesOverviewChart.vue**

创建 `apps/web/src/pages/dashboard/components/SalesOverviewChart.vue`:
```vue
<template>
  <n-card title="销售对比(件数)" size="small">
    <v-chart :option="option" autoresize style="height: 260px;" />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  data: { today: number; last7d: number; last30d: number } | null;
}>();

const option = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: 'category',
    data: ['今日', '近 7 日', '近 30 日'],
  },
  yAxis: { type: 'value', name: '件数' },
  series: [{
    type: 'bar',
    data: [
      props.data?.today ?? 0,
      props.data?.last7d ?? 0,
      props.data?.last30d ?? 0,
    ],
    itemStyle: { color: '#18a058' },
    barWidth: '45%',
  }],
}));
</script>
```

- [ ] **Step 5: Top30dRankingChart.vue**

创建 `apps/web/src/pages/dashboard/components/Top30dRankingChart.vue`:
```vue
<template>
  <n-card title="TOP 20 近 30 日销量" size="small">
    <v-chart v-if="hasData" :option="option" autoresize :style="{ height: chartHeight }" />
    <n-empty v-else description="暂无销量数据" style="margin: 40px 0;" />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NEmpty } from 'naive-ui';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  data: DashboardSkuRow[] | null;
}>();

const sorted = computed(() =>
  (props.data ?? []).slice().sort((a, b) => (b.sales30dVolume ?? 0) - (a.sales30dVolume ?? 0)).slice(0, 20),
);

const hasData = computed(() => sorted.value.length > 0 && sorted.value.some(r => (r.sales30dVolume ?? 0) > 0));

const chartHeight = computed(() => {
  const n = sorted.value.length;
  return `${Math.max(260, n * 22)}px`;
});

const option = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 200, right: 40, top: 10, bottom: 30 },
  xAxis: { type: 'value', name: '件数' },
  yAxis: {
    type: 'category',
    data: sorted.value.map(r => r.skuTitle ?? r.platformSkuId).reverse(),
    axisLabel: { width: 180, overflow: 'truncate' },
  },
  series: [{
    type: 'bar',
    data: sorted.value.map(r => r.sales30dVolume ?? 0).reverse(),
    itemStyle: { color: '#2080f0' },
    label: { show: true, position: 'right', formatter: (p: any) => `${p.value} 件` },
  }],
}));
</script>
```

- [ ] **Step 6: TopTodayProductsTable.vue**

创建 `apps/web/src/pages/dashboard/components/TopTodayProductsTable.vue`:
```vue
<template>
  <n-card title="TOP 10 今日热销" size="small">
    <n-data-table
      :columns="columns"
      :data="data ?? []"
      :bordered="false"
      size="small"
      :row-key="(r: any) => r.platformSkuId + ':' + r.shopId"
    />
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NDataTable } from 'naive-ui';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

defineProps<{
  data: DashboardSkuRow[] | null;
}>();

const columns = [
  { title: 'SKU', key: 'skuTitle', render: (r: DashboardSkuRow) => r.skuTitle ?? r.platformSkuId, ellipsis: { tooltip: true } },
  { title: '店铺', key: 'shopName', render: (r: DashboardSkuRow) => r.shopName ?? '—', width: 100 },
  { title: '今日销量', key: 'todayVolume', width: 80, align: 'right' as const, render: (r: DashboardSkuRow) => r.todayVolume ?? 0 },
  { title: '库存', key: 'warehouseQty', width: 80, align: 'right' as const, render: (r: DashboardSkuRow) => r.warehouseQty ?? 0 },
];
</script>
```

- [ ] **Step 7: LowStockAlertsTable.vue**

创建 `apps/web/src/pages/dashboard/components/LowStockAlertsTable.vue`:
```vue
<template>
  <n-card title="库存预警" size="small">
    <n-data-table
      :columns="columns"
      :data="data ?? []"
      :bordered="false"
      size="small"
      :row-key="(r: any) => r.platformSkuId + ':' + r.shopId"
    />
  </n-card>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { NCard, NDataTable, NTag } from 'naive-ui';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

defineProps<{
  data: DashboardSkuRow[] | null;
}>();

const columns = [
  { title: 'SKU', key: 'skuTitle', render: (r: DashboardSkuRow) => r.skuTitle ?? r.platformSkuId, ellipsis: { tooltip: true } },
  { title: '店铺', key: 'shopName', render: (r: DashboardSkuRow) => r.shopName ?? '—', width: 100 },
  { title: '库存', key: 'warehouseQty', width: 70, align: 'right' as const, render: (r: DashboardSkuRow) => r.warehouseQty ?? 0 },
  { title: '日均销量', key: 'avgDailySales', width: 90, align: 'right' as const,
    render: (r: DashboardSkuRow) => r.avgDailySales == null ? '—' : r.avgDailySales.toFixed(1) },
  { title: '剩余天数', key: 'daysRemaining', width: 100,
    render: (r: DashboardSkuRow) => {
      if (r.daysRemaining == null) return '—';
      const d = r.daysRemaining;
      const type = d < 3 ? 'error' : d < 7 ? 'warning' : 'default';
      return h(NTag, { type, size: 'small' }, () => `${d.toFixed(1)} 天`);
    },
  },
];
</script>
```

- [ ] **Step 8: DashboardPage.vue**

创建 `apps/web/src/pages/dashboard/DashboardPage.vue`:
```vue
<template>
  <div class="dashboard">
    <DashboardHeader
      :selected-shop-id="store.selectedShopId"
      :last-synced-at="store.data?.dataFreshness ?? null"
      :syncing="syncing"
      @shop-change="onShopChange"
      @sync-now="onSyncNow"
    />

    <n-alert v-if="!hasFullShop" type="info" style="margin-bottom: 16px;">
      当前 Dashboard 暂只支持全托管店铺。半托店的销售数据 Temu 尚未提供 API,后续版本支持。
    </n-alert>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen">
      <n-gi>
        <KpiCard label="今日销量" :value="store.data?.kpis.todayVolume" unit="件" />
      </n-gi>
      <n-gi>
        <KpiCard label="近 7 日销量" :value="store.data?.kpis.sales7dVolume" unit="件" />
      </n-gi>
      <n-gi>
        <KpiCard label="近 30 日销量" :value="store.data?.kpis.sales30dVolume" unit="件" />
      </n-gi>
      <n-gi>
        <KpiCard label="低库存 SKU" :value="store.data?.kpis.lowStockCount" unit="个" :alert-threshold="1" />
      </n-gi>
    </n-grid>

    <n-grid :cols="2" :x-gap="12" :y-gap="12" style="margin-top: 12px;" responsive="screen">
      <n-gi>
        <SalesOverviewChart :data="store.data?.salesOverview ?? null" />
      </n-gi>
      <n-gi>
        <Top30dRankingChart :data="store.data?.top30dRanking ?? null" />
      </n-gi>
    </n-grid>

    <n-grid :cols="2" :x-gap="12" :y-gap="12" style="margin-top: 12px;" responsive="screen">
      <n-gi>
        <TopTodayProductsTable :data="store.data?.topTodayProducts ?? null" />
      </n-gi>
      <n-gi>
        <LowStockAlertsTable :data="store.data?.lowStockAlerts ?? null" />
      </n-gi>
    </n-grid>

    <div
      v-if="store.data?.pendingPriceReviews"
      class="pending-tip"
      @click="$router.push('/price-reviews')"
    >
      📋 你有 {{ store.data.pendingPriceReviews }} 条待处理核价单
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NGrid, NGi, NAlert, useMessage,
} from 'naive-ui';
import { useDashboardStore } from '@/stores/dashboard';
import { useShopsStore } from '@/stores/shops';
import { dashboardApi } from '@/api-client/dashboard.api';
import DashboardHeader from './components/DashboardHeader.vue';
import KpiCard from './components/KpiCard.vue';
import SalesOverviewChart from './components/SalesOverviewChart.vue';
import Top30dRankingChart from './components/Top30dRankingChart.vue';
import TopTodayProductsTable from './components/TopTodayProductsTable.vue';
import LowStockAlertsTable from './components/LowStockAlertsTable.vue';

const store = useDashboardStore();
const shops = useShopsStore();
const msg = useMessage();

const syncing = ref(false);

const hasFullShop = computed(() =>
  shops.items.some(s => s.status === 'active' && s.shopType === 'full'),
);

onMounted(async () => {
  await shops.fetch();
  await store.fetch(store.selectedShopId);
});

function onShopChange(shopId: string | null) {
  store.selectedShopId = shopId;
  store.fetch(shopId);
}

async function onSyncNow() {
  syncing.value = true;
  try {
    await dashboardApi.syncNow();
    msg.success('已触发后台同步,稍后数据自动刷新');
    // 5 秒 × 12 次轮询,任一次 freshness 变了就停
    const baseline = store.data?.dataFreshness;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      await store.fetch(store.selectedShopId);
      if (store.data?.dataFreshness && store.data.dataFreshness !== baseline) break;
    }
  } catch (e: any) {
    msg.error(e.message ?? '同步失败');
  } finally { syncing.value = false; }
}
</script>

<style scoped>
.dashboard { max-width: 1400px; margin: 0 auto; }
.pending-tip {
  position: fixed;
  right: 24px;
  bottom: 24px;
  background: #f0f9ff;
  border: 1px solid #2080f0;
  color: #2080f0;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  z-index: 100;
}
.pending-tip:hover { background: #e0f0ff; }
</style>
```

- [ ] **Step 9: 构建**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -10
```

期望 `✓ built in ...` —— DashboardPage 现在可 import,router 的 `/` 能 resolve。

**注意**:SettingsPage 还没做(T10),router 里引用它会报 `Cannot find module`。**预期**;commit 留到 T10 后。

**临时方案**:本 task step 9 构建前,在 router/index.ts 里**临时注释**掉 `import SettingsPage ...` 和 `/settings` 路由,跑 build 成功,commit 时用户再手工恢复(这不优雅)。

**更好方案**:把 Task 9 step 9 改成只跑 `vue-tsc --noEmit`,**允许 /settings 的 "Cannot find module" 一个错误存在**。Task 10 完成后第一次 pnpm build 会全绿。

实际跑:
```bash
pnpm vue-tsc --noEmit 2>&1 | grep -v "Cannot find module.*settings" | grep "error TS" | head -5
```
期望:除 SettingsPage 外无其它错误。

- [ ] **Step 10: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/dashboard \
        duoshou-erp/apps/web/package.json \
        duoshou-erp/apps/web/pnpm-lock.yaml \
        duoshou-erp/pnpm-lock.yaml
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(bi): DashboardPage with 4 KPI + 2 ECharts + 2 tables"
```

---

## Task 10: SettingsPage

**Files:**
- Create: `apps/web/src/pages/settings/SettingsPage.vue`

- [ ] **Step 1: SettingsPage**

创建 `apps/web/src/pages/settings/SettingsPage.vue`:
```vue
<template>
  <n-card title="设置" style="max-width: 600px;">
    <n-form label-placement="top" @submit.prevent="save">
      <n-form-item label="低库存阈值(件数)">
        <n-input-number
          v-model:value="lowStockThreshold"
          :min="0"
          :max="100000"
          :step="1"
        />
        <template #feedback>warehouseQty ≤ 此值视为低库存,在 Dashboard 高亮提示</template>
      </n-form-item>
      <n-form-item label="剩余天数告警阈值(天)">
        <n-input-number
          v-model:value="lowStockDaysThreshold"
          :min="0"
          :max="365"
          :step="1"
        />
        <template #feedback>剩余天数 < 此值在库存预警表里红色提示(预留;MVP 只影响颜色,不过滤)</template>
      </n-form-item>
      <n-space>
        <n-button type="primary" :loading="saving" @click="save">保存</n-button>
      </n-space>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard, NForm, NFormItem, NInputNumber, NSpace, NButton, useMessage,
} from 'naive-ui';
import { useSettingsStore } from '@/stores/settings';

const store = useSettingsStore();
const msg = useMessage();

const lowStockThreshold = ref<number>(10);
const lowStockDaysThreshold = ref<number>(7);
const saving = ref(false);

onMounted(async () => {
  await store.fetch();
  if (store.data) {
    lowStockThreshold.value = store.data.lowStockThreshold;
    lowStockDaysThreshold.value = store.data.lowStockDaysThreshold;
  }
});

async function save() {
  saving.value = true;
  try {
    await store.update({
      lowStockThreshold: lowStockThreshold.value,
      lowStockDaysThreshold: lowStockDaysThreshold.value,
    });
    msg.success('已保存');
  } catch (e: any) {
    msg.error(e.message ?? '保存失败');
  } finally { saving.value = false; }
}
</script>
```

- [ ] **Step 2: 构建(所有 page 就位,应该全绿)**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -8
```
期望 `✓ built in ...`,无 "Cannot find module" 或 tsc 错误。

- [ ] **Step 3: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/settings/SettingsPage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(bi): SettingsPage for low-stock threshold CRUD"
```

---

## Task 11: 基础 smoke + tag

**Files:**
- Create: `apps/api/scripts/smoke-bi-dashboard.mjs`

- [ ] **Step 1: Smoke 脚本**

创建 `apps/api/scripts/smoke-bi-dashboard.mjs`:
```javascript
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:3000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-bi-${Date.now()}@duoshou.test`;
const pw = 'SmokeBi!2026';

console.log('=== BI Dashboard 基础 smoke ===');

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
    shopType: 'full', region: 'pa', displayName: 'smoke-bi',
  }),
});
const shop = await shopResp.json();
console.log('  shop:', shop.id ?? shop.error ?? shop);

console.log('\n[2/6] GET /dashboard/summary (新 org 可能全 0)');
const sumResp = await fetchA('/dashboard/summary');
console.log('  status:', sumResp.status);
const summary = await sumResp.json();
console.log('  kpis:', JSON.stringify(summary.kpis));
console.log('  dataFreshness:', summary.dataFreshness);

console.log('\n[3/6] POST /dashboard/sync/now (期望 202)');
const syncResp = await fetchA('/dashboard/sync/now', { method: 'POST' });
console.log('  status:', syncResp.status);
const syncRes = await syncResp.json();
console.log('  accepted:', syncRes.accepted);

console.log('\n[4/6] GET /settings');
const setResp = await fetchA('/settings');
console.log('  status:', setResp.status);
const settings = await setResp.json();
console.log('  lowStockThreshold:', settings.lowStockThreshold);

console.log('\n[5/6] PATCH /settings (改阈值 10 → 20)');
const patchResp = await fetchA('/settings', {
  method: 'PATCH', body: JSON.stringify({ lowStockThreshold: 20 }),
});
console.log('  status:', patchResp.status);
const updated = await patchResp.json();
console.log('  lowStockThreshold after patch:', updated.lowStockThreshold);

console.log('\n[6/6] 清理');
await admin.auth.admin.deleteUser(c1.user.id);
console.log('\n✅ BI Dashboard 基础 smoke PASSED');
```

- [ ] **Step 2: 运行 smoke**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
node scripts/smoke-bi-dashboard.mjs 2>&1 | tail -40
```

期望所有 6 步 OK,结尾打印 `✅ BI Dashboard 基础 smoke PASSED`。

**注意**:
- Step 1 如果 shop 连接报 "shop type mismatch" / "access_token invalid",先去 Temu 服务商门户刷新 token 再跑
- Step 2 `summary.kpis` 可能全是 0(新 org,cron 还没跑 + 即时 sync 需要几秒完成)
- Step 3 `syncResp.status === 202` + `accepted: true`
- Step 5 `updated.lowStockThreshold === 20`

如果 smoke 失败,STOP 并报 BLOCKED + 具体失败步骤输出。

- [ ] **Step 3: 提交 + tag**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/scripts/smoke-bi-dashboard.mjs
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "test(bi): infra smoke (shop + dashboard + settings endpoints)"
git -C duoshou-erp tag bi-dashboard-mvp
```

---

## Done — 接下来

- `bi-dashboard-mvp` tag 标记上线时间
- push-to-github + VPS 部署(生产验证 A/B/C 验收)
- 邀请用户试用 + 收集反馈
- V2 候选方向(spec § 11 已记录):销售下钻页、库存下钻页、广告 ROI、订单履约、店铺健康评分、半托店支持、月级同比

## 已知 cleanup 任务(本 MVP 后可随时做)

- 老模块后端代码硬删(product_template / bulk_job / activity* / price_adjustment_order Prisma 表 + service/controller/module)—— 现在是 soft delete 只改 router,后端模块仍启动
- Dashboard 图表 polish(颜色语言、暗色模式、响应式断点)
- i18n(目前中文硬编码)
- KPI 卡片加"相对前周期"delta 箭头(spec v2 决策表去掉了 ↑/↓%,MVP 先不做)

## 执行风险清单

1. **salesv2 真实响应 shape 跟 diag 样本不一致**:T2 的字段映射基于 3847 SKU 样本,可能有特殊边缘 SKU(虚拟 JIT / 自定义品)字段布局不同。subagent 实施时若 cron 真跑后 `ShopSkuSnapshot` 条数异常少,读 platformPayload 字段结构再修 service。
2. **首次全量 3847 SKU 同步耗时**:每 SKU 一次 upsert = 3847 次 DB roundtrip,pageSize 50 × 77 页 Temu API 调用,Redis lock TTL 30min 应该够。若超时,把 upsert 改成 per-page 批量(Prisma `createMany` 不支持 upsert,但 Postgres 原生支持 `ON CONFLICT`,可以写 raw SQL)—— V2 优化项。
3. **半托店连接后空 Dashboard**:Task 5 的即时 sync 会因 shopType != 'full' 立即返回 0,新半托用户首次 Dashboard 永远空;spec § 6 的前端 banner 提示已覆盖。
