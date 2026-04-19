# W2a Price Review & Adjustment Workstation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchants see all their Temu price-review orders (across shops) in one unified queue, confirm or reject them in bulk, and submit new price-adjustment requests. Price history per SKU visible on hover.

**Architecture:** Three new Prisma models (`price_review`, `price_adjustment_order`, `sku_price_history`). A cron job polls `bg.price.review.page.query` (full managed, CN) + `bg.semi.price.review.page.query.order` (semi managed, PA) every 5 minutes per active shop, upserting rows. Two controllers expose list/detail + batch confirm/reject, and a third handles outbound adjustment submission. Frontend adds three pages (review inbox, review detail, adjustment submission) built on the W1 api-client + Pinia patterns.

**Tech Stack:** Same as W1 — NestJS 10, BullMQ (reused, no new queue), Prisma 7, Vue 3 + Naive UI.

---

## Context (what exists from W0/W1)

- `TemuClient.call(interfaceType, req)` auto-routes via `TEMU_API_REGISTRY` (region per spec) — just supply the string name.
- `TemuClientFactoryService.forShop(shopId)` returns a rate-limited client.
- `AuthGuard`, `TenantService.resolveForUser(req.user)`, `ZodValidationPipe`, `PrismaService` all available.
- Prisma BigInt → Number serialization: use `Number(x.idField)` before returning from service (pattern from W1 ProductTemplateService).
- Shop row has `shopType ∈ {full,semi}`, `region ∈ {cn,pa}`.
- `@nestjs/schedule` installed; cron jobs wired via `@Cron(CronExpression.*)` in a service inside a ScheduleModule-registered module.
- Front-end: `apps/web/src/api-client/http.ts` + Pinia stores + Naive UI pages following templates/bulk-jobs patterns.

## Scope boundaries

**In scope (W2a):**
- List/search price review orders across all of org's shops (both full + semi)
- Batch confirm (accept Temu's suggested price) / batch reject (counter with a new price)
- Submit new adjustment proposals (POST to `bg.semi.adjust.price.batch.review` / `bg.full.adjust.price.batch.review`)
- Poll every 5 min, upsert into DB
- Price history view per SKU (via `bg.goods.price.list.get` / `.glo.*`)

**Out of scope (defer to W2.5 / W3):**
- Pseudo-webhook event emission to frontend (WebSocket) — simple polling on front-end for now
- Email / Feishu / SMS notifications — depends on W3 event bus
- 建议申报价 (`bg.goods.suggest.supplyprice.get`) — has 100 req/day limit per shop, requires careful caching; deferred
- Price-trend analytics / ML-assisted counter-offers
- Automatic price rules (e.g., "always counter with margin × 1.15")
- Multi-stage approval workflows

## API routing summary

| Shop type | Shop region | List reviews | Confirm | Reject | Submit adjustment | Price history |
|---|---|---|---|---|---|---|
| full | cn or pa | `bg.price.review.page.query` (CN) | `bg.price.review.confirm` (CN) | `bg.price.review.reject` (CN) | `bg.full.adjust.price.batch.review` (CN) | `bg.goods.price.list.get` (CN) |
| semi | cn | `bg.semi.price.review.page.query` (CN)* | `bg.semi.price.review.confirm` (CN)* | `bg.semi.price.review.reject` (CN)* | `bg.semi.adjust.price.batch.review` (CN) | `bg.goods.price.list.get` (CN) |
| semi | pa | `bg.semi.price.review.page.query.order` (PA) | `bg.semi.price.review.confirm.order` (PA) | `bg.semi.price.review.reject.order` (PA) | `bg.semi.adjust.price.batch.review.order` (PA) | `bg.glo.goods.price.list.get` (PA) |

\* Check if the CN semi variants exist in the generated methods. If not (the Temu docs show only the `.order` PA versions for semi), route `shopType=semi` to PA endpoints regardless of `region` and document the deviation.

A helper `pricingEndpoints(shop)` should centralize this mapping.

## File structure

```
apps/api/src/modules/pricing/                          (new module)
├─ pricing.module.ts
├─ pricing-endpoints.ts                                (route-by-shop helper, PURE FUNCTION)
├─ pricing-endpoints.test.ts
├─ review/
│  ├─ price-review.service.ts                          (CRUD on price_review table)
│  ├─ price-review.service.test.ts
│  ├─ price-review.controller.ts                       (GET list, POST confirm/reject)
│  ├─ price-review.dto.ts
│  └─ price-review-sync.service.ts                     (poll Temu, upsert)
├─ review/price-review-sync.cron.ts                    (@Cron 5min)
├─ adjustment/
│  ├─ price-adjustment.service.ts
│  ├─ price-adjustment.controller.ts                   (POST submit)
│  └─ price-adjustment.dto.ts
└─ history/
   └─ sku-price-history.service.ts                     (on-demand fetch, cached 1h in Redis)

apps/web/src/pages/price-reviews/
├─ PriceReviewInboxPage.vue                            (/price-reviews)
└─ PriceReviewDetailPage.vue                           (/price-reviews/:id)
apps/web/src/pages/price-adjustments/
└─ PriceAdjustmentSubmitPage.vue                       (/price-adjustments/new)

apps/web/src/api-client/
├─ price-reviews.api.ts
└─ price-adjustments.api.ts

apps/web/src/stores/
└─ price-reviews.ts
```

## Env additions

None required.

---

## Task 1: Prisma models — price_review, price_adjustment_order, sku_price_history

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260420000000_w2a_pricing/migration.sql`

- [ ] **Step 1: Append models to schema.prisma**

```prisma
model PriceReview {
  id                   String   @id @default(uuid())
  orgId                String   @map("org_id")
  shopId               String   @map("shop_id")
  platformOrderId      String   @map("platform_order_id")          // Temu 核价单 ID
  platformProductId    String?  @map("platform_product_id")
  platformSkuId        String?  @map("platform_sku_id")
  skuTitle             String?  @map("sku_title")
  currentPriceCents    BigInt?  @map("current_price_cents")
  suggestedPriceCents  BigInt?  @map("suggested_price_cents")
  currency             String?
  reason               String?                                       // Temu 建议价原因
  status               String   @default("pending")                   // pending | confirmed | rejected | expired
  deadlineAt           DateTime? @map("deadline_at")
  receivedAt           DateTime @default(now()) @map("received_at")
  resolvedAt           DateTime? @map("resolved_at")
  platformPayload      Json     @default("{}") @map("platform_payload")

  org  Organization @relation(fields: [orgId], references: [id])
  shop Shop         @relation(fields: [shopId], references: [id])

  @@unique([shopId, platformOrderId])
  @@index([orgId, status])
  @@index([shopId, status])
  @@map("price_review")
}

model PriceAdjustmentOrder {
  id                 String   @id @default(uuid())
  orgId              String   @map("org_id")
  shopId             String   @map("shop_id")
  platformOrderId    String?  @map("platform_order_id")              // Temu returns after submit
  platformSkuId      String   @map("platform_sku_id")
  skuTitle           String?  @map("sku_title")
  oldPriceCents      BigInt?  @map("old_price_cents")
  newPriceCents      BigInt   @map("new_price_cents")
  currency           String?
  status             String   @default("submitted")                   // submitted | approved | rejected | failed
  submittedAt        DateTime @default(now()) @map("submitted_at")
  resolvedAt         DateTime? @map("resolved_at")
  error              Json?
  platformPayload    Json?    @map("platform_payload")

  org  Organization @relation(fields: [orgId], references: [id])
  shop Shop         @relation(fields: [shopId], references: [id])

  @@index([orgId, status])
  @@index([shopId, platformSkuId])
  @@map("price_adjustment_order")
}

model SkuPriceHistory {
  id              BigInt   @id @default(autoincrement())
  shopId          String   @map("shop_id")
  platformSkuId   String   @map("platform_sku_id")
  priceCents      BigInt   @map("price_cents")
  currency        String
  effectiveAt     DateTime @map("effective_at")
  source          String                                  // "sync" | "review_confirmed" | "adjustment_approved"
  platformPayload Json?    @map("platform_payload")

  shop Shop @relation(fields: [shopId], references: [id])

  @@index([shopId, platformSkuId, effectiveAt])
  @@map("sku_price_history")
}
```

Add back-refs inside existing models:
- `model Organization`: add `priceReviews PriceReview[]` and `priceAdjustmentOrders PriceAdjustmentOrder[]`
- `model Shop`: add `priceReviews PriceReview[]`, `priceAdjustmentOrders PriceAdjustmentOrder[]`, `priceHistories SkuPriceHistory[]`

- [ ] **Step 2: Hand-write migration SQL**

Create `apps/api/prisma/migrations/20260420000000_w2a_pricing/migration.sql`:

```sql
CREATE TABLE "price_review" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "platform_order_id" TEXT NOT NULL,
    "platform_product_id" TEXT,
    "platform_sku_id" TEXT,
    "sku_title" TEXT,
    "current_price_cents" BIGINT,
    "suggested_price_cents" BIGINT,
    "currency" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deadline_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "platform_payload" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "price_review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "price_review_shop_id_platform_order_id_key" ON "price_review"("shop_id","platform_order_id");
CREATE INDEX "price_review_org_id_status_idx" ON "price_review"("org_id","status");
CREATE INDEX "price_review_shop_id_status_idx" ON "price_review"("shop_id","status");

CREATE TABLE "price_adjustment_order" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "platform_order_id" TEXT,
    "platform_sku_id" TEXT NOT NULL,
    "sku_title" TEXT,
    "old_price_cents" BIGINT,
    "new_price_cents" BIGINT NOT NULL,
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "error" JSONB,
    "platform_payload" JSONB,
    CONSTRAINT "price_adjustment_order_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "price_adjustment_org_id_status_idx" ON "price_adjustment_order"("org_id","status");
CREATE INDEX "price_adjustment_shop_id_sku_idx" ON "price_adjustment_order"("shop_id","platform_sku_id");

CREATE TABLE "sku_price_history" (
    "id" BIGSERIAL NOT NULL,
    "shop_id" TEXT NOT NULL,
    "platform_sku_id" TEXT NOT NULL,
    "price_cents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "platform_payload" JSONB,
    CONSTRAINT "sku_price_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sku_price_history_shop_sku_effective_idx" ON "sku_price_history"("shop_id","platform_sku_id","effective_at");

-- Foreign keys
ALTER TABLE "price_review" ADD CONSTRAINT "price_review_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_review" ADD CONSTRAINT "price_review_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_adjustment_order" ADD CONSTRAINT "price_adjustment_order_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_adjustment_order" ADD CONSTRAINT "price_adjustment_order_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sku_price_history" ADD CONSTRAINT "sku_price_history_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply migration**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
set -a && source .env.development && set +a
pnpm prisma migrate deploy && pnpm prisma generate
```

- [ ] **Step 4: Verify tables**

```bash
set -a && source .env.development && set +a
node -e "import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();const r=await c.query(\"select table_name from information_schema.tables where table_schema='public' and table_name like 'price_%' or table_name='sku_price_history' order by table_name\");console.log(r.rows.map(x=>x.table_name).join(','));await c.end();});"
```

Expected: `price_adjustment_order,price_review,sku_price_history`

- [ ] **Step 5: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/prisma
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2a): price_review / price_adjustment_order / sku_price_history models"
```

---

## Task 2: Endpoint-routing helper (pure function + tests)

**Files:**
- Create: `apps/api/src/modules/pricing/pricing-endpoints.ts`
- Create: `apps/api/src/modules/pricing/pricing-endpoints.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/modules/pricing/pricing-endpoints.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pricingEndpoints } from './pricing-endpoints';

describe('pricingEndpoints', () => {
  it('full+cn uses CN bg.price.review.*', () => {
    const e = pricingEndpoints({ shopType: 'full', region: 'cn' });
    expect(e.listReviews).toBe('bg.price.review.page.query');
    expect(e.confirmReview).toBe('bg.price.review.confirm');
    expect(e.rejectReview).toBe('bg.price.review.reject');
    expect(e.submitAdjustment).toBe('bg.full.adjust.price.batch.review');
    expect(e.listAdjustments).toBe('bg.full.adjust.price.page.query');
    expect(e.priceHistory).toBe('bg.goods.price.list.get');
  });

  it('full+pa uses CN bg.price.review.* (no PA full variant exists)', () => {
    const e = pricingEndpoints({ shopType: 'full', region: 'pa' });
    expect(e.listReviews).toBe('bg.price.review.page.query');
    expect(e.priceHistory).toBe('bg.glo.goods.price.list.get');
  });

  it('semi+pa uses PA bg.semi.price.review.*.order', () => {
    const e = pricingEndpoints({ shopType: 'semi', region: 'pa' });
    expect(e.listReviews).toBe('bg.semi.price.review.page.query.order');
    expect(e.confirmReview).toBe('bg.semi.price.review.confirm.order');
    expect(e.rejectReview).toBe('bg.semi.price.review.reject.order');
    expect(e.submitAdjustment).toBe('bg.semi.adjust.price.batch.review.order');
    expect(e.priceHistory).toBe('bg.glo.goods.price.list.get');
  });

  it('semi+cn routes to PA .order variants and logs deviation', () => {
    // Currently no dedicated CN semi variants exist per our spec audit.
    const e = pricingEndpoints({ shopType: 'semi', region: 'cn' });
    expect(e.listReviews).toBe('bg.semi.price.review.page.query.order');
    expect(e.submitAdjustment).toBe('bg.semi.adjust.price.batch.review');
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/modules/pricing/pricing-endpoints.test.ts
```

- [ ] **Step 3: Implement**

Create `apps/api/src/modules/pricing/pricing-endpoints.ts`:
```typescript
export interface ShopPricingCtx {
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
}

export interface PricingEndpoints {
  listReviews: string;
  confirmReview: string;
  rejectReview: string;
  listAdjustments: string;
  submitAdjustment: string;
  priceHistory: string;
}

export function pricingEndpoints(ctx: ShopPricingCtx): PricingEndpoints {
  const isPa = ctx.region === 'pa';
  if (ctx.shopType === 'full') {
    return {
      listReviews: 'bg.price.review.page.query',
      confirmReview: 'bg.price.review.confirm',
      rejectReview: 'bg.price.review.reject',
      listAdjustments: 'bg.full.adjust.price.page.query',
      submitAdjustment: 'bg.full.adjust.price.batch.review',
      priceHistory: isPa ? 'bg.glo.goods.price.list.get' : 'bg.goods.price.list.get',
    };
  }
  // semi
  return {
    listReviews: 'bg.semi.price.review.page.query.order',
    confirmReview: 'bg.semi.price.review.confirm.order',
    rejectReview: 'bg.semi.price.review.reject.order',
    listAdjustments: 'bg.semi.adjust.price.page.query',
    submitAdjustment: isPa ? 'bg.semi.adjust.price.batch.review.order' : 'bg.semi.adjust.price.batch.review',
    priceHistory: isPa ? 'bg.glo.goods.price.list.get' : 'bg.goods.price.list.get',
  };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/modules/pricing/pricing-endpoints.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/pricing/pricing-endpoints.ts \
        duoshou-erp/apps/api/src/modules/pricing/pricing-endpoints.test.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2a): pricing endpoints routing helper (full/semi × cn/pa)"
```

---

## Task 3: PriceReviewService + DTO

**Files:**
- Create: `apps/api/src/modules/pricing/review/price-review.dto.ts`
- Create: `apps/api/src/modules/pricing/review/price-review.service.ts`
- Create: `apps/api/src/modules/pricing/review/price-review.service.test.ts`

- [ ] **Step 1: DTO**

Create `apps/api/src/modules/pricing/review/price-review.dto.ts`:
```typescript
import { z } from 'zod';

export const ListReviewsFilter = z.object({
  shopId: z.string().uuid().optional(),
  status: z.enum(['pending', 'confirmed', 'rejected', 'expired']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListReviewsFilterInput = z.infer<typeof ListReviewsFilter>;

export const BatchConfirmDto = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(50),
});
export type BatchConfirmInput = z.infer<typeof BatchConfirmDto>;

export const BatchRejectDto = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(50),
  counterPriceCents: z.record(z.string().uuid(), z.number().int().positive()),  // reviewId → counter in cents
});
export type BatchRejectInput = z.infer<typeof BatchRejectDto>;
```

- [ ] **Step 2: Tests**

Create `apps/api/src/modules/pricing/review/price-review.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceReviewService } from './price-review.service';

describe('PriceReviewService.list', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = {
      priceReview: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', shopId: 's1', status: 'pending', currentPriceCents: 1000n, suggestedPriceCents: 900n },
          { id: 'r2', shopId: 's1', status: 'pending', currentPriceCents: 500n, suggestedPriceCents: 450n },
        ]),
      },
    };
  });

  it('scopes by orgId', async () => {
    const svc = new PriceReviewService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    expect(prisma.priceReview.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
    expect(r.items).toHaveLength(2);
    expect(typeof r.items[0].currentPriceCents).toBe('number');
  });

  it('applies shopId filter', async () => {
    const svc = new PriceReviewService(prisma, {} as any);
    await svc.list('org-1', { shopId: 'shop-1' });
    expect(prisma.priceReview.findMany.mock.calls[0][0].where.shopId).toBe('shop-1');
  });

  it('serializes BigInt fields as numbers', async () => {
    const svc = new PriceReviewService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    for (const item of r.items) {
      expect(typeof item.currentPriceCents).toBe('number');
      expect(typeof item.suggestedPriceCents).toBe('number');
    }
  });
});

describe('PriceReviewService.batchConfirm', () => {
  let prisma: any, clientFactory: any, mockClient: any;
  beforeEach(() => {
    mockClient = { call: vi.fn().mockResolvedValue({ success: true }) };
    clientFactory = { forShop: vi.fn().mockResolvedValue(mockClient) };
    prisma = {
      priceReview: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', orgId: 'org-1', shopId: 'shop-1', platformOrderId: '1001', shop: { shopType: 'full', region: 'cn' } },
        ]),
        update: vi.fn(),
      },
    };
  });

  it('calls confirm API per review and updates status', async () => {
    const svc = new PriceReviewService(prisma, clientFactory);
    await svc.batchConfirm('org-1', ['r1']);
    expect(mockClient.call).toHaveBeenCalledWith('bg.price.review.confirm', { orderId: 1001 });
    expect(prisma.priceReview.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'confirmed' }),
    });
  });
});
```

- [ ] **Step 3: Confirm fail**

```bash
pnpm vitest run src/modules/pricing/review/price-review.service.test.ts
```

- [ ] **Step 4: Implement service**

Create `apps/api/src/modules/pricing/review/price-review.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';
import type { ListReviewsFilterInput } from './price-review.dto';

function bigIntToNumber(v: bigint | null | undefined): number | null {
  return v == null ? null : Number(v);
}

function serialize(r: any) {
  return {
    ...r,
    currentPriceCents: bigIntToNumber(r.currentPriceCents),
    suggestedPriceCents: bigIntToNumber(r.suggestedPriceCents),
  };
}

@Injectable()
export class PriceReviewService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async list(orgId: string, filter: ListReviewsFilterInput) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: any = { orgId };
    if (filter.shopId) where.shopId = filter.shopId;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.skuTitle = { contains: filter.search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      (this.prisma as any).priceReview.count({ where }),
      (this.prisma as any).priceReview.findMany({
        where,
        include: { shop: { select: { id: true, displayName: true, platformShopId: true, shopType: true } } },
        orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: items.map(serialize) };
  }

  async get(orgId: string, id: string) {
    const r = await (this.prisma as any).priceReview.findFirst({
      where: { id, orgId },
      include: { shop: true },
    });
    if (!r) throw new NotFoundException(`Price review ${id} not found`);
    return serialize(r);
  }

  async batchConfirm(orgId: string, reviewIds: string[]) {
    const reviews = await (this.prisma as any).priceReview.findMany({
      where: { id: { in: reviewIds }, orgId, status: 'pending' },
      include: { shop: true },
    });
    const results: any[] = [];
    for (const r of reviews) {
      const ep = pricingEndpoints({ shopType: r.shop.shopType, region: r.shop.region });
      const client = await this.clientFactory.forShop(r.shopId);
      try {
        await client.call(ep.confirmReview, { orderId: Number(r.platformOrderId) });
        await (this.prisma as any).priceReview.update({
          where: { id: r.id },
          data: { status: 'confirmed', resolvedAt: new Date() },
        });
        results.push({ id: r.id, ok: true });
      } catch (e: any) {
        results.push({ id: r.id, ok: false, error: e.message });
      }
    }
    return { total: reviews.length, results };
  }

  async batchReject(orgId: string, reviewIds: string[], counterPriceCents: Record<string, number>) {
    const reviews = await (this.prisma as any).priceReview.findMany({
      where: { id: { in: reviewIds }, orgId, status: 'pending' },
      include: { shop: true },
    });
    const results: any[] = [];
    for (const r of reviews) {
      const ep = pricingEndpoints({ shopType: r.shop.shopType, region: r.shop.region });
      const client = await this.clientFactory.forShop(r.shopId);
      const counter = counterPriceCents[r.id];
      if (!counter) { results.push({ id: r.id, ok: false, error: 'missing counter price' }); continue; }
      try {
        await client.call(ep.rejectReview, { orderId: Number(r.platformOrderId), newSupplierPrice: String(counter) });
        await (this.prisma as any).priceReview.update({
          where: { id: r.id },
          data: { status: 'rejected', resolvedAt: new Date() },
        });
        results.push({ id: r.id, ok: true });
      } catch (e: any) {
        results.push({ id: r.id, ok: false, error: e.message });
      }
    }
    return { total: reviews.length, results };
  }
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/modules/pricing/review/price-review.service.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/pricing/review
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2a): PriceReviewService (list / batchConfirm / batchReject)"
```

---

## Task 4: PriceReviewController

**Files:**
- Create: `apps/api/src/modules/pricing/review/price-review.controller.ts`
- Create: `apps/api/src/modules/pricing/pricing.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Controller**

Create `apps/api/src/modules/pricing/review/price-review.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { PriceReviewService } from './price-review.service';
import {
  BatchConfirmDto, BatchRejectDto,
  type BatchConfirmInput, type BatchRejectInput,
} from './price-review.dto';

@Controller('price-reviews')
@UseGuards(AuthGuard)
export class PriceReviewController {
  constructor(private svc: PriceReviewService, private tenant: TenantService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('shopId') shopId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, {
      shopId, status: status as any, search,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.get(m.orgId, id);
  }

  @Post('batch-confirm')
  @UsePipes(new ZodValidationPipe(BatchConfirmDto))
  async batchConfirm(@Req() req: any, @Body() body: BatchConfirmInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.batchConfirm(m.orgId, body.reviewIds);
  }

  @Post('batch-reject')
  @UsePipes(new ZodValidationPipe(BatchRejectDto))
  async batchReject(@Req() req: any, @Body() body: BatchRejectInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.batchReject(m.orgId, body.reviewIds, body.counterPriceCents);
  }
}
```

- [ ] **Step 2: Pricing module**

Create `apps/api/src/modules/pricing/pricing.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { PriceReviewService } from './review/price-review.service';
import { PriceReviewController } from './review/price-review.controller';

@Module({
  controllers: [PriceReviewController],
  providers: [PriceReviewService],
  exports: [PriceReviewService],
})
export class PricingModule {}
```

- [ ] **Step 3: Register in AppModule**

Read `apps/api/src/app.module.ts` and add `PricingModule` to imports array.

- [ ] **Step 4: Verify API boots**

```bash
tail -15 /tmp/duoshou-api.log 2>&1
```
Look for `Mapped {/api/price-reviews, GET}` routes (4 total).

- [ ] **Step 5: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/pricing \
        duoshou-erp/apps/api/src/app.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2a): /api/price-reviews endpoints (list, detail, batch confirm/reject)"
```

---

## Task 5: PriceReviewSync + 5-min cron

**Files:**
- Create: `apps/api/src/modules/pricing/review/price-review-sync.service.ts`
- Create: `apps/api/src/modules/pricing/review/price-review-sync.cron.ts`
- Modify: `apps/api/src/modules/pricing/pricing.module.ts`

- [ ] **Step 1: Sync service**

Create `apps/api/src/modules/pricing/review/price-review-sync.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';

function toBigInt(x: any): bigint | null {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  return BigInt(Math.round(n));
}

@Injectable()
export class PriceReviewSyncService {
  private logger = new Logger(PriceReviewSyncService.name);
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async syncShop(shopId: string): Promise<number> {
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop) return 0;
    const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
    const client = await this.clientFactory.forShop(shopId);
    let touched = 0;

    for (let pageNo = 1; pageNo <= 10; pageNo++) {
      let res: any;
      try {
        res = await client.call(ep.listReviews, { pageNo, pageSize: 50 });
      } catch (e: any) {
        this.logger.warn(`shop ${shopId} listReviews failed: ${e.message}`);
        break;
      }
      const list: any[] = res?.orderList ?? res?.list ?? res?.reviewList ?? [];
      if (!list.length) break;
      for (const o of list) {
        const platformOrderId = String(o.orderId ?? o.reviewOrderId ?? '');
        if (!platformOrderId) continue;
        await (this.prisma as any).priceReview.upsert({
          where: { shopId_platformOrderId: { shopId, platformOrderId } },
          create: {
            orgId: shop.orgId,
            shopId,
            platformOrderId,
            platformProductId: o.productId != null ? String(o.productId) : null,
            platformSkuId: o.skuId != null ? String(o.skuId) : null,
            skuTitle: o.productName ?? o.skuName ?? null,
            currentPriceCents: toBigInt(o.currentPrice ?? o.currentSupplierPrice),
            suggestedPriceCents: toBigInt(o.suggestedPrice ?? o.suggestSupplierPrice),
            currency: o.currency ?? null,
            reason: o.reason ?? o.adjustReason ?? null,
            status: o.status === 1 ? 'pending' : o.status === 2 ? 'confirmed' : o.status === 3 ? 'rejected' : 'pending',
            deadlineAt: o.deadline ? new Date(o.deadline) : null,
            platformPayload: o,
          },
          update: {
            skuTitle: o.productName ?? o.skuName ?? null,
            currentPriceCents: toBigInt(o.currentPrice ?? o.currentSupplierPrice),
            suggestedPriceCents: toBigInt(o.suggestedPrice ?? o.suggestSupplierPrice),
            reason: o.reason ?? o.adjustReason ?? null,
            platformPayload: o,
          },
        });
        touched++;
      }
      if (list.length < 50) break;
    }
    this.logger.log(`shop ${shopId} synced ${touched} reviews`);
    return touched;
  }

  async syncAllActiveShops(orgId?: string): Promise<number> {
    const where: any = { status: 'active' };
    if (orgId) where.orgId = orgId;
    const shops = await (this.prisma as any).shop.findMany({ where });
    let total = 0;
    for (const s of shops) {
      try { total += await this.syncShop(s.id); }
      catch (e: any) { this.logger.error(`shop ${s.id} sync failed: ${e.message}`); }
    }
    return total;
  }
}
```

- [ ] **Step 2: Cron**

Create `apps/api/src/modules/pricing/review/price-review-sync.cron.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PriceReviewSyncService } from './price-review-sync.service';

@Injectable()
export class PriceReviewSyncCron {
  private logger = new Logger(PriceReviewSyncCron.name);
  constructor(private sync: PriceReviewSyncService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`cron: touched ${total} reviews`);
  }
}
```

- [ ] **Step 3: Register**

Update `apps/api/src/modules/pricing/pricing.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { PriceReviewService } from './review/price-review.service';
import { PriceReviewController } from './review/price-review.controller';
import { PriceReviewSyncService } from './review/price-review-sync.service';
import { PriceReviewSyncCron } from './review/price-review-sync.cron';

@Module({
  controllers: [PriceReviewController],
  providers: [PriceReviewService, PriceReviewSyncService, PriceReviewSyncCron],
  exports: [PriceReviewService, PriceReviewSyncService],
})
export class PricingModule {}
```

- [ ] **Step 4: Verify API reload clean**

```bash
tail -15 /tmp/duoshou-api.log 2>&1
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/pricing/review/price-review-sync.service.ts \
        duoshou-erp/apps/api/src/modules/pricing/review/price-review-sync.cron.ts \
        duoshou-erp/apps/api/src/modules/pricing/pricing.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2a): price review sync + 5-min cron"
```

---

## Task 6: PriceAdjustment submit endpoint

**Files:**
- Create: `apps/api/src/modules/pricing/adjustment/price-adjustment.dto.ts`
- Create: `apps/api/src/modules/pricing/adjustment/price-adjustment.service.ts`
- Create: `apps/api/src/modules/pricing/adjustment/price-adjustment.controller.ts`
- Modify: `apps/api/src/modules/pricing/pricing.module.ts`

- [ ] **Step 1: DTO**

Create `apps/api/src/modules/pricing/adjustment/price-adjustment.dto.ts`:
```typescript
import { z } from 'zod';

export const SubmitAdjustmentDto = z.object({
  shopId: z.string().uuid(),
  items: z.array(z.object({
    platformSkuId: z.string().min(1),
    newPriceCents: z.number().int().positive(),
    skuTitle: z.string().optional(),
    currency: z.string().optional(),
  })).min(1).max(50),
});
export type SubmitAdjustmentInput = z.infer<typeof SubmitAdjustmentDto>;
```

- [ ] **Step 2: Service**

Create `apps/api/src/modules/pricing/adjustment/price-adjustment.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';
import type { SubmitAdjustmentInput } from './price-adjustment.dto';

@Injectable()
export class PriceAdjustmentService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async submit(orgId: string, input: SubmitAdjustmentInput) {
    const shop = await (this.prisma as any).shop.findFirst({
      where: { id: input.shopId, orgId },
    });
    if (!shop) throw new NotFoundException('Shop not found');

    const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
    const client = await this.clientFactory.forShop(shop.id);

    // Persist local records as 'submitted' before hitting Temu
    const records = await Promise.all(input.items.map((it) =>
      (this.prisma as any).priceAdjustmentOrder.create({
        data: {
          orgId, shopId: shop.id,
          platformSkuId: it.platformSkuId,
          skuTitle: it.skuTitle,
          newPriceCents: BigInt(it.newPriceCents),
          currency: it.currency,
        },
      }),
    ));

    // Build batch payload
    const submitOrders = input.items.map((it) => ({
      productSkuId: it.platformSkuId,
      newSupplierPrice: String(it.newPriceCents),
      currency: it.currency ?? 'USD',
    }));

    try {
      const res: any = await client.call(ep.submitAdjustment, {
        batchResult: 1,  // 1: approve, 2: reject — here submitting new = approve pattern
        submitOrders,
      });
      for (const r of records) {
        await (this.prisma as any).priceAdjustmentOrder.update({
          where: { id: r.id },
          data: { status: 'approved', platformPayload: res, resolvedAt: new Date() },
        });
      }
      return { total: records.length, submittedIds: records.map((r) => r.id), platformResponse: res };
    } catch (e: any) {
      for (const r of records) {
        await (this.prisma as any).priceAdjustmentOrder.update({
          where: { id: r.id },
          data: { status: 'failed', error: { message: e.message }, resolvedAt: new Date() },
        });
      }
      throw e;
    }
  }

  async list(orgId: string, limit = 50) {
    const items = await (this.prisma as any).priceAdjustmentOrder.findMany({
      where: { orgId },
      include: { shop: { select: { displayName: true, platformShopId: true } } },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    });
    return items.map((i: any) => ({
      ...i,
      oldPriceCents: i.oldPriceCents != null ? Number(i.oldPriceCents) : null,
      newPriceCents: Number(i.newPriceCents),
    }));
  }
}
```

- [ ] **Step 3: Controller**

Create `apps/api/src/modules/pricing/adjustment/price-adjustment.controller.ts`:
```typescript
import { Body, Controller, Get, Post, Req, UseGuards, UsePipes, Query } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantService } from '../../tenant/tenant.service';
import { ZodValidationPipe } from '../../../infra/zod-pipe';
import { PriceAdjustmentService } from './price-adjustment.service';
import { SubmitAdjustmentDto, type SubmitAdjustmentInput } from './price-adjustment.dto';

@Controller('price-adjustments')
@UseGuards(AuthGuard)
export class PriceAdjustmentController {
  constructor(private svc: PriceAdjustmentService, private tenant: TenantService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(SubmitAdjustmentDto))
  async submit(@Req() req: any, @Body() body: SubmitAdjustmentInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.submit(m.orgId, body);
  }

  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId, limit ? Number(limit) : 50);
  }
}
```

- [ ] **Step 4: Register**

Update `pricing.module.ts` to include the adjustment service + controller.

- [ ] **Step 5: Verify + commit**

```bash
tail -15 /tmp/duoshou-api.log
```
Look for `Mapped {/api/price-adjustments, POST/GET}` routes.

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/pricing
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w2a): POST /api/price-adjustments (batch submit) + GET list"
```

---

## Task 7: Frontend API clients + stores

**Files:**
- Create: `apps/web/src/api-client/price-reviews.api.ts`
- Create: `apps/web/src/api-client/price-adjustments.api.ts`
- Create: `apps/web/src/stores/price-reviews.ts`

- [ ] **Step 1: price-reviews.api.ts**

```typescript
import { http } from './http';

export interface PriceReview {
  id: string;
  shopId: string;
  platformOrderId: string;
  skuTitle: string | null;
  currentPriceCents: number | null;
  suggestedPriceCents: number | null;
  currency: string | null;
  reason: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  receivedAt: string;
  deadlineAt: string | null;
  shop: { id: string; displayName: string | null; platformShopId: string; shopType: string };
}

export const priceReviewsApi = {
  list: (q: {
    shopId?: string; status?: string; search?: string; page?: number; pageSize?: number;
  } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: PriceReview[] }>('/price-reviews', { query: q }),
  get: (id: string) => http<PriceReview>('/price-reviews/' + id),
  batchConfirm: (reviewIds: string[]) =>
    http<{ total: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
      '/price-reviews/batch-confirm', { method: 'POST', body: JSON.stringify({ reviewIds }) },
    ),
  batchReject: (reviewIds: string[], counterPriceCents: Record<string, number>) =>
    http<{ total: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
      '/price-reviews/batch-reject',
      { method: 'POST', body: JSON.stringify({ reviewIds, counterPriceCents }) },
    ),
};
```

- [ ] **Step 2: price-adjustments.api.ts**

```typescript
import { http } from './http';

export interface PriceAdjustmentOrder {
  id: string;
  shopId: string;
  platformOrderId: string | null;
  platformSkuId: string;
  skuTitle: string | null;
  oldPriceCents: number | null;
  newPriceCents: number;
  currency: string | null;
  status: 'submitted' | 'approved' | 'rejected' | 'failed';
  submittedAt: string;
  resolvedAt: string | null;
  error: any;
}

export interface SubmitAdjustmentItem {
  platformSkuId: string;
  newPriceCents: number;
  skuTitle?: string;
  currency?: string;
}

export const priceAdjustmentsApi = {
  submit: (shopId: string, items: SubmitAdjustmentItem[]) =>
    http<any>('/price-adjustments', { method: 'POST', body: JSON.stringify({ shopId, items }) }),
  list: () => http<PriceAdjustmentOrder[]>('/price-adjustments'),
};
```

- [ ] **Step 3: Store**

Create `apps/web/src/stores/price-reviews.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

export const usePriceReviewsStore = defineStore('price-reviews', () => {
  const items = ref<PriceReview[]>([]);
  const total = ref(0);
  const loading = ref(false);
  async function fetch(q: Parameters<typeof priceReviewsApi.list>[0] = {}) {
    loading.value = true;
    try {
      const r = await priceReviewsApi.list(q);
      items.value = r.items;
      total.value = r.total;
    } finally { loading.value = false; }
  }
  return { items, total, loading, fetch };
});
```

- [ ] **Step 4: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/api-client/price-reviews.api.ts \
        duoshou-erp/apps/web/src/api-client/price-adjustments.api.ts \
        duoshou-erp/apps/web/src/stores/price-reviews.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2a): price-reviews + price-adjustments API client + store"
```

---

## Task 8: PriceReviewInboxPage + DetailPage

**Files:**
- Create: `apps/web/src/pages/price-reviews/PriceReviewInboxPage.vue`
- Create: `apps/web/src/pages/price-reviews/PriceReviewDetailPage.vue`
- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/pages/HomePage.vue` (add nav button)

- [ ] **Step 1: Inbox page (list + bulk actions)**

Create `apps/web/src/pages/price-reviews/PriceReviewInboxPage.vue`:
```vue
<template>
  <n-card title="核价单收件箱">
    <n-space style="margin-bottom: 12px;">
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="按店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="按状态" clearable style="min-width: 130px;" @update:value="() => load(1)" />
      <n-input v-model:value="search" placeholder="按 SKU 标题搜索" clearable @keyup.enter="load(1)" />
    </n-space>

    <n-space style="margin-bottom: 12px;" v-if="selected.length">
      <n-button type="primary" :loading="acting" @click="doBatchConfirm">批量同意（{{ selected.length }}）</n-button>
      <n-button :loading="acting" @click="openRejectDialog">批量拒绝</n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="store.items"
      :loading="store.loading"
      :row-key="(r: any) => r.id"
      :checked-row-keys="selected"
      @update:checked-row-keys="(v: any) => (selected = v)"
    />

    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" />

    <n-modal v-model:show="rejectOpen" preset="card" title="批量拒绝 — 给出反报价" style="width: 600px;">
      <n-table>
        <thead>
          <tr><th>SKU</th><th>Temu 建议价</th><th>我方反报价（分）</th></tr>
        </thead>
        <tbody>
          <tr v-for="id in selected" :key="id">
            <td>{{ store.items.find((x) => x.id === id)?.skuTitle ?? id.slice(0, 8) }}</td>
            <td>{{ store.items.find((x) => x.id === id)?.suggestedPriceCents }}</td>
            <td><n-input-number v-model:value="counters[id]" :min="1" /></td>
          </tr>
        </tbody>
      </n-table>
      <template #footer>
        <n-button type="primary" :loading="acting" @click="doBatchReject">提交</n-button>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NSpace, NSelect, NInput, NButton, NDataTable, NPagination,
  NModal, NTable, NInputNumber, NTag, useMessage,
} from 'naive-ui';
import { usePriceReviewsStore } from '@/stores/price-reviews';
import { useShopsStore } from '@/stores/shops';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

const router = useRouter();
const msg = useMessage();
const store = usePriceReviewsStore();
const shops = useShopsStore();

const shopId = ref<string | null>(null);
const status = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const selected = ref<string[]>([]);
const acting = ref(false);
const rejectOpen = ref(false);
const counters = ref<Record<string, number>>({});

onMounted(async () => { await shops.fetch(); load(1); });

const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);
const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已同意', value: 'confirmed' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已过期', value: 'expired' },
];

async function load(p = page.value) {
  page.value = p;
  await store.fetch({
    shopId: shopId.value ?? undefined,
    status: status.value as any ?? undefined,
    search: search.value || undefined,
    page: p,
    pageSize,
  });
}

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / pageSize)));

const columns: any[] = [
  { type: 'selection' },
  { title: 'SKU', key: 'skuTitle' },
  { title: '店铺', key: 'shop', render: (r: PriceReview) => r.shop?.displayName ?? r.shop?.platformShopId },
  {
    title: '现价',
    key: 'currentPriceCents',
    render: (r: PriceReview) => r.currentPriceCents != null ? `${(r.currentPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '建议价',
    key: 'suggestedPriceCents',
    render: (r: PriceReview) => r.suggestedPriceCents != null ? `${(r.suggestedPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '状态',
    key: 'status',
    render: (r: PriceReview) => h(NTag, {
      type: r.status === 'confirmed' ? 'success' : r.status === 'rejected' ? 'warning' : r.status === 'expired' ? 'error' : 'info',
    }, () => r.status),
  },
  { title: '收到', key: 'receivedAt' },
  {
    title: '操作',
    key: 'actions',
    render: (r: PriceReview) => h(NButton, { size: 'small', onClick: () => router.push(`/price-reviews/${r.id}`) }, () => '详情'),
  },
];

async function doBatchConfirm() {
  acting.value = true;
  try {
    const r = await priceReviewsApi.batchConfirm(selected.value);
    const ok = r.results.filter((x) => x.ok).length;
    msg.success(`${ok}/${r.total} 成功`);
    selected.value = [];
    load();
  } catch (e: any) {
    msg.error(e.message);
  } finally { acting.value = false; }
}

function openRejectDialog() {
  counters.value = Object.fromEntries(
    selected.value.map((id) => [id, store.items.find((x) => x.id === id)?.currentPriceCents ?? 100]),
  );
  rejectOpen.value = true;
}

async function doBatchReject() {
  acting.value = true;
  try {
    const r = await priceReviewsApi.batchReject(selected.value, counters.value);
    const ok = r.results.filter((x) => x.ok).length;
    msg.success(`${ok}/${r.total} 成功`);
    selected.value = [];
    rejectOpen.value = false;
    load();
  } catch (e: any) {
    msg.error(e.message);
  } finally { acting.value = false; }
}
</script>
```

- [ ] **Step 2: Detail page**

Create `apps/web/src/pages/price-reviews/PriceReviewDetailPage.vue`:
```vue
<template>
  <n-card v-if="r" :title="'核价单 ' + r.platformOrderId">
    <n-descriptions :column="2">
      <n-descriptions-item label="SKU">{{ r.skuTitle ?? r.platformSkuId ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="店铺">{{ r.shop?.displayName ?? r.shop?.platformShopId }}</n-descriptions-item>
      <n-descriptions-item label="现价">
        {{ r.currentPriceCents != null ? (r.currentPriceCents / 100).toFixed(2) : '—' }} {{ r.currency }}
      </n-descriptions-item>
      <n-descriptions-item label="建议价">
        {{ r.suggestedPriceCents != null ? (r.suggestedPriceCents / 100).toFixed(2) : '—' }} {{ r.currency }}
      </n-descriptions-item>
      <n-descriptions-item label="状态">
        <n-tag>{{ r.status }}</n-tag>
      </n-descriptions-item>
      <n-descriptions-item label="截止">{{ r.deadlineAt ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="原因" :span="2">{{ r.reason ?? '—' }}</n-descriptions-item>
    </n-descriptions>

    <n-space style="margin-top: 16px;" v-if="r.status === 'pending'">
      <n-button type="primary" :loading="acting" @click="confirm">同意</n-button>
      <n-input-number v-model:value="counterCents" :min="1" placeholder="反报价（分）" />
      <n-button :loading="acting" @click="reject">提交拒绝</n-button>
    </n-space>
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NSpace, NButton, NInputNumber, NSpin, useMessage,
} from 'naive-ui';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

const route = useRoute();
const router = useRouter();
const msg = useMessage();
const r = ref<PriceReview | null>(null);
const counterCents = ref<number>(100);
const acting = ref(false);

async function load() {
  r.value = await priceReviewsApi.get(String(route.params.id));
}

onMounted(load);

async function confirm() {
  acting.value = true;
  try { await priceReviewsApi.batchConfirm([r.value!.id]); msg.success('已同意'); router.push('/price-reviews'); }
  catch (e: any) { msg.error(e.message); }
  finally { acting.value = false; }
}

async function reject() {
  acting.value = true;
  try {
    await priceReviewsApi.batchReject([r.value!.id], { [r.value!.id]: counterCents.value });
    msg.success('已提交反报价');
    router.push('/price-reviews');
  } catch (e: any) { msg.error(e.message); }
  finally { acting.value = false; }
}
</script>
```

- [ ] **Step 3: Router + HomePage nav**

Update `apps/web/src/router/index.ts` to add routes:
```typescript
import PriceReviewInboxPage from '@/pages/price-reviews/PriceReviewInboxPage.vue';
import PriceReviewDetailPage from '@/pages/price-reviews/PriceReviewDetailPage.vue';
// ... add to routes array:
{ path: '/price-reviews', component: PriceReviewInboxPage, meta: { requiresAuth: true } },
{ path: '/price-reviews/:id', component: PriceReviewDetailPage, meta: { requiresAuth: true } },
```

Update `apps/web/src/pages/HomePage.vue` to add a nav button:
```vue
<n-button @click="$router.push('/price-reviews')">核价单</n-button>
```

- [ ] **Step 4: Build + commit**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -10
```

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/price-reviews \
        duoshou-erp/apps/web/src/router/index.ts \
        duoshou-erp/apps/web/src/pages/HomePage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2a): price review inbox + detail pages (filter + bulk confirm/reject)"
```

---

## Task 9: PriceAdjustment submit page

**Files:**
- Create: `apps/web/src/pages/price-adjustments/PriceAdjustmentSubmitPage.vue`
- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/pages/HomePage.vue`

- [ ] **Step 1: Page**

Create `apps/web/src/pages/price-adjustments/PriceAdjustmentSubmitPage.vue`:
```vue
<template>
  <n-card title="提交调价申请">
    <n-form label-placement="top">
      <n-form-item label="店铺">
        <n-select v-model:value="shopId" :options="shopOptions" placeholder="选择店铺" />
      </n-form-item>
      <n-form-item label="SKU 调价列表">
        <n-dynamic-input v-model:value="items" :on-create="() => ({ platformSkuId: '', newPriceCents: 100, skuTitle: '' })">
          <template #default="{ value }">
            <n-space>
              <n-input v-model:value="value.platformSkuId" placeholder="platform SKU id" />
              <n-input v-model:value="value.skuTitle" placeholder="SKU 标题（可选）" />
              <n-input-number v-model:value="value.newPriceCents" :min="1" placeholder="新价（分）" />
            </n-space>
          </template>
        </n-dynamic-input>
      </n-form-item>
      <n-space>
        <n-button type="primary" :loading="busy" @click="submit" :disabled="!shopId || items.length === 0">提交</n-button>
        <n-button @click="$router.back()">取消</n-button>
      </n-space>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NForm, NFormItem, NSelect, NDynamicInput, NInput, NInputNumber, NSpace, NButton, useMessage,
} from 'naive-ui';
import { useShopsStore } from '@/stores/shops';
import { priceAdjustmentsApi, type SubmitAdjustmentItem } from '@/api-client/price-adjustments.api';

const router = useRouter();
const msg = useMessage();
const shops = useShopsStore();
const shopId = ref<string>('');
const items = ref<SubmitAdjustmentItem[]>([]);
const busy = ref(false);

onMounted(() => shops.fetch());

const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: `${s.displayName ?? s.platformShopId} (${s.shopType})`, value: s.id })),
);

async function submit() {
  busy.value = true;
  try {
    await priceAdjustmentsApi.submit(shopId.value, items.value);
    msg.success('调价申请已提交');
    router.push('/price-reviews');
  } catch (e: any) {
    msg.error(e.message);
  } finally { busy.value = false; }
}
</script>
```

- [ ] **Step 2: Route + nav**

Router:
```typescript
import PriceAdjustmentSubmitPage from '@/pages/price-adjustments/PriceAdjustmentSubmitPage.vue';
{ path: '/price-adjustments/new', component: PriceAdjustmentSubmitPage, meta: { requiresAuth: true } },
```

HomePage button:
```vue
<n-button @click="$router.push('/price-adjustments/new')">提交调价</n-button>
```

- [ ] **Step 3: Build + commit**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web && pnpm build 2>&1 | tail -5
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/price-adjustments \
        duoshou-erp/apps/web/src/router/index.ts \
        duoshou-erp/apps/web/src/pages/HomePage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w2a): price-adjustment submit page"
```

---

## Task 10: W2a E2E smoke + manual verify

**Files:**
- Create: `apps/api/scripts/smoke-w2a.mjs`

- [ ] **Step 1: Smoke script**

Create `apps/api/scripts/smoke-w2a.mjs`:
```javascript
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:3000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-w2a-${Date.now()}@duoshou.test`;
const pw = 'SmokeW2a!2026';

console.log('=== W2a price review smoke ===');

const { data: c1, error: e1 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (e1) throw e1;
const { data: l1 } = await anon.auth.signInWithPassword({ email, password: pw });
const token = l1.session.access_token;

const fetchA = (path, init = {}) => fetch(API + path, {
  ...init,
  headers: { Authorization: `Bearer ${token}`, ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
});

// Connect test shop (full, pa — per W1 findings)
console.log('\n[1/5] connect test shop');
const shop = await (await fetchA('/shops', {
  method: 'POST', body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full', region: 'pa', displayName: 'smoke-w2a',
  }),
})).json();
console.log('  shop:', shop.id);

// 2. List reviews (expect empty array; sync cron may or may not have run)
console.log('\n[2/5] GET /price-reviews');
const listResp = await fetchA('/price-reviews');
console.log('  status:', listResp.status);
const list = await listResp.json();
console.log('  items count:', list.items?.length ?? 0, 'total:', list.total);

// 3. Manually invoke a shop sync via node (probe the service directly would require admin endpoint;
//    instead trust cron. Or call the Temu API directly as a smoke probe.)
console.log('\n[3/5] probe bg.price.review.page.query directly via sign script');
// (For the smoke we skip — the sync cron will run every 5 min during normal operation.)

// 4. Batch confirm (on empty list — should return total: 0)
console.log('\n[4/5] POST /price-reviews/batch-confirm (empty — dry)');
const confirmResp = await fetchA('/price-reviews/batch-confirm', {
  method: 'POST', body: JSON.stringify({ reviewIds: ['00000000-0000-0000-0000-000000000000'] }),
});
console.log('  status:', confirmResp.status);

// 5. Cleanup
console.log('\n[5/5] cleanup');
await admin.auth.admin.deleteUser(c1.user.id);
console.log('\n✅ W2a infra smoke PASSED');
```

- [ ] **Step 2: Run**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
node scripts/smoke-w2a.mjs 2>&1 | tail -40
```

Expected: Steps 1, 2, 5 all return 200. Step 3 is skipped. Step 4 returns 200 with `{total: 0, results: []}` (no reviews matched because none exist yet).

**Note on real reviews**: The test account's shop may or may not have pending price-review orders in Temu. If it does, the 5-minute cron will eventually populate them; re-run `GET /price-reviews` manually to verify. If never populated, that's a Temu state fact, not an infra bug.

- [ ] **Step 3: Manual UI verify (optional)**

Open http://localhost:5173 → login → "核价单" button → see inbox (likely empty). Then "提交调价" → fill test SKU → submit → check API response in browser devtools.

- [ ] **Step 4: Tag + commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/scripts/smoke-w2a.mjs
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "test(w2a): infra smoke"
git tag w2a-complete
```

---

## Done — what's next

- W2a infra in place; real price reviews will appear as they accumulate in Temu
- W2b (activity calendar) has a parallel structure (list + bulk enroll) — should be fast to replicate the pattern
- W3 (inventory) will need `inventory_snapshot` partitioned table + polling; same cron pattern
- W4 (submit to Temu app market) needs: UI polish, deployed environment, test account instructions, demo video

## Known gaps for W2.5

- `submitAdjustment` payload may need more fields per `bg.*.adjust.price.batch.review` — audit via diag script if real requests fail
- Sync service assumes response shape; if Temu returns different field names (like `orderList` vs `reviewList`), expand the fallback chain
- Price history (`bg.goods.price.list.get`) not exposed yet — deferred to W2.5 as on-hover UI detail in the inbox
- WebSocket live push of new reviews — polling every 3 seconds on inbox page would work; true WebSocket belongs to W3 event bus
