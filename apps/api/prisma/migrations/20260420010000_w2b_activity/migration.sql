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
