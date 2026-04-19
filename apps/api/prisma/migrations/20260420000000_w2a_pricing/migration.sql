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

ALTER TABLE "price_review" ADD CONSTRAINT "price_review_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_review" ADD CONSTRAINT "price_review_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_adjustment_order" ADD CONSTRAINT "price_adjustment_order_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_adjustment_order" ADD CONSTRAINT "price_adjustment_order_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sku_price_history" ADD CONSTRAINT "sku_price_history_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
