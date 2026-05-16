CREATE TABLE "agent_task" (
    "id"                  TEXT NOT NULL,
    "org_id"              TEXT NOT NULL,
    "shop_id"             TEXT,
    "created_by"          TEXT,
    "kind"                TEXT NOT NULL,
    "payload"             JSONB NOT NULL DEFAULT '{}',
    "status"              TEXT NOT NULL DEFAULT 'pending',
    "plugin_instance_id"  TEXT,
    "result"              JSONB,
    "error_code"          TEXT,
    "error_message"       TEXT,
    "attempts"            INTEGER NOT NULL DEFAULT 0,
    "max_attempts"        INTEGER NOT NULL DEFAULT 3,
    "priority"            INTEGER NOT NULL DEFAULT 0,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at"          TIMESTAMP(3),
    "started_at"          TIMESTAMP(3),
    "completed_at"        TIMESTAMP(3),
    "expires_at"          TIMESTAMP(3),
    CONSTRAINT "agent_task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_task_org_status_idx"
  ON "agent_task" ("org_id", "status", "priority" DESC, "created_at");

CREATE INDEX "agent_task_org_shop_idx"
  ON "agent_task" ("org_id", "shop_id", "created_at" DESC);

CREATE INDEX "agent_task_status_expires_idx"
  ON "agent_task" ("status", "expires_at");
