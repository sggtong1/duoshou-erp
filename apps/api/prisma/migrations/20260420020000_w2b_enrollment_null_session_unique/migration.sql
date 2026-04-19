-- Partial unique index:Postgres NULL 不等于 NULL,所以原 @@unique([shopId, activityId, sessionId, platformSkuId])
-- 对 session_id IS NULL 的行无法强制唯一。补一个 partial unique index 作为数据库层保护,与
-- enrollment-sync.service 的应用层 findFirst-then-update/create 形成双保险。

CREATE UNIQUE INDEX "activity_enrollment_shop_activity_sku_null_session_key"
    ON "activity_enrollment" ("shop_id", "activity_id", "platform_sku_id")
    WHERE "session_id" IS NULL;
