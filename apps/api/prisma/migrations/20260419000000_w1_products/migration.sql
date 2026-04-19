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
