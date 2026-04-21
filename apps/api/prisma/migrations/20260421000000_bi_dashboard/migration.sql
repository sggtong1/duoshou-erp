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
