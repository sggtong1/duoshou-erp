# W1 Cross-Shop Product Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a merchant define a product template once, then batch-publish it to N Temu shops in one click. Track per-shop publish progress, retry failures, sync the resulting products back into our database.

**Architecture:** New Prisma models (`product_template`, `product`, `sku`, `bulk_job`, `bulk_job_item`) extend the W0 schema. BullMQ queue `product-publish` fans out one job per (template, shop) pair. Each worker decrypts shop credentials, builds a Temu-specific `bg.goods.add` / `bg.glo.goods.add` request via a payload builder, calls `TemuClient.call` (rate-limited), records the result. A Temu-proxy module wraps read-only Temu APIs (categories, attrs, image upload sign) so the frontend can render pickers without embedding Temu credentials. Frontend adds 3 pages (product list, template editor, job progress).

**Tech Stack:** NestJS 10 + BullMQ 5 + ioredis + Prisma 7 + @duoshou/temu-sdk (W0 deliverable); Vue 3 + Naive UI + Pinia.

---

## Context (what exists from W0)

Already in place — do NOT re-build:

- `apps/api` runs NestJS, health endpoint, env-validated startup. Dev command `pnpm --filter @duoshou/api dev`.
- `@duoshou/temu-sdk` exports `TemuClient`, `methods.*` (178 generated functions), `TEMU_API_REGISTRY`, signing, retry, Redis token bucket. Published via tsup (CJS+ESM).
- `AuthGuard` (JWT via Supabase `auth.getUser(token)`), `TenantService.resolveForUser(req.user)` auto-creates org+member on first call.
- `ShopController` (`POST /api/shops`, `GET /api/shops`) — connects a Temu shop with encrypted credentials. `ShopCredentials.appKeyEncrypted` etc. are AES-256-GCM.
- Prisma models: `User`, `Organization`, `Member`, `ShopCredentials`, `Shop`.
- Shop row has `orgId`, `platform='temu'`, `platformShopId`, `shopType ∈ {full,semi}`, `region ∈ {cn,pa}`, `credsVaultRef → ShopCredentials.id`.
- Redis client: `new Redis(process.env.REDIS_URL, { lazyConnect: true })` used in `ShopService`. Upstash URL pattern: `rediss://default:<pw>@<host>.upstash.io:6379`.
- `infra/crypto.ts` has `encrypt(plaintext, keyBase64)` → `Buffer`, `decrypt(blob, keyBase64)` → `string`. `CREDS_ENCRYPTION_KEY` in env is 44-char base64 (32 bytes).
- `apps/web` is Vue 3 SPA with Pinia, Naive UI, router with `beforeEach` auth guard, `stores/auth.ts` exposes `authHeader()`.

## Key Temu API references (from `docs/references/temu/`)

- `bg.goods.cats.get` (CN) — tree of categories, leaf detection via `isLeaf: true`
- `bg.goods.attrs.get` (CN) — attribute template by `catId`
- `bg.goods.image.upload.global` (PA) — image upload returning platform URL
- `bg.goods.add` (CN) — publish for full/semi via `productSemiManagedReq`
- `bg.glo.goods.add` (PA) — publish for PA-region shops
- `bg.product.search` (CN) / `bg.glo.product.search` (PA) — query listing status by product id
- `bg.logistics.template.get` — for semi-managed freight template id lookup

All are accessible via `methods.bgGoodsCatsGet(ctx, req)` etc. from `@duoshou/temu-sdk`, or dynamically via `TemuClient.call('bg.goods.cats.get', req)`.

## Scope boundaries for W1 (YAGNI)

**In scope:**
- Template with: title, description, leaf category, main image, up to 9 carousel images, required category attributes (key-value strings), single SKC, single SKU (non-apparel flow), price in cents, outer-package dimensions/weight.
- Bulk publish to N shops, per-shop price override.
- Shop-type mismatch error (template declares 'full' but target shop is 'semi' → skip that shop, report).
- Publish progress polling.
- Product sync (populate `product` table from `bg.glo.product.search`).

**Out of scope (explicit — defer to W1.5+):**
- Apparel flow (variants by color/size via sizecharts API group)
- Video upload (W1.5)
- Edit API (`bg.goods.edit.*`)
- Semi-managed multi-site publish (`productSemiManagedReq.bindSiteIds` supports only first site for W1)
- JIT mode / virtual inventory
- Package of brand, accessories, model-info (apparel modelling)
- Rich text description formatting (plain text only)
- Bulk edit existing products
- Custom attribute auto-filling via AI
- Saved shop-group presets

## File structure

```
apps/api/
├─ prisma/
│  ├─ migrations/20260419000000_w1_products/migration.sql       (new, hand-written)
│  └─ schema.prisma                                              (modify)
├─ src/
│  ├─ infra/
│  │  ├─ queue.module.ts                                         (new; BullMQ registration)
│  │  └─ redis.ts                                                (new; shared Redis factory)
│  └─ modules/
│     ├─ platform/
│     │  └─ temu/
│     │     └─ temu-client-factory.service.ts                    (new; builds TemuClient per shop row)
│     ├─ temu-proxy/                                             (new module)
│     │  ├─ temu-proxy.module.ts
│     │  ├─ temu-proxy.controller.ts
│     │  └─ temu-proxy.service.ts
│     └─ product/                                                (new module)
│        ├─ product.module.ts
│        ├─ product-template.controller.ts
│        ├─ product-template.service.ts
│        ├─ product-template.dto.ts
│        ├─ product-template.service.test.ts
│        ├─ bulk-job.controller.ts
│        ├─ bulk-job.service.ts
│        ├─ bulk-job.dto.ts
│        ├─ publish/
│        │  ├─ publish-dispatcher.service.ts                     (enqueues BullMQ jobs)
│        │  ├─ publish.processor.ts                              (BullMQ worker)
│        │  ├─ temu-goods-payload-builder.ts
│        │  └─ temu-goods-payload-builder.test.ts
│        └─ sync/
│           ├─ product-sync.service.ts
│           └─ product-sync.cron.ts
apps/web/
├─ src/
│  ├─ api-client/
│  │  ├─ http.ts                                                 (new; fetch wrapper with auth)
│  │  ├─ templates.api.ts
│  │  ├─ temu-proxy.api.ts
│  │  ├─ bulk-jobs.api.ts
│  │  └─ products.api.ts
│  ├─ stores/
│  │  ├─ templates.ts
│  │  ├─ bulk-jobs.ts
│  │  └─ shops.ts
│  ├─ pages/
│  │  ├─ products/
│  │  │  ├─ ProductListPage.vue
│  │  │  ├─ TemplateListPage.vue
│  │  │  └─ TemplateEditorPage.vue
│  │  └─ bulk-jobs/
│  │     └─ BulkJobProgressPage.vue
│  └─ components/
│     ├─ CategoryPicker.vue
│     ├─ ShopMultiselect.vue
│     └─ ImageUpload.vue
```

## Env additions

Append to `apps/api/.env.development.example` (and set actual values in `.env.development`):

```
# BullMQ queue prefix — defaults to "duoshou"
QUEUE_PREFIX=duoshou
# Max concurrent publish jobs per worker
PUBLISH_CONCURRENCY=4
```

---

## Task 1: Prisma schema — product tables

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260419000000_w1_products/migration.sql`

- [ ] **Step 1: Append new models to schema.prisma**

Open `apps/api/prisma/schema.prisma` and APPEND (do not remove existing models):

```prisma
model ProductTemplate {
  id                 String   @id @default(uuid())
  orgId              String   @map("org_id")
  name               String
  description        String?
  temuCategoryId     BigInt   @map("temu_category_id")
  temuCategoryPath   String[] @map("temu_category_path")
  shopTypeTarget     String   @map("shop_type_target")  // 'full' | 'semi'
  mainImageUrl       String   @map("main_image_url")
  carouselImageUrls  String[] @map("carousel_image_urls")
  suggestedPriceCents BigInt  @map("suggested_price_cents")
  attributes         Json     @default("{}")
  outerPackage       Json     @map("outer_package")     // {lengthMm,widthMm,heightMm,weightG}
  platformSpecific   Json     @default("{}") @map("platform_specific")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  org       Organization @relation(fields: [orgId], references: [id])
  bulkJobs  BulkJob[]

  @@index([orgId])
  @@map("product_template")
}

model Product {
  id                  String   @id @default(uuid())
  orgId               String   @map("org_id")
  shopId              String   @map("shop_id")
  templateId          String?  @map("template_id")
  platform            String   @default("temu")
  platformProductId   String   @map("platform_product_id")
  title               String
  status              String   @default("active")
  commonAttrs         Json     @default("{}") @map("common_attrs")
  platformSpecific    Json     @default("{}") @map("platform_specific")
  lastSyncedAt        DateTime @default(now()) @map("last_synced_at")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  org       Organization     @relation(fields: [orgId], references: [id])
  shop      Shop             @relation(fields: [shopId], references: [id])
  template  ProductTemplate? @relation(fields: [templateId], references: [id])
  skus      Sku[]

  @@unique([shopId, platformProductId])
  @@index([orgId, platform])
  @@map("product")
}

model Sku {
  id              String @id @default(uuid())
  productId       String @map("product_id")
  platformSkuId   String @map("platform_sku_id")
  platformSkcId   String? @map("platform_skc_id")
  barcode         String?
  priceCents      BigInt @map("price_cents")
  stockHint       Int    @default(0) @map("stock_hint")
  spec            Json   @default("{}")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, platformSkuId])
  @@map("sku")
}

model BulkJob {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  type        String   // 'product_publish'
  templateId  String?  @map("template_id")
  total       Int      @default(0)
  succeeded   Int      @default(0)
  failed      Int      @default(0)
  status      String   @default("pending")  // pending|running|completed|failed
  startedAt   DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")
  createdAt   DateTime @default(now()) @map("created_at")

  org      Organization    @relation(fields: [orgId], references: [id])
  template ProductTemplate? @relation(fields: [templateId], references: [id])
  items    BulkJobItem[]

  @@index([orgId, createdAt])
  @@map("bulk_job")
}

model BulkJobItem {
  id              String   @id @default(uuid())
  jobId           String   @map("job_id")
  shopId          String   @map("shop_id")
  status          String   @default("pending")  // pending|running|succeeded|failed
  idempotencyKey  String   @unique @map("idempotency_key")
  resultProductId String?  @map("result_product_id")
  error           Json?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  job  BulkJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  shop Shop    @relation(fields: [shopId], references: [id])

  @@index([jobId, status])
  @@map("bulk_job_item")
}
```

Also add backreferences inside existing models — edit the `Organization` and `Shop` blocks:

Find `model Organization` and inside the relations section add:
```prisma
  productTemplates ProductTemplate[]
  products         Product[]
  bulkJobs         BulkJob[]
```

Find `model Shop` and inside the relations section add:
```prisma
  products     Product[]
  bulkJobItems BulkJobItem[]
```

- [ ] **Step 2: Generate migration SQL via prisma migrate diff**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
export DATABASE_URL='postgresql://dummy:dummy@localhost:5432/dummy'
mkdir -p prisma/migrations/20260419000000_w1_products
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260419000000_w1_products/migration.sql 2>&1 || true
```

If `prisma migrate diff` fails (Prisma 7 adapter quirk), hand-write the migration:

```sql
-- CreateTable
CREATE TABLE "product_template" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "temu_category_id" BIGINT NOT NULL,
    "temu_category_path" TEXT[],
    "shop_type_target" TEXT NOT NULL,
    "main_image_url" TEXT NOT NULL,
    "carousel_image_urls" TEXT[],
    "suggested_price_cents" BIGINT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "outer_package" JSONB NOT NULL,
    "platform_specific" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_template_org_id_idx" ON "product_template"("org_id");

CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "template_id" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'temu',
    "platform_product_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "common_attrs" JSONB NOT NULL DEFAULT '{}',
    "platform_specific" JSONB NOT NULL DEFAULT '{}',
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_shop_id_platform_product_id_key" ON "product"("shop_id","platform_product_id");
CREATE INDEX "product_org_id_platform_idx" ON "product"("org_id","platform");

CREATE TABLE "sku" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "platform_sku_id" TEXT NOT NULL,
    "platform_skc_id" TEXT,
    "barcode" TEXT,
    "price_cents" BIGINT NOT NULL,
    "stock_hint" INTEGER NOT NULL DEFAULT 0,
    "spec" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "sku_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sku_product_id_platform_sku_id_key" ON "sku"("product_id","platform_sku_id");

CREATE TABLE "bulk_job" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "template_id" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bulk_job_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bulk_job_org_id_created_at_idx" ON "bulk_job"("org_id","created_at");

CREATE TABLE "bulk_job_item" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "result_product_id" TEXT,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bulk_job_item_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bulk_job_item_idempotency_key_key" ON "bulk_job_item"("idempotency_key");
CREATE INDEX "bulk_job_item_job_id_status_idx" ON "bulk_job_item"("job_id","status");

-- Foreign keys
ALTER TABLE "product_template" ADD CONSTRAINT "product_template_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "product_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sku" ADD CONSTRAINT "sku_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bulk_job" ADD CONSTRAINT "bulk_job_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bulk_job" ADD CONSTRAINT "bulk_job_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "product_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bulk_job_item" ADD CONSTRAINT "bulk_job_item_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "bulk_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bulk_job_item" ADD CONSTRAINT "bulk_job_item_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Verify the file is non-empty:
```bash
wc -l prisma/migrations/20260419000000_w1_products/migration.sql
```
Expected: ≥ 80 lines.

- [ ] **Step 3: Apply migration to Supabase**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
set -a && source .env.development && set +a
pnpm prisma migrate deploy
```

Expected: `Applying migration '20260419000000_w1_products'` then `All migrations have been successfully applied.`

- [ ] **Step 4: Generate Prisma client**

```bash
set -a && source .env.development && set +a
pnpm prisma generate
```

Expected: client generated without error.

- [ ] **Step 5: Verify tables via psql**

```bash
set -a && source .env.development && set +a
node -e "
import('pg').then(async ({default: pg}) => {
  const c = new pg.Client({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}});
  await c.connect();
  const r = await c.query(\"select table_name from information_schema.tables where table_schema='public' and table_name in ('product_template','product','sku','bulk_job','bulk_job_item') order by table_name\");
  console.log(r.rows.map(x => x.table_name).join(','));
  await c.end();
});
"
```
Expected output: `bulk_job,bulk_job_item,product,product_template,sku`

- [ ] **Step 6: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/prisma/schema.prisma duoshou-erp/apps/api/prisma/migrations/20260419000000_w1_products/
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): add product template / product / sku / bulk_job models"
```

---

## Task 2: BullMQ + shared Redis factory

**Files:**
- Create: `apps/api/src/infra/redis.ts`
- Create: `apps/api/src/infra/queue.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json` (add `bullmq`)
- Modify: `apps/api/src/modules/shop/shop.service.ts` (use shared Redis factory)

- [ ] **Step 1: Install BullMQ**

```bash
cd /Users/mx4com/coding/duoshou-erp
pnpm --filter @duoshou/api add bullmq
```

- [ ] **Step 2: Shared Redis factory**

Create `apps/api/src/infra/redis.ts`:
```typescript
import Redis, { type RedisOptions } from 'ioredis';

let _shared: Redis | null = null;

export function sharedRedis(): Redis {
  if (_shared) return _shared;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is not set');
  _shared = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: null,  // REQUIRED by BullMQ
    enableReadyCheck: false,
  });
  _shared.on('error', (e) => console.error('[redis] error', e.message));
  return _shared;
}

export function makeRedisClient(): Redis {
  // Create a dedicated client (BullMQ needs separate connections per Worker/Queue).
  const url = process.env.REDIS_URL!;
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
```

- [ ] **Step 3: Queue module**

Create `apps/api/src/infra/queue.module.ts`:
```typescript
import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { makeRedisClient } from './redis';

export const QUEUE_PREFIX = process.env.QUEUE_PREFIX ?? 'duoshou';

export const PUBLISH_QUEUE_TOKEN = 'PUBLISH_QUEUE';

const queueFactory = {
  provide: PUBLISH_QUEUE_TOKEN,
  useFactory: () => {
    return new Queue('product-publish', {
      connection: makeRedisClient(),
      prefix: QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    });
  },
};

@Global()
@Module({
  providers: [queueFactory],
  exports: [queueFactory],
})
export class QueueModule implements OnModuleDestroy {
  constructor() {}
  async onModuleDestroy() {
    // Queues are closed via their own connection lifecycle
  }
}
```

- [ ] **Step 4: Register QueueModule**

Edit `apps/api/src/app.module.ts` — add `QueueModule` to imports:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/prisma.module';
import { QueueModule } from './infra/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { HealthModule } from './modules/health/health.module';
import { ShopModule } from './modules/shop/shop.module';

@Module({
  imports: [PrismaModule, QueueModule, AuthModule, TenantModule, HealthModule, ShopModule],
})
export class AppModule {}
```

- [ ] **Step 5: Update shop.service to use shared redis (so connection reused)**

Edit `apps/api/src/modules/shop/shop.service.ts` — replace the `this.redis = new Redis(...)` line:

Find:
```typescript
import Redis from 'ioredis';
// ...
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true });
  }
```

Replace with:
```typescript
import type Redis from 'ioredis';
import { sharedRedis } from '../../infra/redis';
// ...
  private get redis(): Redis {
    return sharedRedis();
  }

  constructor(private prisma: PrismaService) {}
```

- [ ] **Step 6: Bootstrap check**

Restart API dev server (or let watch reload). Verify log shows `API listening on :3000` with no Redis errors.

```bash
tail -10 /tmp/duoshou-api.log
```

Hit health:
```bash
curl -s http://localhost:3000/api/health
```
Expected: `{"ok":true,...}`

- [ ] **Step 7: Write queue smoke test**

Create `apps/api/src/infra/queue.module.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { makeRedisClient } from './redis';

describe('queue infrastructure', () => {
  let queue: Queue;
  let worker: Worker;

  beforeAll(() => {
    process.env.REDIS_URL ??= 'redis://localhost:6379';
  });

  afterAll(async () => {
    await worker?.close();
    await queue?.close();
  });

  it('round-trips a job through a BullMQ queue', async () => {
    queue = new Queue('test-queue', { connection: makeRedisClient(), prefix: 'duoshou-test' });
    const processed: any[] = [];
    worker = new Worker(
      'test-queue',
      async (job) => { processed.push(job.data); return { echoed: job.data }; },
      { connection: makeRedisClient(), prefix: 'duoshou-test' },
    );
    await queue.add('echo', { hello: 'world' });
    await new Promise((r) => setTimeout(r, 500));
    expect(processed).toHaveLength(1);
    expect(processed[0]).toEqual({ hello: 'world' });
  }, 10000);
});
```

Run:
```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/infra/queue.module.test.ts
```

Expected: PASS (requires real Redis via REDIS_URL env). If running without Redis, test fails fast — this is fine for W1 since you have Upstash.

- [ ] **Step 8: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/infra/redis.ts \
        duoshou-erp/apps/api/src/infra/queue.module.ts \
        duoshou-erp/apps/api/src/infra/queue.module.test.ts \
        duoshou-erp/apps/api/src/modules/shop/shop.service.ts \
        duoshou-erp/apps/api/src/app.module.ts \
        duoshou-erp/apps/api/package.json \
        duoshou-erp/pnpm-lock.yaml
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): BullMQ queue infra + shared Redis factory"
```

---

## Task 3: TemuClientFactory — build per-shop client

**Files:**
- Create: `apps/api/src/modules/platform/temu/temu-client-factory.service.ts`
- Create: `apps/api/src/modules/platform/temu/temu-client-factory.service.test.ts`
- Create: `apps/api/src/modules/platform/platform.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write test first**

Create `apps/api/src/modules/platform/temu/temu-client-factory.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { TemuClientFactoryService } from './temu-client-factory.service';
import { encrypt } from '../../../infra/crypto';

describe('TemuClientFactoryService', () => {
  let prisma: any;
  const key = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    process.env.CREDS_ENCRYPTION_KEY = key;
    process.env.REDIS_URL = 'redis://localhost:6379';
    const credsRow = {
      id: 'creds-1',
      appKeyEncrypted: encrypt('ak_1', key),
      appSecretEncrypted: encrypt('as_1', key),
      accessTokenEncrypted: encrypt('tok_1', key),
    };
    prisma = {
      shop: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'shop-1',
          orgId: 'org-1',
          platform: 'temu',
          platformShopId: '1052202882',
          region: 'cn',
          shopType: 'full',
          credsVaultRef: 'creds-1',
          creds: credsRow,
        }),
      },
    };
  });

  it('builds a TemuClient with decrypted credentials for a shop', async () => {
    const svc = new TemuClientFactoryService(prisma as any);
    const client = await svc.forShop('shop-1');
    expect(client.ctx.appKey).toBe('ak_1');
    expect(client.ctx.appSecret).toBe('as_1');
    expect(client.ctx.accessToken).toBe('tok_1');
    expect(client.ctx.region).toBe('cn');
    expect(client.ctx.shopId).toBe('1052202882');
  });

  it('throws when shop row does not exist', async () => {
    prisma.shop.findUniqueOrThrow.mockRejectedValueOnce(new Error('Not found'));
    const svc = new TemuClientFactoryService(prisma as any);
    await expect(svc.forShop('missing')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/modules/platform/temu/temu-client-factory.service.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement TemuClientFactoryService**

Create `apps/api/src/modules/platform/temu/temu-client-factory.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { TemuClient } from '@duoshou/temu-sdk';
import { PrismaService } from '../../../infra/prisma.service';
import { sharedRedis } from '../../../infra/redis';
import { decrypt } from '../../../infra/crypto';

@Injectable()
export class TemuClientFactoryService {
  constructor(private prisma: PrismaService) {}

  async forShop(shopId: string): Promise<TemuClient> {
    const shop = await (this.prisma as any).shop.findUniqueOrThrow({
      where: { id: shopId },
      include: { creds: true },
    });
    const key = process.env.CREDS_ENCRYPTION_KEY;
    if (!key) throw new Error('CREDS_ENCRYPTION_KEY not set');

    const creds = shop.creds;
    const appKey = decrypt(Buffer.from(creds.appKeyEncrypted), key);
    const appSecret = decrypt(Buffer.from(creds.appSecretEncrypted), key);
    const accessToken = decrypt(Buffer.from(creds.accessTokenEncrypted), key);

    return new TemuClient({
      appKey,
      appSecret,
      accessToken,
      region: shop.region as 'cn' | 'pa',
      shopId: shop.platformShopId,
    }, { redis: sharedRedis(), qps: 5, burst: 5 });
  }
}
```

- [ ] **Step 4: Platform module**

Create `apps/api/src/modules/platform/platform.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { TemuClientFactoryService } from './temu/temu-client-factory.service';

@Global()
@Module({
  providers: [TemuClientFactoryService],
  exports: [TemuClientFactoryService],
})
export class PlatformModule {}
```

Register in `app.module.ts`:
```typescript
import { PlatformModule } from './modules/platform/platform.module';

@Module({
  imports: [PrismaModule, QueueModule, PlatformModule, AuthModule, TenantModule, HealthModule, ShopModule],
})
export class AppModule {}
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/modules/platform/temu/temu-client-factory.service.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/platform \
        duoshou-erp/apps/api/src/app.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): TemuClientFactory — rate-limited client per shop"
```

---

## Task 4: Temu proxy — categories

**Files:**
- Create: `apps/api/src/modules/temu-proxy/temu-proxy.module.ts`
- Create: `apps/api/src/modules/temu-proxy/temu-proxy.controller.ts`
- Create: `apps/api/src/modules/temu-proxy/temu-proxy.service.ts`
- Create: `apps/api/src/modules/temu-proxy/temu-proxy.service.test.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Test**

Create `apps/api/src/modules/temu-proxy/temu-proxy.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemuProxyService } from './temu-proxy.service';

describe('TemuProxyService.getCategoryChildren', () => {
  let clientFactory: any;
  let mockClient: any;
  beforeEach(() => {
    mockClient = { call: vi.fn() };
    clientFactory = { forShop: vi.fn().mockResolvedValue(mockClient) };
  });

  it('returns children for a parent catId', async () => {
    mockClient.call.mockResolvedValue({
      goodsCatsList: [
        { catId: 100, catName: 'Electronics', isLeaf: false },
        { catId: 101, catName: 'Apparel', isLeaf: false },
      ],
    });
    const svc = new TemuProxyService(clientFactory);
    const r = await svc.getCategoryChildren('shop-1', 0);
    expect(r).toEqual([
      { catId: 100, catName: 'Electronics', isLeaf: false },
      { catId: 101, catName: 'Apparel', isLeaf: false },
    ]);
    expect(mockClient.call).toHaveBeenCalledWith('bg.goods.cats.get', { parentCatId: 0 });
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm vitest run src/modules/temu-proxy/temu-proxy.service.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement service**

Create `apps/api/src/modules/temu-proxy/temu-proxy.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { TemuClientFactoryService } from '../platform/temu/temu-client-factory.service';

export interface TemuCategory {
  catId: number;
  catName: string;
  isLeaf: boolean;
}

@Injectable()
export class TemuProxyService {
  constructor(private clientFactory: TemuClientFactoryService) {}

  async getCategoryChildren(shopId: string, parentCatId: number): Promise<TemuCategory[]> {
    const client = await this.clientFactory.forShop(shopId);
    const res: any = await client.call('bg.goods.cats.get', { parentCatId });
    const list = res?.goodsCatsList ?? res?.list ?? [];
    return list.map((c: any) => ({
      catId: Number(c.catId),
      catName: String(c.catName ?? c.catEnName ?? ''),
      isLeaf: !!c.isLeaf,
    }));
  }

  async getCategoryAttrs(shopId: string, catId: number): Promise<any> {
    const client = await this.clientFactory.forShop(shopId);
    return await client.call('bg.goods.attrs.get', { catId });
  }
}
```

- [ ] **Step 4: Controller**

Create `apps/api/src/modules/temu-proxy/temu-proxy.controller.ts`:
```typescript
import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { PrismaService } from '../../infra/prisma.service';
import { TemuProxyService } from './temu-proxy.service';

@Controller('temu')
@UseGuards(AuthGuard)
export class TemuProxyController {
  constructor(
    private proxy: TemuProxyService,
    private tenant: TenantService,
    private prisma: PrismaService,
  ) {}

  private async assertShopBelongsToUser(req: any, shopId: string) {
    const member = await this.tenant.resolveForUser(req.user);
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.orgId !== member.orgId) {
      throw new BadRequestException('Shop not found or not owned by your organization');
    }
  }

  @Get('categories')
  async categories(
    @Req() req: any,
    @Query('shopId') shopId: string,
    @Query('parentCatId') parentCatId = '0',
  ) {
    if (!shopId) throw new BadRequestException('shopId is required');
    await this.assertShopBelongsToUser(req, shopId);
    return this.proxy.getCategoryChildren(shopId, Number(parentCatId));
  }

  @Get('category-attrs')
  async categoryAttrs(
    @Req() req: any,
    @Query('shopId') shopId: string,
    @Query('catId') catId: string,
  ) {
    if (!shopId || !catId) throw new BadRequestException('shopId and catId required');
    await this.assertShopBelongsToUser(req, shopId);
    return this.proxy.getCategoryAttrs(shopId, Number(catId));
  }
}
```

- [ ] **Step 5: Module**

Create `apps/api/src/modules/temu-proxy/temu-proxy.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TemuProxyController } from './temu-proxy.controller';
import { TemuProxyService } from './temu-proxy.service';

@Module({
  controllers: [TemuProxyController],
  providers: [TemuProxyService],
  exports: [TemuProxyService],
})
export class TemuProxyModule {}
```

Register in `app.module.ts` imports array: add `TemuProxyModule`.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm vitest run src/modules/temu-proxy/temu-proxy.service.test.ts
```
Expected: PASS.

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/temu-proxy \
        duoshou-erp/apps/api/src/app.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): Temu proxy module (category tree + category attrs)"
```

---

## Task 5: Temu proxy — image upload signed URL

**Files:**
- Modify: `apps/api/src/modules/temu-proxy/temu-proxy.service.ts` (add image upload helper)
- Modify: `apps/api/src/modules/temu-proxy/temu-proxy.controller.ts` (add POST /temu/images/upload)

The image upload endpoint `bg.goods.image.upload.global` accepts a base64-encoded image and returns a platform-hosted URL. For W1, we POST the raw image from the frontend; the backend converts to base64 and calls Temu.

- [ ] **Step 1: Extend service**

Edit `apps/api/src/modules/temu-proxy/temu-proxy.service.ts`:

Add method:
```typescript
  async uploadImage(shopId: string, imageBase64: string, filename?: string): Promise<{ url: string }> {
    const client = await this.clientFactory.forShop(shopId);
    const res: any = await client.call('bg.goods.image.upload.global', {
      imageBase64,
      fileName: filename,
    });
    const url = res?.url ?? res?.imageUrl ?? res?.fullUrl;
    if (!url) throw new Error(`Temu image upload returned no url: ${JSON.stringify(res)}`);
    return { url };
  }
```

- [ ] **Step 2: Extend controller (multipart upload)**

First install multer types:
```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm add -D @types/multer
pnpm add multer
```

Edit `apps/api/src/modules/temu-proxy/temu-proxy.controller.ts` — add at imports:
```typescript
import { Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
```

Install `@nestjs/platform-express` if missing:
```bash
pnpm --filter @duoshou/api add @nestjs/platform-express
```
(this may already be transitively installed — check `node_modules`; don't re-install if present)

Add method inside TemuProxyController:
```typescript
  @Post('images/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('shopId') shopId: string,
  ) {
    if (!shopId) throw new BadRequestException('shopId is required');
    if (!file) throw new BadRequestException('file is required');
    await this.assertShopBelongsToUser(req, shopId);
    const b64 = file.buffer.toString('base64');
    return this.proxy.uploadImage(shopId, b64, file.originalname);
  }
```

- [ ] **Step 3: Manual test (defer — will be exercised in frontend + E2E)**

No automated test here; it's a pure pass-through. Tests in Task 16 E2E will cover.

- [ ] **Step 4: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/temu-proxy \
        duoshou-erp/apps/api/package.json \
        duoshou-erp/pnpm-lock.yaml
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): Temu image upload proxy endpoint"
```

---

## Task 6: ProductTemplate CRUD — service + controller

**Files:**
- Create: `apps/api/src/modules/product/product-template.dto.ts`
- Create: `apps/api/src/modules/product/product-template.service.ts`
- Create: `apps/api/src/modules/product/product-template.controller.ts`
- Create: `apps/api/src/modules/product/product.module.ts`
- Create: `apps/api/src/modules/product/product-template.service.test.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: DTOs**

Create `apps/api/src/modules/product/product-template.dto.ts`:
```typescript
import { z } from 'zod';

export const OuterPackageSchema = z.object({
  lengthMm: z.number().positive(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  weightG: z.number().positive(),
});
export type OuterPackage = z.infer<typeof OuterPackageSchema>;

export const CreateProductTemplateDto = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  temuCategoryId: z.number().int().positive(),
  temuCategoryPath: z.array(z.string()).min(1),
  shopTypeTarget: z.enum(['full', 'semi']),
  mainImageUrl: z.string().url(),
  carouselImageUrls: z.array(z.string().url()).max(9).default([]),
  suggestedPriceCents: z.number().int().positive(),
  attributes: z.record(z.string(), z.string()).default({}),
  outerPackage: OuterPackageSchema,
});
export type CreateProductTemplateInput = z.infer<typeof CreateProductTemplateDto>;

export const UpdateProductTemplateDto = CreateProductTemplateDto.partial();
export type UpdateProductTemplateInput = z.infer<typeof UpdateProductTemplateDto>;
```

- [ ] **Step 2: Test**

Create `apps/api/src/modules/product/product-template.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductTemplateService } from './product-template.service';

describe('ProductTemplateService', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = {
      productTemplate: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tpl-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  it('create passes orgId through', async () => {
    const svc = new ProductTemplateService(prisma);
    const t = await svc.create('org-1', {
      name: 'Test Mug', description: 'Ceramic',
      temuCategoryId: 1234, temuCategoryPath: ['Home', 'Kitchen'],
      shopTypeTarget: 'full',
      mainImageUrl: 'https://example.com/a.jpg', carouselImageUrls: [],
      suggestedPriceCents: 1000,
      attributes: { Brand: 'Generic' },
      outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
    });
    expect(t.name).toBe('Test Mug');
    expect(prisma.productTemplate.create.mock.calls[0][0].data.orgId).toBe('org-1');
    expect(prisma.productTemplate.create.mock.calls[0][0].data.temuCategoryId).toBe(1234n);
  });

  it('findOne scopes by orgId', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', orgId: 'org-1' });
    const svc = new ProductTemplateService(prisma);
    const t = await svc.findOne('org-1', 'tpl-1');
    expect(t.id).toBe('tpl-1');
    expect(prisma.productTemplate.findFirst.mock.calls[0][0]).toEqual({
      where: { id: 'tpl-1', orgId: 'org-1' },
    });
  });

  it('findOne throws for cross-tenant access', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue(null);
    const svc = new ProductTemplateService(prisma);
    await expect(svc.findOne('org-1', 'other')).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 3: Confirm fail**

```bash
pnpm vitest run src/modules/product/product-template.service.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement service**

Create `apps/api/src/modules/product/product-template.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import type { CreateProductTemplateInput, UpdateProductTemplateInput } from './product-template.dto';

@Injectable()
export class ProductTemplateService {
  constructor(private prisma: PrismaService) {}

  create(orgId: string, input: CreateProductTemplateInput) {
    return (this.prisma as any).productTemplate.create({
      data: {
        orgId,
        name: input.name,
        description: input.description,
        temuCategoryId: BigInt(input.temuCategoryId),
        temuCategoryPath: input.temuCategoryPath,
        shopTypeTarget: input.shopTypeTarget,
        mainImageUrl: input.mainImageUrl,
        carouselImageUrls: input.carouselImageUrls,
        suggestedPriceCents: BigInt(input.suggestedPriceCents),
        attributes: input.attributes,
        outerPackage: input.outerPackage,
      },
    });
  }

  list(orgId: string) {
    return (this.prisma as any).productTemplate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const t = await (this.prisma as any).productTemplate.findFirst({ where: { id, orgId } });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return t;
  }

  async update(orgId: string, id: string, input: UpdateProductTemplateInput) {
    await this.findOne(orgId, id);  // scope check
    const data: any = { ...input };
    if (input.temuCategoryId !== undefined) data.temuCategoryId = BigInt(input.temuCategoryId);
    if (input.suggestedPriceCents !== undefined) data.suggestedPriceCents = BigInt(input.suggestedPriceCents);
    return (this.prisma as any).productTemplate.update({ where: { id }, data });
  }

  async delete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return (this.prisma as any).productTemplate.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Controller**

Create `apps/api/src/modules/product/product-template.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ZodValidationPipe } from '../../infra/zod-pipe';
import { ProductTemplateService } from './product-template.service';
import {
  CreateProductTemplateDto,
  UpdateProductTemplateDto,
  type CreateProductTemplateInput,
  type UpdateProductTemplateInput,
} from './product-template.dto';

@Controller('product-templates')
@UseGuards(AuthGuard)
export class ProductTemplateController {
  constructor(private svc: ProductTemplateService, private tenant: TenantService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateProductTemplateDto))
  async create(@Req() req: any, @Body() body: CreateProductTemplateInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.create(m.orgId, body);
  }

  @Get()
  async list(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.list(m.orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.findOne(m.orgId, id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateProductTemplateDto))
  async update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateProductTemplateInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.update(m.orgId, id, body);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.delete(m.orgId, id);
  }
}
```

- [ ] **Step 6: Module**

Create `apps/api/src/modules/product/product.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';

@Module({
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService],
  exports: [ProductTemplateService],
})
export class ProductModule {}
```

Register in `app.module.ts` imports.

- [ ] **Step 7: Run tests**

```bash
pnpm vitest run src/modules/product/product-template.service.test.ts
```
Expected: 3 PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product \
        duoshou-erp/apps/api/src/app.module.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): ProductTemplate CRUD with zod validation"
```

---

## Task 7: Payload builder — template → Temu goods.add request

This is the single highest-complexity unit in W1. Isolated so it can be unit-tested.

**Files:**
- Create: `apps/api/src/modules/product/publish/temu-goods-payload-builder.ts`
- Create: `apps/api/src/modules/product/publish/temu-goods-payload-builder.test.ts`

- [ ] **Step 1: Read Temu docs**

Read once: `docs/references/temu/199__开发者文档_调用流程_货品发布流程.md` — the "发品样例" section shows the exact JSON shape. For W1 non-apparel single SKU, the shape is roughly:

```json
{
  "productName": "...",
  "catId": 1234,
  "productPropertyReqs": [{ "propertyId": 0, "propertyName": "Brand", "valueUnit": "", "values": [{"value": "Generic"}] }],
  "productSpecPropertyReqs": [],
  "mainProductSkuSpecReqs": [{"parentSpecId":0,"parentSpecName":"","specId":0,"specName":""}],
  "productImageReqs": [{"imageUrl":"https://...","isPrimary":true}],
  "productDescription": "...",
  "productOuterPackageReq": { "length": 100, "width": 100, "height": 100, "weight": 300 },
  "productSkcReqs": [{
    "productImageReqs": [{"imageUrl":"https://...", "isPrimary": true}],
    "productSpecReqs": [],
    "productSkuReqs": [{
      "productSkuSpecReqs": [],
      "supplierPrice": "100",   // full only, in cents as string
      "productSkuStockQuantityReqs": [{"quantity": 0}]
    }]
  }],
  "productShipmentReq": {  // semi only
    "freightTemplateId": "...",
    "shipmentLimitSecond": 86400
  },
  "productSemiManagedReq": {  // semi only
    "bindSiteIds": [100],
    "semiManagedSiteMode": 2,
    "semiLanguageStrategy": 0
  }
}
```

- [ ] **Step 2: Write builder tests**

Create `apps/api/src/modules/product/publish/temu-goods-payload-builder.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildTemuGoodsAddPayload } from './temu-goods-payload-builder';

const baseTemplate = {
  id: 'tpl-1',
  orgId: 'org-1',
  name: 'Test Mug',
  description: 'A lovely ceramic mug',
  temuCategoryId: 1234n,
  temuCategoryPath: ['Home', 'Kitchen'],
  shopTypeTarget: 'full',
  mainImageUrl: 'https://example.com/main.jpg',
  carouselImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  suggestedPriceCents: 999n,
  attributes: { Brand: 'Generic', Material: 'Ceramic' },
  outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
} as any;

describe('buildTemuGoodsAddPayload', () => {
  it('builds full-managed payload with price in yuan (cents/100)', () => {
    const p = buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'cn' }, { priceCentsOverride: null });
    expect(p.productName).toBe('Test Mug');
    expect(p.catId).toBe(1234);
    expect(p.productImageReqs).toHaveLength(3);  // main + 2 carousel
    expect(p.productImageReqs[0]).toEqual({ imageUrl: 'https://example.com/main.jpg', isPrimary: true });
    expect(p.productSkcReqs).toHaveLength(1);
    expect(p.productSkcReqs[0].productSkuReqs).toHaveLength(1);
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBe('999');
    expect(p.productOuterPackageReq).toEqual({ length: 100, width: 100, height: 100, weight: 300 });
    expect(p.productPropertyReqs).toEqual(expect.arrayContaining([
      expect.objectContaining({ propertyName: 'Brand' }),
      expect.objectContaining({ propertyName: 'Material' }),
    ]));
    expect(p.productSemiManagedReq).toBeUndefined();
    expect(p.productShipmentReq).toBeUndefined();
  });

  it('applies per-shop price override', () => {
    const p = buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'cn' }, { priceCentsOverride: 1500 });
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBe('1500');
  });

  it('builds semi-managed payload with productSemiManagedReq + productShipmentReq', () => {
    const t = { ...baseTemplate, shopTypeTarget: 'semi' };
    const p = buildTemuGoodsAddPayload(t, { shopType: 'semi', region: 'pa', siteIds: [100], freightTemplateId: 'FT-1' }, { priceCentsOverride: null });
    expect(p.productSemiManagedReq).toBeDefined();
    expect(p.productSemiManagedReq.bindSiteIds).toEqual([100]);
    expect(p.productShipmentReq).toEqual({ freightTemplateId: 'FT-1', shipmentLimitSecond: 86400 });
    // Semi uses siteSupplierPrices instead of supplierPrice
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBeUndefined();
    expect(p.productSkcReqs[0].productSkuReqs[0].siteSupplierPrices).toEqual([
      { siteId: 100, supplierPrice: '999' },
    ]);
  });

  it('throws when semi shop is selected without siteIds/freightTemplateId', () => {
    const t = { ...baseTemplate, shopTypeTarget: 'semi' };
    expect(() =>
      buildTemuGoodsAddPayload(t, { shopType: 'semi', region: 'pa' } as any, { priceCentsOverride: null }),
    ).toThrow(/siteIds|freightTemplateId/i);
  });

  it('errors on shop-type mismatch (full template → semi shop)', () => {
    expect(() =>
      buildTemuGoodsAddPayload(baseTemplate, { shopType: 'semi', region: 'pa', siteIds: [100], freightTemplateId: 'FT' }, { priceCentsOverride: null }),
    ).toThrow(/mismatch|target/i);
  });
});
```

- [ ] **Step 3: Confirm fail**

```bash
pnpm vitest run src/modules/product/publish/temu-goods-payload-builder.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement builder**

Create `apps/api/src/modules/product/publish/temu-goods-payload-builder.ts`:
```typescript
export interface ShopContext {
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
  /** Required for semi */
  siteIds?: number[];
  freightTemplateId?: string;
}

export interface PublishOptions {
  priceCentsOverride: number | null;
}

export interface TemuGoodsAddPayload {
  productName: string;
  catId: number;
  productDescription?: string;
  productPropertyReqs: Array<{ propertyId: number; propertyName: string; valueUnit: string; values: Array<{ value: string }> }>;
  productSpecPropertyReqs: any[];
  mainProductSkuSpecReqs: Array<{ parentSpecId: number; parentSpecName: string; specId: number; specName: string }>;
  productImageReqs: Array<{ imageUrl: string; isPrimary: boolean }>;
  productOuterPackageReq: { length: number; width: number; height: number; weight: number };
  productSkcReqs: Array<{
    productImageReqs: Array<{ imageUrl: string; isPrimary: boolean }>;
    productSpecReqs: any[];
    productSkuReqs: Array<{
      productSkuSpecReqs: any[];
      supplierPrice?: string;
      siteSupplierPrices?: Array<{ siteId: number; supplierPrice: string }>;
      productSkuStockQuantityReqs: Array<{ quantity: number }>;
    }>;
  }>;
  productSemiManagedReq?: {
    bindSiteIds: number[];
    semiManagedSiteMode: number;
    semiLanguageStrategy: number;
  };
  productShipmentReq?: { freightTemplateId: string; shipmentLimitSecond: number };
}

export function buildTemuGoodsAddPayload(
  template: any,
  shop: ShopContext,
  opts: PublishOptions,
): TemuGoodsAddPayload {
  if (template.shopTypeTarget !== shop.shopType) {
    throw new Error(
      `Shop-type mismatch: template target is ${template.shopTypeTarget} but shop is ${shop.shopType}`,
    );
  }
  if (shop.shopType === 'semi' && (!shop.siteIds?.length || !shop.freightTemplateId)) {
    throw new Error('Semi-managed shops require siteIds and freightTemplateId');
  }

  const priceCents = Number(opts.priceCentsOverride ?? template.suggestedPriceCents);
  const priceStr = String(priceCents);  // Temu expects string representation of cents

  const images = [
    { imageUrl: template.mainImageUrl, isPrimary: true },
    ...(template.carouselImageUrls as string[]).map((u) => ({ imageUrl: u, isPrimary: false })),
  ];

  const productPropertyReqs = Object.entries(template.attributes as Record<string, string>).map(([k, v]) => ({
    propertyId: 0,
    propertyName: k,
    valueUnit: '',
    values: [{ value: String(v) }],
  }));

  const skuReq: any = {
    productSkuSpecReqs: [],
    productSkuStockQuantityReqs: [{ quantity: 0 }],
  };

  if (shop.shopType === 'full') {
    skuReq.supplierPrice = priceStr;
  } else {
    skuReq.siteSupplierPrices = (shop.siteIds ?? []).map((siteId) => ({
      siteId,
      supplierPrice: priceStr,
    }));
  }

  const pkg = template.outerPackage as { lengthMm: number; widthMm: number; heightMm: number; weightG: number };
  const payload: TemuGoodsAddPayload = {
    productName: template.name,
    catId: Number(template.temuCategoryId),
    productDescription: template.description ?? '',
    productPropertyReqs,
    productSpecPropertyReqs: [],
    mainProductSkuSpecReqs: [{ parentSpecId: 0, parentSpecName: '', specId: 0, specName: '' }],
    productImageReqs: images,
    productOuterPackageReq: {
      length: pkg.lengthMm,
      width: pkg.widthMm,
      height: pkg.heightMm,
      weight: pkg.weightG,
    },
    productSkcReqs: [{
      productImageReqs: images,
      productSpecReqs: [],
      productSkuReqs: [skuReq],
    }],
  };

  if (shop.shopType === 'semi') {
    payload.productSemiManagedReq = {
      bindSiteIds: shop.siteIds!,
      semiManagedSiteMode: 2,  // non-pan-Europe, choose specific sites
      semiLanguageStrategy: 0,
    };
    payload.productShipmentReq = {
      freightTemplateId: shop.freightTemplateId!,
      shipmentLimitSecond: 86400,  // 24h
    };
  }

  return payload;
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/modules/product/publish/temu-goods-payload-builder.test.ts
```
Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product/publish
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): Temu goods.add payload builder (full+semi, cents→string)"
```

---

## Task 8: Publish dispatcher — enqueue BullMQ jobs

**Files:**
- Create: `apps/api/src/modules/product/publish/publish-dispatcher.service.ts`
- Create: `apps/api/src/modules/product/publish/publish-dispatcher.service.test.ts`
- Modify: `apps/api/src/modules/product/product.module.ts` (register service + inject PUBLISH_QUEUE_TOKEN)

- [ ] **Step 1: Test**

Create `apps/api/src/modules/product/publish/publish-dispatcher.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishDispatcherService } from './publish-dispatcher.service';

describe('PublishDispatcherService.dispatch', () => {
  let prisma: any, queue: any;
  beforeEach(() => {
    prisma = {
      productTemplate: { findFirst: vi.fn() },
      shop: { findMany: vi.fn() },
      bulkJob: { create: vi.fn() },
      bulkJobItem: { createMany: vi.fn() },
      $transaction: vi.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    queue = { add: vi.fn(), addBulk: vi.fn() };
  });

  it('creates BulkJob + one BulkJobItem per shop, enqueues them', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1', orgId: 'org-1', shopTypeTarget: 'full',
    });
    prisma.shop.findMany.mockResolvedValue([
      { id: 'shop-1', orgId: 'org-1', shopType: 'full' },
      { id: 'shop-2', orgId: 'org-1', shopType: 'full' },
    ]);
    prisma.bulkJob.create.mockResolvedValue({ id: 'job-1' });
    prisma.bulkJobItem.createMany.mockResolvedValue({ count: 2 });

    const svc = new PublishDispatcherService(prisma, queue);
    const job = await svc.dispatch('org-1', 'tpl-1', ['shop-1', 'shop-2'], {});
    expect(job.id).toBe('job-1');
    expect(prisma.bulkJob.create).toHaveBeenCalled();
    expect(prisma.bulkJobItem.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(queue.addBulk).toHaveBeenCalled();
    const enqueued = queue.addBulk.mock.calls[0][0];
    expect(enqueued).toHaveLength(2);
    expect(enqueued[0].name).toBe('publish-item');
  });

  it('filters out shops whose shopType does not match template', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', orgId: 'org-1', shopTypeTarget: 'full' });
    prisma.shop.findMany.mockResolvedValue([
      { id: 'shop-1', orgId: 'org-1', shopType: 'full' },
      { id: 'shop-2', orgId: 'org-1', shopType: 'semi' },  // mismatch
    ]);
    prisma.bulkJob.create.mockResolvedValue({ id: 'job-1' });
    prisma.bulkJobItem.createMany.mockResolvedValue({ count: 1 });

    const svc = new PublishDispatcherService(prisma, queue);
    await svc.dispatch('org-1', 'tpl-1', ['shop-1', 'shop-2'], {});
    const enqueued = queue.addBulk.mock.calls[0][0];
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].data.shopId).toBe('shop-1');
  });

  it('throws if template does not belong to org', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue(null);
    const svc = new PublishDispatcherService(prisma, queue);
    await expect(svc.dispatch('org-1', 'bad', ['shop-1'], {})).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
pnpm vitest run src/modules/product/publish/publish-dispatcher.service.test.ts
```

- [ ] **Step 3: Implement**

Create `apps/api/src/modules/product/publish/publish-dispatcher.service.ts`:
```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../infra/prisma.service';
import { PUBLISH_QUEUE_TOKEN } from '../../../infra/queue.module';

export interface DispatchOptions {
  /** Map of shopId → price override in cents (optional). Shops not in map use suggestedPriceCents. */
  priceCentsOverrides?: Record<string, number>;
  /** Semi-managed site IDs per shop (required for semi shops). */
  semiSitesByShop?: Record<string, number[]>;
  /** Semi-managed freight template per shop. */
  freightTemplatesByShop?: Record<string, string>;
}

@Injectable()
export class PublishDispatcherService {
  constructor(
    private prisma: PrismaService,
    @Inject(PUBLISH_QUEUE_TOKEN) private queue: Queue,
  ) {}

  async dispatch(orgId: string, templateId: string, shopIds: string[], opts: DispatchOptions) {
    const template = await (this.prisma as any).productTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const shops = await (this.prisma as any).shop.findMany({
      where: { id: { in: shopIds }, orgId },
    });

    const matching = shops.filter((s: any) => s.shopType === template.shopTypeTarget);
    if (matching.length === 0) {
      throw new Error('No shops match the template shop-type target');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const job = await tx.bulkJob.create({
        data: {
          orgId,
          type: 'product_publish',
          templateId,
          total: matching.length,
          status: 'running',
          startedAt: new Date(),
        },
      });

      const items = matching.map((s: any) => ({
        jobId: job.id,
        shopId: s.id,
        idempotencyKey: crypto
          .createHash('sha256')
          .update(`${orgId}:${job.id}:${templateId}:${s.id}:product_publish`)
          .digest('hex'),
      }));
      await tx.bulkJobItem.createMany({ data: items });

      // Fetch back to get ids for queueing
      const persistedItems = await tx.bulkJobItem.findMany({ where: { jobId: job.id } });

      await this.queue.addBulk(
        persistedItems.map((it: any) => ({
          name: 'publish-item',
          data: {
            jobId: job.id,
            itemId: it.id,
            orgId,
            templateId,
            shopId: it.shopId,
            priceCentsOverride: opts.priceCentsOverrides?.[it.shopId] ?? null,
            semiSiteIds: opts.semiSitesByShop?.[it.shopId] ?? null,
            freightTemplateId: opts.freightTemplatesByShop?.[it.shopId] ?? null,
          },
          opts: { jobId: it.idempotencyKey },
        })),
      );

      return job;
    });
  }
}
```

Update `apps/api/src/modules/product/product.module.ts` to register:

```typescript
import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';

@Module({
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService, PublishDispatcherService],
  exports: [ProductTemplateService, PublishDispatcherService],
})
export class ProductModule {}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/modules/product/publish/publish-dispatcher.service.test.ts
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): PublishDispatcher enqueues per-shop BullMQ jobs"
```

---

## Task 9: Publish worker (BullMQ processor)

**Files:**
- Create: `apps/api/src/modules/product/publish/publish.processor.ts`
- Modify: `apps/api/src/modules/product/product.module.ts` (start worker)

BullMQ Worker is instantiated once at module init and lives for the process lifetime.

- [ ] **Step 1: Implement the processor**

Create `apps/api/src/modules/product/publish/publish.processor.ts`:
```typescript
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { makeRedisClient } from '../../../infra/redis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { buildTemuGoodsAddPayload } from './temu-goods-payload-builder';

@Injectable()
export class PublishProcessor implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(PublishProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  onModuleInit() {
    const concurrency = Number(process.env.PUBLISH_CONCURRENCY ?? 4);
    this.worker = new Worker(
      'product-publish',
      async (job: Job) => this.handle(job),
      {
        connection: makeRedisClient(),
        prefix: process.env.QUEUE_PREFIX ?? 'duoshou',
        concurrency,
      },
    );
    this.worker.on('completed', (j) => this.logger.log(`job ${j.id} completed`));
    this.worker.on('failed', (j, e) => this.logger.error(`job ${j?.id} failed: ${e.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(job: Job) {
    const { itemId, shopId, templateId, orgId, priceCentsOverride, semiSiteIds, freightTemplateId } = job.data;

    await (this.prisma as any).bulkJobItem.update({
      where: { id: itemId },
      data: { status: 'running' },
    });

    try {
      const template = await (this.prisma as any).productTemplate.findFirst({
        where: { id: templateId, orgId },
      });
      if (!template) throw new Error(`Template ${templateId} missing`);

      const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new Error(`Shop ${shopId} missing`);

      const payload = buildTemuGoodsAddPayload(
        template,
        {
          shopType: shop.shopType,
          region: shop.region,
          siteIds: semiSiteIds ?? undefined,
          freightTemplateId: freightTemplateId ?? undefined,
        },
        { priceCentsOverride },
      );

      const client = await this.clientFactory.forShop(shopId);
      const interfaceType = shop.region === 'pa' ? 'bg.glo.goods.add' : 'bg.goods.add';
      const res: any = await client.call(interfaceType, payload);

      const platformProductId = String(res?.productId ?? res?.spuId ?? '');
      if (!platformProductId) {
        throw new Error(`Temu ${interfaceType} returned no productId: ${JSON.stringify(res)}`);
      }

      // Persist new Product record
      const product = await (this.prisma as any).product.create({
        data: {
          orgId,
          shopId,
          templateId,
          platformProductId,
          title: template.name,
          status: res?.status ?? 'active',
          commonAttrs: template.attributes,
          platformSpecific: res,
        },
      });

      await this.prisma.$transaction([
        (this.prisma as any).bulkJobItem.update({
          where: { id: itemId },
          data: { status: 'succeeded', resultProductId: product.id },
        }),
        (this.prisma as any).bulkJob.update({
          where: { id: job.data.jobId },
          data: { succeeded: { increment: 1 } },
        }),
      ]);

      // Check for job completion
      await this.maybeFinishJob(job.data.jobId);
    } catch (err: any) {
      this.logger.error(`item ${itemId} failed: ${err.message}`);
      await this.prisma.$transaction([
        (this.prisma as any).bulkJobItem.update({
          where: { id: itemId },
          data: {
            status: 'failed',
            error: { message: err.message, stack: err.stack?.slice(0, 2000), errorCode: err.errorCode ?? null },
          },
        }),
        (this.prisma as any).bulkJob.update({
          where: { id: job.data.jobId },
          data: { failed: { increment: 1 } },
        }),
      ]);
      await this.maybeFinishJob(job.data.jobId);
      throw err;  // let BullMQ retry per default attempts=3
    }
  }

  private async maybeFinishJob(jobId: string) {
    const job = await (this.prisma as any).bulkJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (job.succeeded + job.failed >= job.total) {
      await (this.prisma as any).bulkJob.update({
        where: { id: jobId },
        data: {
          status: job.failed === 0 ? 'completed' : job.succeeded === 0 ? 'failed' : 'completed',
          completedAt: new Date(),
        },
      });
    }
  }
}
```

Update module:
```typescript
import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { PublishProcessor } from './publish/publish.processor';

@Module({
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService, PublishDispatcherService, PublishProcessor],
  exports: [ProductTemplateService, PublishDispatcherService],
})
export class ProductModule {}
```

- [ ] **Step 2: Manual smoke (deferred to Task 16)**

The worker-level behaviour is covered by the end-to-end smoke. Unit-testing BullMQ processors in isolation is expensive for limited value — the hot paths (payload builder + dispatcher) are already unit-tested.

- [ ] **Step 3: Verify compilation and startup**

Restart API:
```bash
# Watch-mode should auto-restart; just confirm log
tail -20 /tmp/duoshou-api.log
```
Look for `API listening on :3000` with no BullMQ errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): publish worker — template → bg.goods.add with progress tracking"
```

---

## Task 10: Bulk job endpoints (POST dispatch + GET status)

**Files:**
- Create: `apps/api/src/modules/product/bulk-job.dto.ts`
- Create: `apps/api/src/modules/product/bulk-job.service.ts`
- Create: `apps/api/src/modules/product/bulk-job.controller.ts`
- Modify: `apps/api/src/modules/product/product.module.ts`

- [ ] **Step 1: DTO**

Create `apps/api/src/modules/product/bulk-job.dto.ts`:
```typescript
import { z } from 'zod';

export const DispatchPublishDto = z.object({
  templateId: z.string().uuid(),
  shopIds: z.array(z.string().uuid()).min(1),
  priceCentsOverrides: z.record(z.string().uuid(), z.number().int().positive()).optional(),
  semiSitesByShop: z.record(z.string().uuid(), z.array(z.number().int().positive())).optional(),
  freightTemplatesByShop: z.record(z.string().uuid(), z.string().min(1)).optional(),
});
export type DispatchPublishInput = z.infer<typeof DispatchPublishDto>;
```

- [ ] **Step 2: Service**

Create `apps/api/src/modules/product/bulk-job.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

@Injectable()
export class BulkJobService {
  constructor(private prisma: PrismaService) {}

  async get(orgId: string, id: string) {
    const job = await (this.prisma as any).bulkJob.findFirst({
      where: { id, orgId },
      include: {
        items: {
          include: {
            shop: { select: { id: true, displayName: true, platformShopId: true, shopType: true } },
          },
        },
      },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  list(orgId: string, limit = 20) {
    return (this.prisma as any).bulkJob.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
```

- [ ] **Step 3: Controller**

Create `apps/api/src/modules/product/bulk-job.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ZodValidationPipe } from '../../infra/zod-pipe';
import { BulkJobService } from './bulk-job.service';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { DispatchPublishDto, type DispatchPublishInput } from './bulk-job.dto';

@Controller('bulk-jobs')
@UseGuards(AuthGuard)
export class BulkJobController {
  constructor(
    private jobs: BulkJobService,
    private dispatcher: PublishDispatcherService,
    private tenant: TenantService,
  ) {}

  @Post('publish')
  @UsePipes(new ZodValidationPipe(DispatchPublishDto))
  async dispatchPublish(@Req() req: any, @Body() body: DispatchPublishInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.dispatcher.dispatch(m.orgId, body.templateId, body.shopIds, {
      priceCentsOverrides: body.priceCentsOverrides,
      semiSitesByShop: body.semiSitesByShop,
      freightTemplatesByShop: body.freightTemplatesByShop,
    });
  }

  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.jobs.list(m.orgId, limit ? Number(limit) : 20);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.jobs.get(m.orgId, id);
  }
}
```

- [ ] **Step 4: Wire in module**

Update `apps/api/src/modules/product/product.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { PublishProcessor } from './publish/publish.processor';
import { BulkJobService } from './bulk-job.service';
import { BulkJobController } from './bulk-job.controller';

@Module({
  controllers: [ProductTemplateController, BulkJobController],
  providers: [ProductTemplateService, PublishDispatcherService, PublishProcessor, BulkJobService],
  exports: [ProductTemplateService, PublishDispatcherService],
})
export class ProductModule {}
```

- [ ] **Step 5: Smoke test (manual with curl)**

The E2E integration lands in Task 16. Verify compilation first:
```bash
tail -10 /tmp/duoshou-api.log
```
No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): BulkJob endpoints (POST /publish, GET /:id, GET /)"
```

---

## Task 11: Product sync service + cron

**Files:**
- Create: `apps/api/src/modules/product/sync/product-sync.service.ts`
- Create: `apps/api/src/modules/product/sync/product-sync.cron.ts`
- Modify: `apps/api/src/modules/product/product.module.ts`
- Modify: `apps/api/package.json` (add `@nestjs/schedule`)

- [ ] **Step 1: Install schedule**

```bash
cd /Users/mx4com/coding/duoshou-erp
pnpm --filter @duoshou/api add @nestjs/schedule
```

- [ ] **Step 2: Service**

Create `apps/api/src/modules/product/sync/product-sync.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';

@Injectable()
export class ProductSyncService {
  private logger = new Logger(ProductSyncService.name);
  constructor(private prisma: PrismaService, private clientFactory: TemuClientFactoryService) {}

  async syncShop(shopId: string) {
    const client = await this.clientFactory.forShop(shopId);
    const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
    const interfaceType = shop.region === 'pa' ? 'bg.glo.goods.list.get' : 'bg.goods.list.get';
    const res: any = await client.call(interfaceType, { pageNum: 1, pageSize: 50 });
    const list = res?.goodsList ?? res?.list ?? [];
    let touched = 0;
    for (const g of list) {
      const platformProductId = String(g.productId ?? g.spuId ?? '');
      if (!platformProductId) continue;
      await (this.prisma as any).product.upsert({
        where: { shopId_platformProductId: { shopId, platformProductId } },
        create: {
          orgId: shop.orgId,
          shopId,
          platform: 'temu',
          platformProductId,
          title: g.productName ?? g.title ?? '',
          status: g.productStatus ?? 'unknown',
          platformSpecific: g,
        },
        update: {
          title: g.productName ?? g.title ?? '',
          status: g.productStatus ?? 'unknown',
          platformSpecific: g,
          lastSyncedAt: new Date(),
        },
      });
      touched++;
    }
    this.logger.log(`synced ${touched} products for shop ${shopId}`);
    return touched;
  }

  async syncAllShopsForOrg(orgId: string) {
    const shops = await (this.prisma as any).shop.findMany({ where: { orgId, status: 'active' } });
    let total = 0;
    for (const s of shops) {
      try { total += await this.syncShop(s.id); } catch (e: any) {
        this.logger.error(`sync failed for shop ${s.id}: ${e.message}`);
      }
    }
    return total;
  }
}
```

- [ ] **Step 3: Cron**

Create `apps/api/src/modules/product/sync/product-sync.cron.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infra/prisma.service';
import { ProductSyncService } from './product-sync.service';

@Injectable()
export class ProductSyncCron {
  private logger = new Logger(ProductSyncCron.name);
  constructor(private prisma: PrismaService, private sync: ProductSyncService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllOrgs() {
    const orgs = await (this.prisma as any).organization.findMany({
      where: { status: 'active' },
    });
    for (const o of orgs) {
      try { await this.sync.syncAllShopsForOrg(o.id); } catch (e: any) {
        this.logger.error(`org ${o.id} sync failed: ${e.message}`);
      }
    }
  }
}
```

- [ ] **Step 4: Module wiring**

Update `apps/api/src/app.module.ts` to import schedule:
```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
// ... other imports
@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule, QueueModule, PlatformModule,
    AuthModule, TenantModule, HealthModule, ShopModule,
    TemuProxyModule, ProductModule,
  ],
})
export class AppModule {}
```

Update `apps/api/src/modules/product/product.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';
import { ProductTemplateController } from './product-template.controller';
import { PublishDispatcherService } from './publish/publish-dispatcher.service';
import { PublishProcessor } from './publish/publish.processor';
import { BulkJobService } from './bulk-job.service';
import { BulkJobController } from './bulk-job.controller';
import { ProductSyncService } from './sync/product-sync.service';
import { ProductSyncCron } from './sync/product-sync.cron';

@Module({
  controllers: [ProductTemplateController, BulkJobController],
  providers: [
    ProductTemplateService, PublishDispatcherService, PublishProcessor,
    BulkJobService, ProductSyncService, ProductSyncCron,
  ],
  exports: [ProductTemplateService, PublishDispatcherService, ProductSyncService],
})
export class ProductModule {}
```

- [ ] **Step 5: Verify compilation + commit**

```bash
tail -20 /tmp/duoshou-api.log
```
Expected: API restarts cleanly. Look for "Cron" or "Nest scheduler" init messages.

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product/sync \
        duoshou-erp/apps/api/src/modules/product/product.module.ts \
        duoshou-erp/apps/api/src/app.module.ts \
        duoshou-erp/apps/api/package.json \
        duoshou-erp/pnpm-lock.yaml
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): product sync service + 30-min cron"
```

---

## Task 12: Products list endpoint

**Files:**
- Create: `apps/api/src/modules/product/product.controller.ts`
- Create: `apps/api/src/modules/product/product.service.ts`
- Modify: `apps/api/src/modules/product/product.module.ts`

- [ ] **Step 1: Service**

Create `apps/api/src/modules/product/product.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

export interface ProductListFilter {
  shopId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async list(orgId: string, filter: ProductListFilter = {}) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, filter.pageSize ?? 20);
    const where: any = { orgId };
    if (filter.shopId) where.shopId = filter.shopId;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.title = { contains: filter.search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      (this.prisma as any).product.count({ where }),
      (this.prisma as any).product.findMany({
        where,
        include: {
          shop: { select: { id: true, displayName: true, platformShopId: true, shopType: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }
}
```

- [ ] **Step 2: Controller**

Create `apps/api/src/modules/product/product.controller.ts`:
```typescript
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ProductService } from './product.service';

@Controller('products')
@UseGuards(AuthGuard)
export class ProductController {
  constructor(private svc: ProductService, private tenant: TenantService) {}

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
      shopId, status, search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
```

- [ ] **Step 3: Wire + commit**

Update `product.module.ts`:
```typescript
controllers: [ProductTemplateController, BulkJobController, ProductController],
providers: [..., ProductService],
```

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/product
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(w1): GET /api/products (paginated, filterable)"
```

---

## Task 13: Frontend — API client + stores

**Files:**
- Create: `apps/web/src/api-client/http.ts`
- Create: `apps/web/src/api-client/templates.api.ts`
- Create: `apps/web/src/api-client/temu-proxy.api.ts`
- Create: `apps/web/src/api-client/bulk-jobs.api.ts`
- Create: `apps/web/src/api-client/products.api.ts`
- Create: `apps/web/src/api-client/shops.api.ts`
- Create: `apps/web/src/stores/templates.ts`
- Create: `apps/web/src/stores/shops.ts`
- Create: `apps/web/src/stores/bulk-jobs.ts`

- [ ] **Step 1: http.ts wrapper**

Create `apps/web/src/api-client/http.ts`:
```typescript
import { useAuthStore } from '@/stores/auth';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface HttpOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

export async function http<T = unknown>(path: string, opts: HttpOptions = {}): Promise<T> {
  const { query, headers, ...rest } = opts;
  const auth = useAuthStore();

  let url = BASE + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const s = params.toString();
    if (s) url += '?' + s;
  }

  const resp = await fetch(url, {
    ...rest,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...auth.authHeader(),
      ...headers,
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 500)}`);
  }
  return (await resp.json()) as T;
}
```

- [ ] **Step 2: templates.api.ts**

Create `apps/web/src/api-client/templates.api.ts`:
```typescript
import { http } from './http';

export interface ProductTemplate {
  id: string;
  name: string;
  description?: string;
  temuCategoryId: string;  // BigInt serialized
  temuCategoryPath: string[];
  shopTypeTarget: 'full' | 'semi';
  mainImageUrl: string;
  carouselImageUrls: string[];
  suggestedPriceCents: string;
  attributes: Record<string, string>;
  outerPackage: { lengthMm: number; widthMm: number; heightMm: number; weightG: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  temuCategoryId: number;
  temuCategoryPath: string[];
  shopTypeTarget: 'full' | 'semi';
  mainImageUrl: string;
  carouselImageUrls: string[];
  suggestedPriceCents: number;
  attributes: Record<string, string>;
  outerPackage: { lengthMm: number; widthMm: number; heightMm: number; weightG: number };
}

export const templatesApi = {
  list: () => http<ProductTemplate[]>('/product-templates'),
  get: (id: string) => http<ProductTemplate>('/product-templates/' + id),
  create: (input: CreateTemplateInput) =>
    http<ProductTemplate>('/product-templates', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<CreateTemplateInput>) =>
    http<ProductTemplate>('/product-templates/' + id, { method: 'PATCH', body: JSON.stringify(input) }),
  delete: (id: string) =>
    http<void>('/product-templates/' + id, { method: 'DELETE' }),
};
```

- [ ] **Step 3: temu-proxy.api.ts**

Create `apps/web/src/api-client/temu-proxy.api.ts`:
```typescript
import { http } from './http';

export interface TemuCategory { catId: number; catName: string; isLeaf: boolean }

export const temuProxyApi = {
  categories: (shopId: string, parentCatId = 0) =>
    http<TemuCategory[]>('/temu/categories', { query: { shopId, parentCatId } }),
  categoryAttrs: (shopId: string, catId: number) =>
    http<any>('/temu/category-attrs', { query: { shopId, catId } }),
  uploadImage: async (shopId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('shopId', shopId);
    return http<{ url: string }>('/temu/images/upload', {
      method: 'POST',
      body: form as any,
      headers: {},  // let browser set multipart boundary
    });
  },
};
```

- [ ] **Step 4: bulk-jobs.api.ts + products.api.ts + shops.api.ts**

`apps/web/src/api-client/bulk-jobs.api.ts`:
```typescript
import { http } from './http';

export interface BulkJobItem {
  id: string;
  shopId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  resultProductId: string | null;
  error: any;
  shop: { id: string; displayName: string | null; platformShopId: string; shopType: string };
}

export interface BulkJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  succeeded: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items?: BulkJobItem[];
}

export interface DispatchPublishInput {
  templateId: string;
  shopIds: string[];
  priceCentsOverrides?: Record<string, number>;
  semiSitesByShop?: Record<string, number[]>;
  freightTemplatesByShop?: Record<string, string>;
}

export const bulkJobsApi = {
  dispatchPublish: (input: DispatchPublishInput) =>
    http<BulkJob>('/bulk-jobs/publish', { method: 'POST', body: JSON.stringify(input) }),
  list: () => http<BulkJob[]>('/bulk-jobs'),
  get: (id: string) => http<BulkJob>('/bulk-jobs/' + id),
};
```

`apps/web/src/api-client/products.api.ts`:
```typescript
import { http } from './http';

export interface Product {
  id: string;
  shopId: string;
  platformProductId: string;
  title: string;
  status: string;
  lastSyncedAt: string;
  shop: { id: string; displayName: string | null; platformShopId: string; shopType: string };
}

export const productsApi = {
  list: (q: { shopId?: string; status?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: Product[] }>('/products', { query: q as any }),
};
```

`apps/web/src/api-client/shops.api.ts`:
```typescript
import { http } from './http';

export interface Shop {
  id: string;
  platform: string;
  platformShopId: string;
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
  displayName: string | null;
  status: string;
  connectedAt: string;
}

export const shopsApi = {
  list: () => http<Shop[]>('/shops'),
  connect: (input: {
    appKey: string; appSecret: string; accessToken: string;
    platformShopId: string; shopType: 'full' | 'semi'; region: 'cn' | 'pa'; displayName?: string;
  }) => http<Shop>('/shops', { method: 'POST', body: JSON.stringify(input) }),
};
```

- [ ] **Step 5: Stores**

Create `apps/web/src/stores/shops.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { shopsApi, type Shop } from '@/api-client/shops.api';

export const useShopsStore = defineStore('shops', () => {
  const items = ref<Shop[]>([]);
  const loading = ref(false);
  async function fetch() {
    loading.value = true;
    try { items.value = await shopsApi.list(); }
    finally { loading.value = false; }
  }
  return { items, loading, fetch };
});
```

Create `apps/web/src/stores/templates.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { templatesApi, type ProductTemplate, type CreateTemplateInput } from '@/api-client/templates.api';

export const useTemplatesStore = defineStore('templates', () => {
  const items = ref<ProductTemplate[]>([]);
  const loading = ref(false);
  async function fetchAll() {
    loading.value = true;
    try { items.value = await templatesApi.list(); }
    finally { loading.value = false; }
  }
  async function create(input: CreateTemplateInput) {
    const t = await templatesApi.create(input);
    items.value.unshift(t);
    return t;
  }
  return { items, loading, fetchAll, create };
});
```

Create `apps/web/src/stores/bulk-jobs.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { bulkJobsApi, type BulkJob } from '@/api-client/bulk-jobs.api';

export const useBulkJobsStore = defineStore('bulk-jobs', () => {
  const current = ref<BulkJob | null>(null);
  async function fetch(id: string) {
    current.value = await bulkJobsApi.get(id);
    return current.value;
  }
  return { current, fetch };
});
```

- [ ] **Step 6: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/api-client duoshou-erp/apps/web/src/stores
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w1): API client + Pinia stores for templates/shops/products/jobs"
```

---

## Task 14: CategoryPicker component

**Files:**
- Create: `apps/web/src/components/CategoryPicker.vue`

- [ ] **Step 1: Implement picker**

```vue
<template>
  <n-card title="选择 Temu 类目">
    <n-breadcrumb>
      <n-breadcrumb-item v-for="(p, i) in path" :key="i" @click="goBack(i)">
        {{ p }}
      </n-breadcrumb-item>
    </n-breadcrumb>
    <n-list bordered hoverable clickable>
      <n-list-item v-for="c in children" :key="c.catId" @click="pick(c)">
        <n-thing>
          <template #header>{{ c.catName }}</template>
          <template #description>
            <n-tag v-if="c.isLeaf" type="success" size="small">叶子类目</n-tag>
            <n-tag v-else size="small">继续展开 →</n-tag>
          </template>
        </n-thing>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { NCard, NList, NListItem, NThing, NTag, NBreadcrumb, NBreadcrumbItem } from 'naive-ui';
import { temuProxyApi, type TemuCategory } from '@/api-client/temu-proxy.api';

const props = defineProps<{ shopId: string }>();
const emit = defineEmits<{ (e: 'select', payload: { catId: number; path: string[] }): void }>();

const path = ref<string[]>([]);
const idStack = ref<number[]>([0]);
const children = ref<TemuCategory[]>([]);

async function load() {
  if (!props.shopId) return;
  const parent = idStack.value[idStack.value.length - 1];
  children.value = await temuProxyApi.categories(props.shopId, parent);
}

async function pick(c: TemuCategory) {
  if (c.isLeaf) {
    emit('select', { catId: c.catId, path: [...path.value, c.catName] });
    return;
  }
  path.value.push(c.catName);
  idStack.value.push(c.catId);
  await load();
}

function goBack(index: number) {
  path.value = path.value.slice(0, index);
  idStack.value = idStack.value.slice(0, index + 1);
  load();
}

watch(() => props.shopId, load, { immediate: true });
</script>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/components/CategoryPicker.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w1): CategoryPicker component (breadcrumb + tree navigation)"
```

---

## Task 15: Template editor page + routes

**Files:**
- Create: `apps/web/src/pages/products/TemplateListPage.vue`
- Create: `apps/web/src/pages/products/TemplateEditorPage.vue`
- Create: `apps/web/src/pages/products/ProductListPage.vue`
- Create: `apps/web/src/pages/bulk-jobs/BulkJobProgressPage.vue`
- Create: `apps/web/src/components/ImageUpload.vue`
- Create: `apps/web/src/components/ShopMultiselect.vue`
- Modify: `apps/web/src/router/index.ts` (add routes)

- [ ] **Step 1: ImageUpload component**

Create `apps/web/src/components/ImageUpload.vue`:
```vue
<template>
  <n-upload
    :max="max"
    :show-file-list="false"
    :custom-request="handleUpload"
    accept="image/*"
  >
    <n-button :loading="busy">{{ busy ? '上传中' : '选图片' }}</n-button>
  </n-upload>
  <div v-if="modelValue.length" class="thumbs">
    <img v-for="(u, i) in modelValue" :key="u" :src="u" :class="i === 0 ? 'thumb primary' : 'thumb'" @click="remove(i)" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NUpload, NButton, useMessage } from 'naive-ui';
import { temuProxyApi } from '@/api-client/temu-proxy.api';

const props = defineProps<{ modelValue: string[]; shopId: string; max?: number }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();
const busy = ref(false);
const msg = useMessage();

async function handleUpload(opts: any) {
  busy.value = true;
  try {
    const { url } = await temuProxyApi.uploadImage(props.shopId, opts.file.file);
    emit('update:modelValue', [...props.modelValue, url]);
    opts.onFinish();
  } catch (e: any) {
    msg.error(e.message);
    opts.onError();
  } finally {
    busy.value = false;
  }
}

function remove(i: number) {
  const next = [...props.modelValue];
  next.splice(i, 1);
  emit('update:modelValue', next);
}
</script>

<style scoped>
.thumbs { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.thumb { width: 80px; height: 80px; object-fit: cover; border: 1px solid #ddd; cursor: pointer; }
.thumb.primary { border-color: #18a058; border-width: 2px; }
</style>
```

- [ ] **Step 2: ShopMultiselect component**

Create `apps/web/src/components/ShopMultiselect.vue`:
```vue
<template>
  <n-select
    v-model:value="selected"
    multiple
    :options="options"
    placeholder="选择店铺"
    :loading="shops.loading"
    @update:value="(v) => emit('update:modelValue', v)"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { NSelect } from 'naive-ui';
import { useShopsStore } from '@/stores/shops';

const props = defineProps<{ modelValue: string[]; filterShopType?: 'full' | 'semi' }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const shops = useShopsStore();
const selected = ref<string[]>(props.modelValue);

onMounted(async () => {
  if (shops.items.length === 0) await shops.fetch();
});

watch(() => props.modelValue, (v) => { selected.value = v; });

const options = computed(() => {
  let list = shops.items;
  if (props.filterShopType) list = list.filter((s) => s.shopType === props.filterShopType);
  return list.map((s) => ({
    label: `${s.displayName ?? s.platformShopId} (${s.shopType})`,
    value: s.id,
  }));
});
</script>
```

- [ ] **Step 3: TemplateListPage**

Create `apps/web/src/pages/products/TemplateListPage.vue`:
```vue
<template>
  <n-card title="货品模板">
    <template #header-extra>
      <n-button type="primary" @click="router.push('/templates/new')">+ 新建模板</n-button>
    </template>
    <n-data-table
      :columns="columns"
      :data="tpl.items"
      :loading="tpl.loading"
      :row-key="(r: any) => r.id"
    />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NButton, NDataTable, NSpace } from 'naive-ui';
import { useTemplatesStore } from '@/stores/templates';
import type { ProductTemplate } from '@/api-client/templates.api';

const router = useRouter();
const tpl = useTemplatesStore();

onMounted(() => tpl.fetchAll());

const columns = [
  { title: '名称', key: 'name' },
  { title: '目标店铺类型', key: 'shopTypeTarget' },
  { title: '建议售价', key: 'suggestedPriceCents', render: (r: ProductTemplate) => '¥ ' + (Number(r.suggestedPriceCents) / 100).toFixed(2) },
  { title: '类目', key: 'temuCategoryPath', render: (r: ProductTemplate) => r.temuCategoryPath.join(' / ') },
  { title: '操作', key: 'actions', render: (r: ProductTemplate) => h(NSpace, {}, () => [
      h(NButton, { size: 'small', onClick: () => router.push(`/templates/${r.id}`) }, () => '编辑/发布'),
    ]),
  },
];
</script>
```

- [ ] **Step 4: TemplateEditorPage** (create + edit)

Create `apps/web/src/pages/products/TemplateEditorPage.vue`:
```vue
<template>
  <n-card :title="isEdit ? '编辑模板' : '新建模板'">
    <n-form label-placement="top">
      <n-form-item label="名称">
        <n-input v-model:value="form.name" />
      </n-form-item>
      <n-form-item label="描述">
        <n-input v-model:value="form.description" type="textarea" />
      </n-form-item>

      <n-form-item label="目标店铺类型">
        <n-radio-group v-model:value="form.shopTypeTarget">
          <n-radio value="full">全托管</n-radio>
          <n-radio value="semi">半托管</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="参考店铺（用于加载类目）">
        <n-select v-model:value="referenceShopId" :options="shopOptions" placeholder="先选一个店铺以加载其 Temu 类目树" />
      </n-form-item>

      <n-form-item v-if="referenceShopId" label="Temu 类目">
        <n-space vertical style="width: 100%;">
          <div v-if="form.temuCategoryId">
            已选：{{ form.temuCategoryPath.join(' / ') }} ({{ form.temuCategoryId }})
            <n-button size="tiny" @click="form.temuCategoryId = 0; form.temuCategoryPath = []">换一个</n-button>
          </div>
          <category-picker v-else :shop-id="referenceShopId" @select="onCategoryPick" />
        </n-space>
      </n-form-item>

      <n-form-item label="主图">
        <image-upload v-model="mainImageWrap" :shop-id="referenceShopId" :max="1" />
      </n-form-item>
      <n-form-item label="轮播图 (最多 9)">
        <image-upload v-model="form.carouselImageUrls" :shop-id="referenceShopId" :max="9" />
      </n-form-item>

      <n-form-item label="建议售价 (元)">
        <n-input-number v-model:value="priceYuan" :min="0.01" :step="0.01" />
        <span style="margin-left: 8px; color: #999">= {{ Math.round(priceYuan * 100) }} 分</span>
      </n-form-item>

      <n-form-item label="包装尺寸 (毫米) / 重量 (克)">
        <n-space>
          <n-input-number v-model:value="form.outerPackage.lengthMm" :min="1" placeholder="长" />
          <n-input-number v-model:value="form.outerPackage.widthMm" :min="1" placeholder="宽" />
          <n-input-number v-model:value="form.outerPackage.heightMm" :min="1" placeholder="高" />
          <n-input-number v-model:value="form.outerPackage.weightG" :min="1" placeholder="重量" />
        </n-space>
      </n-form-item>

      <n-form-item label="属性 (key: value)">
        <n-dynamic-input v-model:value="attrsList" :on-create="() => ({ k: '', v: '' })">
          <template #default="{ value }">
            <n-input v-model:value="value.k" placeholder="属性名" />
            <n-input v-model:value="value.v" placeholder="属性值" style="margin-left: 8px;" />
          </template>
        </n-dynamic-input>
      </n-form-item>

      <n-space>
        <n-button type="primary" :loading="saving" @click="save">{{ isEdit ? '保存' : '创建' }}</n-button>
        <n-button v-if="isEdit && savedId" @click="openPublish">发布到多店铺</n-button>
        <n-button @click="$router.back()">返回</n-button>
      </n-space>
    </n-form>

    <!-- Publish dialog -->
    <n-modal v-model:show="publishOpen" preset="card" title="发布到多店铺" style="width: 600px;">
      <n-form label-placement="top">
        <n-form-item label="选择店铺">
          <shop-multiselect v-model="publishShopIds" :filter-shop-type="form.shopTypeTarget" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button type="primary" :loading="publishing" @click="doPublish">发起发布</n-button>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NRadioGroup, NRadio, NSpace, NButton, NModal, NDynamicInput } from 'naive-ui';
import CategoryPicker from '@/components/CategoryPicker.vue';
import ImageUpload from '@/components/ImageUpload.vue';
import ShopMultiselect from '@/components/ShopMultiselect.vue';
import { useShopsStore } from '@/stores/shops';
import { templatesApi, type CreateTemplateInput } from '@/api-client/templates.api';
import { bulkJobsApi } from '@/api-client/bulk-jobs.api';

const route = useRoute();
const router = useRouter();
const msg = useMessage();

const isEdit = computed(() => route.params.id && route.params.id !== 'new');
const savedId = ref<string | null>(isEdit.value ? String(route.params.id) : null);

const form = ref<CreateTemplateInput>({
  name: '',
  description: '',
  temuCategoryId: 0,
  temuCategoryPath: [],
  shopTypeTarget: 'full',
  mainImageUrl: '',
  carouselImageUrls: [],
  suggestedPriceCents: 100,
  attributes: {},
  outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 200 },
});
const referenceShopId = ref<string>('');
const priceYuan = ref(1.0);
const attrsList = ref<Array<{ k: string; v: string }>>([]);

const shops = useShopsStore();
const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: `${s.displayName ?? s.platformShopId} (${s.shopType})`, value: s.id })),
);

const mainImageWrap = computed({
  get: () => (form.value.mainImageUrl ? [form.value.mainImageUrl] : []),
  set: (v: string[]) => { form.value.mainImageUrl = v[0] ?? ''; },
});

onMounted(async () => {
  await shops.fetch();
  if (isEdit.value) {
    const t = await templatesApi.get(String(route.params.id));
    form.value = {
      name: t.name,
      description: t.description,
      temuCategoryId: Number(t.temuCategoryId),
      temuCategoryPath: t.temuCategoryPath,
      shopTypeTarget: t.shopTypeTarget,
      mainImageUrl: t.mainImageUrl,
      carouselImageUrls: t.carouselImageUrls,
      suggestedPriceCents: Number(t.suggestedPriceCents),
      attributes: t.attributes,
      outerPackage: t.outerPackage,
    };
    priceYuan.value = Number(t.suggestedPriceCents) / 100;
    attrsList.value = Object.entries(t.attributes).map(([k, v]) => ({ k, v: String(v) }));
  }
});

watch(priceYuan, (v) => { form.value.suggestedPriceCents = Math.round(v * 100); });
watch(attrsList, (list) => {
  form.value.attributes = Object.fromEntries(list.filter((x) => x.k).map((x) => [x.k, x.v]));
}, { deep: true });

function onCategoryPick(e: { catId: number; path: string[] }) {
  form.value.temuCategoryId = e.catId;
  form.value.temuCategoryPath = e.path;
}

const saving = ref(false);
async function save() {
  if (!form.value.mainImageUrl) { msg.error('请上传主图'); return; }
  if (!form.value.temuCategoryId) { msg.error('请选择 Temu 类目'); return; }
  saving.value = true;
  try {
    let res;
    if (savedId.value) {
      res = await templatesApi.update(savedId.value, form.value);
      msg.success('已保存');
    } else {
      res = await templatesApi.create(form.value);
      savedId.value = res.id;
      msg.success('已创建');
      router.replace(`/templates/${res.id}`);
    }
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    saving.value = false;
  }
}

const publishOpen = ref(false);
const publishShopIds = ref<string[]>([]);
const publishing = ref(false);
function openPublish() { publishOpen.value = true; }

async function doPublish() {
  if (publishShopIds.value.length === 0) { msg.error('请选择至少 1 家店铺'); return; }
  publishing.value = true;
  try {
    const job = await bulkJobsApi.dispatchPublish({
      templateId: savedId.value!,
      shopIds: publishShopIds.value,
    });
    msg.success('发布任务已创建');
    publishOpen.value = false;
    router.push(`/bulk-jobs/${job.id}`);
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    publishing.value = false;
  }
}
</script>
```

- [ ] **Step 5: BulkJobProgressPage**

Create `apps/web/src/pages/bulk-jobs/BulkJobProgressPage.vue`:
```vue
<template>
  <n-card title="发布任务进度" v-if="job">
    <n-descriptions :column="3">
      <n-descriptions-item label="状态">
        <n-tag :type="statusType">{{ job.status }}</n-tag>
      </n-descriptions-item>
      <n-descriptions-item label="总数">{{ job.total }}</n-descriptions-item>
      <n-descriptions-item label="成功">{{ job.succeeded }}</n-descriptions-item>
      <n-descriptions-item label="失败">{{ job.failed }}</n-descriptions-item>
      <n-descriptions-item label="开始">{{ job.startedAt }}</n-descriptions-item>
      <n-descriptions-item label="结束">{{ job.completedAt ?? '进行中' }}</n-descriptions-item>
    </n-descriptions>
    <n-progress :percentage="percent" style="margin-top: 16px;" />

    <n-h3 style="margin-top: 24px;">明细</n-h3>
    <n-data-table :columns="columns" :data="job.items ?? []" :row-key="(r: any) => r.id" />
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, h } from 'vue';
import { useRoute } from 'vue-router';
import { NCard, NDescriptions, NDescriptionsItem, NTag, NProgress, NH3, NDataTable, NSpin } from 'naive-ui';
import { bulkJobsApi, type BulkJob, type BulkJobItem } from '@/api-client/bulk-jobs.api';

const route = useRoute();
const job = ref<BulkJob | null>(null);
let timer: any = null;

async function poll() {
  try {
    job.value = await bulkJobsApi.get(String(route.params.id));
    if (job.value.status === 'completed' || job.value.status === 'failed') {
      clearInterval(timer);
    }
  } catch {}
}

onMounted(() => {
  poll();
  timer = setInterval(poll, 3000);
});
onUnmounted(() => clearInterval(timer));

const percent = computed(() => {
  if (!job.value || !job.value.total) return 0;
  return Math.round(((job.value.succeeded + job.value.failed) / job.value.total) * 100);
});
const statusType = computed(() => {
  if (!job.value) return 'default';
  if (job.value.status === 'completed') return 'success';
  if (job.value.status === 'failed') return 'error';
  if (job.value.status === 'running') return 'info';
  return 'default';
});

const columns = [
  { title: '店铺', key: 'shop', render: (r: BulkJobItem) => r.shop?.displayName ?? r.shop?.platformShopId },
  { title: '状态', key: 'status', render: (r: BulkJobItem) => h(NTag, {
      type: r.status === 'succeeded' ? 'success' : r.status === 'failed' ? 'error' : 'info',
    }, () => r.status),
  },
  { title: '错误', key: 'error', render: (r: BulkJobItem) => r.error ? r.error.message : '—' },
];
</script>
```

- [ ] **Step 6: ProductListPage**

Create `apps/web/src/pages/products/ProductListPage.vue`:
```vue
<template>
  <n-card title="我的商品（跨店）">
    <n-space style="margin-bottom: 12px;">
      <n-input v-model:value="search" placeholder="按标题搜索" @keyup.enter="load(1)" clearable @update:value="() => load(1)" />
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="按店铺筛选" clearable style="min-width: 200px;" @update:value="() => load(1)" />
    </n-space>
    <n-data-table :columns="columns" :data="rows.items" :loading="loading" :row-key="(r: any) => r.id" />
    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { NCard, NDataTable, NInput, NSelect, NSpace, NPagination } from 'naive-ui';
import { productsApi } from '@/api-client/products.api';
import { useShopsStore } from '@/stores/shops';

const shops = useShopsStore();
const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);
const search = ref('');
const shopId = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
const rows = ref<{ total: number; page: number; pageSize: number; items: any[] }>({ total: 0, page: 1, pageSize, items: [] });
const loading = ref(false);

async function load(p = page.value) {
  loading.value = true;
  try {
    rows.value = await productsApi.list({
      page: p, pageSize,
      search: search.value || undefined,
      shopId: shopId.value ?? undefined,
    });
    page.value = p;
  } finally { loading.value = false; }
}
const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.total / rows.value.pageSize)));

onMounted(async () => { await shops.fetch(); load(1); });

const columns = [
  { title: '标题', key: 'title' },
  { title: '店铺', key: 'shop', render: (r: any) => r.shop?.displayName ?? r.shop?.platformShopId },
  { title: '平台 ID', key: 'platformProductId' },
  { title: '状态', key: 'status' },
  { title: '最后同步', key: 'lastSyncedAt' },
];
</script>
```

- [ ] **Step 7: Router**

Update `apps/web/src/router/index.ts`:
```typescript
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import TemplateListPage from '@/pages/products/TemplateListPage.vue';
import TemplateEditorPage from '@/pages/products/TemplateEditorPage.vue';
import ProductListPage from '@/pages/products/ProductListPage.vue';
import BulkJobProgressPage from '@/pages/bulk-jobs/BulkJobProgressPage.vue';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage, meta: { requiresAuth: true } },
  { path: '/login', component: LoginPage },
  { path: '/products', component: ProductListPage, meta: { requiresAuth: true } },
  { path: '/templates', component: TemplateListPage, meta: { requiresAuth: true } },
  { path: '/templates/new', component: TemplateEditorPage, meta: { requiresAuth: true } },
  { path: '/templates/:id', component: TemplateEditorPage, meta: { requiresAuth: true } },
  { path: '/bulk-jobs/:id', component: BulkJobProgressPage, meta: { requiresAuth: true } },
];

const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  try { await auth.init(); } catch { /* env missing — ignore */ }
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';
});
export default router;
```

- [ ] **Step 8: Add nav on HomePage (so users can reach new pages)**

Edit `apps/web/src/pages/HomePage.vue` and replace its content with:
```vue
<template>
  <n-card title="舵手 ERP" style="max-width: 600px; margin: 60px auto;">
    <n-h2>快速入口</n-h2>
    <n-space vertical>
      <n-button @click="$router.push('/templates')">货品模板</n-button>
      <n-button @click="$router.push('/products')">我的商品</n-button>
      <n-button @click="auth.logout()">退出登录</n-button>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NH2, NButton, NSpace } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
</script>
```

- [ ] **Step 9: Build test**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build
```
Expected: Vite build succeeds. If `vue-tsc` reports type errors in generated code, fix by relaxing explicit types where Vue compiler's inference is strict.

- [ ] **Step 10: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages duoshou-erp/apps/web/src/components duoshou-erp/apps/web/src/router/index.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(w1): template editor + product list + bulk job progress pages"
```

---

## Task 16: W1 end-to-end smoke test

**Files:**
- Create: `apps/api/scripts/smoke-w1.mjs`

This validates the full publish path: create template → dispatch to 1 shop → poll job → verify product row.

- [ ] **Step 1: Write smoke script**

Create `apps/api/scripts/smoke-w1.mjs`:
```javascript
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API = 'http://localhost:3000/api';

const email = `smoke-w1-${Date.now()}@duoshou.test`;
const password = 'SmokeW1!2026';

console.log('=== W1 end-to-end smoke ===');
console.log('email:', email);

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

// 1. Register + login
console.log('\n[1/7] register + login');
const { data: created, error: e1 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (e1) throw e1;
const anon = createClient(SUPABASE_URL, ANON);
const { data: login, error: e2 } = await anon.auth.signInWithPassword({ email, password });
if (e2) throw e2;
const token = login.session.access_token;

const authFetch = (path, init = {}) => fetch(API + path, {
  ...init,
  headers: { Authorization: `Bearer ${token}`, ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
});

// 2. Connect Temu test shop
console.log('\n[2/7] connect Temu test shop');
const connectResp = await authFetch('/shops', {
  method: 'POST',
  body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full', region: 'cn', displayName: 'smoke-w1',
  }),
});
if (connectResp.status !== 201) {
  console.error('shop connect failed:', await connectResp.text());
  process.exit(1);
}
const shop = await connectResp.json();
console.log('  shop id:', shop.id, 'platform id:', shop.platformShopId);

// 3. List categories (get the first leaf via dfs)
console.log('\n[3/7] traverse categories to find a leaf');
async function findLeaf(parent = 0, path = []) {
  const list = await (await authFetch(`/temu/categories?shopId=${shop.id}&parentCatId=${parent}`)).json();
  if (!Array.isArray(list) || list.length === 0) return null;
  const leaf = list.find(c => c.isLeaf);
  if (leaf) return { ...leaf, path: [...path, leaf.catName] };
  // go deeper into first
  const first = list[0];
  return findLeaf(first.catId, [...path, first.catName]);
}
const leaf = await findLeaf();
if (!leaf) throw new Error('no leaf category found');
console.log('  leaf catId:', leaf.catId, 'path:', leaf.path.join(' / '));

// 4. Create template
console.log('\n[4/7] create template');
const tplResp = await authFetch('/product-templates', {
  method: 'POST',
  body: JSON.stringify({
    name: `Smoke Product ${Date.now()}`,
    description: 'W1 smoke test product — please delete',
    temuCategoryId: leaf.catId,
    temuCategoryPath: leaf.path,
    shopTypeTarget: 'full',
    mainImageUrl: 'https://via.placeholder.com/800x800.png',
    carouselImageUrls: [],
    suggestedPriceCents: 999,
    attributes: { Brand: 'Test' },
    outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
  }),
});
if (tplResp.status !== 201 && tplResp.status !== 200) {
  console.error('template create failed:', await tplResp.text());
  process.exit(1);
}
const template = await tplResp.json();
console.log('  template id:', template.id);

// 5. Dispatch publish
console.log('\n[5/7] dispatch publish');
const dispResp = await authFetch('/bulk-jobs/publish', {
  method: 'POST',
  body: JSON.stringify({ templateId: template.id, shopIds: [shop.id] }),
});
if (dispResp.status !== 201 && dispResp.status !== 200) {
  console.error('dispatch failed:', await dispResp.text());
  process.exit(1);
}
const job = await dispResp.json();
console.log('  job id:', job.id);

// 6. Poll until done
console.log('\n[6/7] poll job');
let final;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const j = await (await authFetch('/bulk-jobs/' + job.id)).json();
  process.stdout.write(`  tick ${i}: ${j.status} ok=${j.succeeded} fail=${j.failed}\n`);
  if (j.status === 'completed' || j.status === 'failed') { final = j; break; }
}
if (!final) throw new Error('job did not settle within 2 min');
console.log('  final status:', final.status);
if (final.items?.length) {
  final.items.forEach((it) => {
    console.log(`    - shop=${it.shop?.platformShopId} status=${it.status}`, it.error ? it.error.message : '');
  });
}

// 7. Cleanup
console.log('\n[7/7] cleanup');
await admin.auth.admin.deleteUser(created.user.id);

if (final.status !== 'completed') {
  console.log('\n❌ W1 smoke FAILED — job did not complete cleanly');
  process.exit(1);
}
console.log('\n✅ W1 smoke PASSED');
```

- [ ] **Step 2: Run smoke**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
node scripts/smoke-w1.mjs
```

Expected: all 7 steps pass; at least 1 product gets created in the Temu test shop (visible in the seller center).

If any step fails, inspect the output and fix the specific layer (payload builder usually — Temu validates strictly). Temu may reject because:
- Required attribute missing: check `bg.goods.attrs.get` response for that category and add to template.attributes
- Image URL not hosted by Temu: upload via `/temu/images/upload` first and use the returned URL
- Category not a leaf: picker enforces `isLeaf` but the smoke's automated find may pick a mid-level
- Outer package too small: some categories have minimums

- [ ] **Step 3: Commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/scripts/smoke-w1.mjs
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "test(w1): end-to-end smoke (template → dispatch → poll → verify)"
git tag w1-complete
```

---

## Done — what's next

After W1 smoke passes:
- The core differentiator (cross-shop publish) is live.
- Browser flow can be manually exercised: login → /templates/new → pick category → upload image → fill fields → save → publish → watch progress.
- W2a (price/review workstation) and W2b (activity calendar) can begin in parallel.

Known gaps that will be addressed in W1.5 / W2:
- No ability to edit already-published products (requires `bg.goods.edit.*` group)
- Apparel flow (variants by color/size) requires sizecharts and SKC matrix handling
- No video upload (deferred)
- Semi-managed multi-site price override UI (currently same price across all bound sites)
- No per-shop attribute override (all shops use template's attributes — may fail if shop's catId differs)
- RLS policies in Supabase not yet configured (backend bypass via service_role key)

Specifically, the per-shop attribute override is the most likely friction point — when publishing to multiple shops whose region dictates different category attribute templates, a single template's attribute map may fail validation on some. This is acceptable for MVP because Temu's 半托管-CN vs 全托管-CN categories largely overlap; PA-region shops will need their own templates.
