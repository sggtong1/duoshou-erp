# Mini-Postgres 数据库切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 duoshou-erp 的 26 张 Prisma 表 + Redis + Auth 从 Supabase/Upstash 切到 mac mini 本地的 mini-postgres + mini-redis + `DEV_AUTH_BYPASS=1`,保留 Supabase 项目作为可一行 env 切回的回滚兜底。

**Architecture:** 单次切换窗口 (30-60 min):新建 `duoshou` 库 → prisma migrate deploy → pg_dump --data-only Supabase → 灌入 mini → 改 `.env` 切 DATABASE_URL/REDIS_URL → 简化 `auth.guard.ts` → 前端 `.env` 触发已有的 demo session 分支 → 重启 NestJS → curl + browser 验证 → 改 `sync_bi.py` DEST_DATABASE_URL → 重启 cron。回滚靠 `.env` 里的 `DATABASE_URL_SUPABASE_BACKUP` / `REDIS_URL_UPSTASH_BACKUP`。

**Tech Stack:** NestJS 10 + Prisma 7 + PostgreSQL 16 (docker mini-postgres) + Redis 7 (docker mini-redis) + Vue 3/Vite + pnpm 9 + vitest 1。Spec: `docs/superpowers/specs/2026-05-16-mini-pg-migration-design.md`。

---

## File Structure

**修改 (committed)**:
- `apps/api/src/modules/auth/auth.guard.ts` — 简化,去掉 supabase-js 调用
- `apps/api/src/modules/auth/auth.guard.test.ts` — 替换 supabase 相关 case 为 DEV_AUTH_BYPASS 覆盖
- `apps/api/scripts/seed-dev-user.mjs` — 重写改 pg 直连(不再用 @supabase/supabase-js)
- `apps/api/scripts/smoke-bi-dashboard-real.mjs` — 删除(用 seed-dev-user 取代,且不再有 Supabase Auth)
- `README.md` — Quick start 改为 mini-postgres 部分

**修改 (NOT committed; gitignored)**:
- `apps/api/.env.development` — DATABASE_URL/REDIS_URL 主备调换
- `apps/web/.env.development` — VITE_SUPABASE_URL 清空触发 demo

**外部仓库手动改 (不在本 plan 自动化)**:
- `~/mini-services/sync/sync_bi.py` — DEST_DATABASE_URL 切到 mini.duoshou

---

## Task 1: 摸底 + 抓 Supabase 基线行数

**Files:** none committed; 输出落到 `/tmp/`。

- [ ] **Step 1.1: 确认两个 docker 容器在跑**

```bash
docker ps --filter name=mini-postgres --format "{{.Names}}: {{.Status}}"
docker ps --filter name=mini-redis --format "{{.Names}}: {{.Status}}"
```

Expected: 两行 `Up xxx`。任一缺失,先 `docker start <name>`。

- [ ] **Step 1.2: 确认 mini-postgres 可访问 admin 角色**

```bash
docker exec mini-postgres psql -U admin -d postgres -c "SELECT current_user, version();"
```

Expected: `current_user = admin`,PG 16 版本字串。

- [ ] **Step 1.3: 确认 mini-postgres 上还没有 `duoshou` 库**

```bash
docker exec mini-postgres psql -U admin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='duoshou';"
```

Expected: 输出为空(无 `1`)。**若已存在,STOP** 并跟用户确认是清空还是另起库名。

- [ ] **Step 1.4: 用 Prisma schema 当下连 Supabase 拉 26 张表的基线行数,写到 `/tmp/baseline-supabase-counts.txt`**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
# 从当前 .env.development 拿 DATABASE_URL (此时仍指向 Supabase)
source <(grep -E '^DATABASE_URL=' .env.development | sed 's/^/export /')
pnpm exec node --input-type=module -e '
import pg from "pg";
const tables = [
  "user","organization","member","shop","shop_credentials","org_settings",
  "product_template","product","sku",
  "bulk_job","bulk_job_item",
  "price_review","price_adjustment_order","sku_price_history",
  "activity","activity_session","activity_enrollment",
  "shop_sku_snapshot",
  "bi_sync_log","bi_org_daily","bi_shop_daily","bi_platform_daily",
  "bi_region_daily","bi_sku_daily","bi_sku_snapshot",
  "agent_task",
];
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
for (const t of tables) {
  const r = await c.query(`SELECT count(*)::int AS n FROM "${t}"`);
  console.log(`${t}\t${r.rows[0].n}`);
}
await c.end();
' > /tmp/baseline-supabase-counts.txt 2>&1
cat /tmp/baseline-supabase-counts.txt
wc -l /tmp/baseline-supabase-counts.txt
```

Expected: `wc -l` 输出 `26`;每行格式 `<table>\t<count>`。任一表名拼错 / 不存在会报错,需修正表名再跑。

- [ ] **Step 1.5: 没什么要 commit,但记录基线时间戳**

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ" > /tmp/baseline-supabase-timestamp.txt
cat /tmp/baseline-supabase-timestamp.txt
```

---

## Task 2: 简化 auth.guard.ts (TDD)

Auth 切换的代码改动可以**先于** DB 切换做,因为 `DEV_AUTH_BYPASS=1` 已经在 `.env` 里,简化前后都能跑。这里先 commit 简化代码,DB 切完后稳定状态就有了。

**Files:**
- Modify: `apps/api/src/modules/auth/auth.guard.ts`
- Modify: `apps/api/src/modules/auth/auth.guard.test.ts`

- [ ] **Step 2.1: 替换测试文件内容**

完整覆写 `apps/api/src/modules/auth/auth.guard.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const makeCtx = (headers: any) => {
    const req: any = { headers };
    return {
      ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any,
      req,
    };
  };

  const originalBypass = process.env.DEV_AUTH_BYPASS;
  beforeEach(() => {
    delete process.env.DEV_AUTH_BYPASS;
  });
  afterEach(() => {
    if (originalBypass === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = originalBypass;
  });

  it('rejects missing bearer', async () => {
    const guard = new AuthGuard();
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(/bearer/i);
  });

  it('rejects wrong auth scheme', async () => {
    const guard = new AuthGuard();
    const { ctx } = makeCtx({ authorization: 'Basic xxx' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/bearer/i);
  });

  it('rejects when DEV_AUTH_BYPASS not set even with Bearer demo', async () => {
    const guard = new AuthGuard();
    const { ctx } = makeCtx({ authorization: 'Bearer demo' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/not configured/i);
  });

  it('accepts Bearer demo when DEV_AUTH_BYPASS=1', async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const guard = new AuthGuard();
    const { ctx, req } = makeCtx({ authorization: 'Bearer demo' });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.user).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'dev@local',
    });
  });

  it('accepts Bearer dev when DEV_AUTH_BYPASS=1', async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const guard = new AuthGuard();
    const { ctx, req } = makeCtx({ authorization: 'Bearer dev' });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.user.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('rejects non-demo/dev tokens even when DEV_AUTH_BYPASS=1', async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const guard = new AuthGuard();
    const { ctx } = makeCtx({ authorization: 'Bearer some-random-jwt' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/not configured/i);
  });
});
```

- [ ] **Step 2.2: 跑测试看预期失败**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
pnpm exec vitest run src/modules/auth/auth.guard.test.ts 2>&1 | tail -30
```

Expected: 至少 2 个新加的 case (`rejects when DEV_AUTH_BYPASS not set` / `rejects non-demo/dev tokens`) **失败**——因为当前 guard 在 token 不匹配 demo/dev 时会去调 Supabase,不会 throw "not configured"。其他 case (`rejects missing bearer` / `rejects wrong auth scheme` / `accepts Bearer demo`) 可能仍 pass。这就是 RED 阶段。

- [ ] **Step 2.3: 用简化版替换 auth.guard.ts**

完整覆写 `apps/api/src/modules/auth/auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

// Stable UUID for the local dev user when DEV_AUTH_BYPASS=1.
// tenant.resolveForUser() auto-creates the org+member on first call,
// so this just needs to stay constant across restarts.
const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_USER_EMAIL = 'dev@local';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = auth.slice(7);

    if (process.env.DEV_AUTH_BYPASS === '1' && (token === 'demo' || token === 'dev')) {
      req.user = { id: DEV_USER_ID, email: DEV_USER_EMAIL };
      return true;
    }

    // Supabase Auth removed during mini-postgres cutover 2026-05-16.
    // Future real-user auth (JWT verification etc.) plugs in here.
    throw new UnauthorizedException('Auth not configured');
  }
}
```

- [ ] **Step 2.4: 跑测试看全 PASS**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
pnpm exec vitest run src/modules/auth/auth.guard.test.ts 2>&1 | tail -20
```

Expected: `Test Files 1 passed`,6 个测试全 pass。

- [ ] **Step 2.5: typecheck 整个 api 看没引入新错**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -cE "error TS"
```

Expected: 错误数 ≤ baseline (之前 baseline 是 12, 现在 auth.guard 简化后只会减不会增)。若 > 12,STOP 排查。

- [ ] **Step 2.6: commit**

```bash
cd /Users/yyjr/coding
git -C /Users/yyjr/coding add \
  duoshou-erp/apps/api/src/modules/auth/auth.guard.ts \
  duoshou-erp/apps/api/src/modules/auth/auth.guard.test.ts
git -C /Users/yyjr/coding commit -m "$(cat <<'EOF'
refactor(auth): simplify AuthGuard for mini-postgres cutover

Drop the Supabase Auth fallback path. AuthGuard now only accepts
"Bearer demo" / "Bearer dev" when DEV_AUTH_BYPASS=1 is set; everything
else throws UnauthorizedException("Auth not configured"). This is the
last reference to @supabase/supabase-js in the backend runtime
(the dep stays in package.json so future real-user auth can plug in).

Tests rewritten to cover all four branches of the new guard:
- missing bearer / wrong scheme   -> 401 "Missing bearer token"
- DEV_AUTH_BYPASS unset + Bearer demo -> 401 "Auth not configured"
- DEV_AUTH_BYPASS=1 + Bearer demo|dev -> ok, user = dev@local UUID
- DEV_AUTH_BYPASS=1 + Bearer random   -> 401 "Auth not configured"

Spec: docs/superpowers/specs/2026-05-16-mini-pg-migration-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 在 mini-postgres 上建 duoshou 库并跑 Prisma migrate

不切 NestJS 当前连接,只在 mini-postgres 上准备好 schema 等灌数据。

**Files:** none committed; DB 副作用。

- [ ] **Step 3.1: CREATE DATABASE duoshou**

```bash
docker exec mini-postgres psql -U admin -d postgres \
  -c "CREATE DATABASE duoshou OWNER admin"
```

Expected: 输出 `CREATE DATABASE`。

- [ ] **Step 3.2: 验证库已建,目前 0 张表**

```bash
docker exec mini-postgres psql -U admin -d duoshou \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
```

Expected: `0`。

- [ ] **Step 3.3: 拿到 mini-postgres 的 admin 密码 (从 docker inspect)**

```bash
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
echo "PG_PWD length: ${#PG_PWD}"
[ -n "$PG_PWD" ] && echo "OK" || echo "EMPTY"
```

Expected: `OK`,length 大约 40+。

- [ ] **Step 3.4: 跑 Prisma migrate deploy 到 duoshou 库**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
DATABASE_URL="postgresql://admin:${PG_PWD}@127.0.0.1:5432/duoshou" \
  pnpm exec prisma migrate deploy 2>&1 | tail -20
```

Expected: 看到 `7 migrations found ... applied`(对应 7 个 migration 目录)。结尾 `All migrations have been successfully applied.`。

- [ ] **Step 3.5: 验证表数量**

```bash
docker exec mini-postgres psql -U admin -d duoshou \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
docker exec mini-postgres psql -U admin -d duoshou -c "\dt" | head -40
```

Expected: count = 27 (26 Prisma model + Prisma 自己的 `_prisma_migrations` 表)。`\dt` 输出能看到 `user / organization / member / shop / activity / bi_org_daily / agent_task` 等关键表名。

- [ ] **Step 3.6: 验证表都是空的**

```bash
docker exec mini-postgres psql -U admin -d duoshou -c "
  SELECT 'organization' AS t, count(*) FROM organization
  UNION ALL SELECT 'member', count(*) FROM member
  UNION ALL SELECT 'activity', count(*) FROM activity
  UNION ALL SELECT 'bi_org_daily', count(*) FROM bi_org_daily
  UNION ALL SELECT 'agent_task', count(*) FROM agent_task;"
```

Expected: 5 行全 0。

---

## Task 4: pg_dump Supabase 数据 + 灌入 duoshou

**Files:** none committed; 产生 `/tmp/supabase-data.sql`。

- [ ] **Step 4.1: 用当前 .env 的 Supabase DATABASE_URL 做 data-only dump**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
source <(grep -E '^DATABASE_URL=' .env.development | sed 's/^/export /')
pg_dump "$DATABASE_URL" \
  --schema=public \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --disable-triggers \
  -f /tmp/supabase-data.sql 2>&1 | tail -20
ls -lh /tmp/supabase-data.sql
```

Expected: dump 不报错,文件大小预计 几 MB ~ 几十 MB(取决于 bi_* 历史数据量)。如果 `pg_dump: command not found` → `brew install postgresql@16` 装 pg_dump CLI。

Note: `--disable-triggers` 让导入时跳过外键检查的语句插入,避免外键依赖顺序错。

- [ ] **Step 4.2: 看 dump 文件头确认目标是 INSERT 语法**

```bash
head -50 /tmp/supabase-data.sql
grep -c "^INSERT INTO " /tmp/supabase-data.sql
grep -c "^COPY " /tmp/supabase-data.sql
```

Expected: 大量 `INSERT INTO` 行,基本没有 `COPY` 行(`--column-inserts` 的效果)。

- [ ] **Step 4.3: 灌入 duoshou 库**

```bash
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
PGPASSWORD="$PG_PWD" psql \
  -h 127.0.0.1 -p 5432 -U admin -d duoshou \
  -v ON_ERROR_STOP=1 \
  -f /tmp/supabase-data.sql 2>&1 | tail -30
echo "exit: $?"
```

Expected: 末尾 `exit: 0`。如果中间报外键冲突,`ON_ERROR_STOP=1` 会让 psql 在第一个错处停。常见原因 = 外键依赖顺序;解决: `--disable-triggers` 应已规避;若仍报错,STOP 排查具体表。

- [ ] **Step 4.4: 拉 mini.duoshou 的行数,跟 Supabase 基线对比**

```bash
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
PGPASSWORD="$PG_PWD" psql -h 127.0.0.1 -p 5432 -U admin -d duoshou -tA -c "
  SELECT 'user' AS t, count(*)::text FROM \"user\"
  UNION ALL SELECT 'organization', count(*)::text FROM organization
  UNION ALL SELECT 'member', count(*)::text FROM member
  UNION ALL SELECT 'shop', count(*)::text FROM shop
  UNION ALL SELECT 'shop_credentials', count(*)::text FROM shop_credentials
  UNION ALL SELECT 'org_settings', count(*)::text FROM org_settings
  UNION ALL SELECT 'product_template', count(*)::text FROM product_template
  UNION ALL SELECT 'product', count(*)::text FROM product
  UNION ALL SELECT 'sku', count(*)::text FROM sku
  UNION ALL SELECT 'bulk_job', count(*)::text FROM bulk_job
  UNION ALL SELECT 'bulk_job_item', count(*)::text FROM bulk_job_item
  UNION ALL SELECT 'price_review', count(*)::text FROM price_review
  UNION ALL SELECT 'price_adjustment_order', count(*)::text FROM price_adjustment_order
  UNION ALL SELECT 'sku_price_history', count(*)::text FROM sku_price_history
  UNION ALL SELECT 'activity', count(*)::text FROM activity
  UNION ALL SELECT 'activity_session', count(*)::text FROM activity_session
  UNION ALL SELECT 'activity_enrollment', count(*)::text FROM activity_enrollment
  UNION ALL SELECT 'shop_sku_snapshot', count(*)::text FROM shop_sku_snapshot
  UNION ALL SELECT 'bi_sync_log', count(*)::text FROM bi_sync_log
  UNION ALL SELECT 'bi_org_daily', count(*)::text FROM bi_org_daily
  UNION ALL SELECT 'bi_shop_daily', count(*)::text FROM bi_shop_daily
  UNION ALL SELECT 'bi_platform_daily', count(*)::text FROM bi_platform_daily
  UNION ALL SELECT 'bi_region_daily', count(*)::text FROM bi_region_daily
  UNION ALL SELECT 'bi_sku_daily', count(*)::text FROM bi_sku_daily
  UNION ALL SELECT 'bi_sku_snapshot', count(*)::text FROM bi_sku_snapshot
  UNION ALL SELECT 'agent_task', count(*)::text FROM agent_task
" > /tmp/mini-duoshou-counts.txt
diff /tmp/baseline-supabase-counts.txt /tmp/mini-duoshou-counts.txt
echo "diff exit: $?"
```

Expected: `diff exit: 0`(两个文件逐行相同)。若有差异,**STOP** 排查;通常是 column-inserts 导入失败的某张表。

---

## Task 5: 切 NestJS 的 .env (DATABASE_URL + REDIS_URL + Auth 备份)

`.env.development` gitignored,改动不上 git。这是切换的关键 atomic 操作:NestJS 一旦读到新 env,所有请求都会走 mini。

**Files:**
- Modify: `apps/api/.env.development` (gitignored)

- [ ] **Step 5.1: 备份当前 .env.development**

```bash
cp /Users/yyjr/coding/duoshou-erp/apps/api/.env.development \
   /tmp/api-env-pre-cutover-$(date +%Y%m%dT%H%M%S).bak
ls -lh /tmp/api-env-pre-cutover-*.bak | tail -1
```

Expected: 备份文件存在。

- [ ] **Step 5.2: 停掉当前 NestJS 后台进程**

如果 NestJS 当前在跑(`pnpm dev:api` 在某 tmux/terminal),先停掉。

```bash
# 找进程
ps -ef | grep -E "nest start --watch|node dist/main" | grep -v grep
# kill 对应 PID(替换 <PID>)
# kill <PID>
# 验证 :4000 已无人监听
lsof -i :4000 -sTCP:LISTEN 2>&1 | head -3
```

Expected: 最后一句没有进程在 :4000 上监听。

- [ ] **Step 5.3: 改写 .env.development(只动 DATABASE_URL / REDIS_URL / 加 BACKUP 变量)**

读取当前文件,然后用脚本改:

```bash
ENV=/Users/yyjr/coding/duoshou-erp/apps/api/.env.development
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)

# 通用函数:为 $1 这个 env key 创建 ${1}_$2 = 同样的值(若不存在),用 awk index 避免长度计算错
add_backup() {
  local key="$1" suffix="$2"
  local backup_key="${key}_${suffix}"
  grep -q "^${backup_key}=" "$ENV" && return 0
  awk -v k="^${key}=" -v bk="${backup_key}=" '
    $0 ~ k { eq = index($0, "="); print bk substr($0, eq+1); next }
    { print }
  ' "$ENV" > "$ENV.new" && mv "$ENV.new" "$ENV"
}

# 1) 备份原值到 _BACKUP 系列
add_backup DATABASE_URL SUPABASE_BACKUP
add_backup REDIS_URL UPSTASH_BACKUP
add_backup SUPABASE_URL BACKUP
add_backup SUPABASE_ANON_KEY BACKUP
add_backup SUPABASE_SERVICE_ROLE_KEY BACKUP

# 2) 重写 DATABASE_URL / REDIS_URL 主线指向 mini
sed -i.tmp -E "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://admin:${PG_PWD}@127.0.0.1:5432/duoshou|" "$ENV"
sed -i.tmp -E "s|^REDIS_URL=.*|REDIS_URL=redis://127.0.0.1:6379|" "$ENV"
rm -f "$ENV.tmp"

# 3) 看一眼结果(屏蔽密码段)
grep -E '^(DATABASE_URL|REDIS_URL|DATABASE_URL_SUPABASE_BACKUP|REDIS_URL_UPSTASH_BACKUP|SUPABASE_URL_BACKUP|DEV_AUTH_BYPASS)' "$ENV" | sed 's|:[^@]*@|:****@|'
```

Expected: 输出至少 6 行,DATABASE_URL 已是 `postgresql://admin:****@127.0.0.1:5432/duoshou`,REDIS_URL 是 `redis://127.0.0.1:6379`,3 个 `_BACKUP` 变量保留原 Supabase/Upstash URL,DEV_AUTH_BYPASS=1。

- [ ] **Step 5.4: 启动 NestJS 在后台**

```bash
cd /Users/yyjr/coding/duoshou-erp
nohup pnpm dev:api > /tmp/api-mini-startup.log 2>&1 &
echo "pid: $!"
sleep 25
tail -30 /tmp/api-mini-startup.log
```

Expected: 日志里看到 `Nest application successfully started` + `API listening on :4000`,**没有** Supabase 相关 error / warn。如果有 `SUPABASE_URL must be set` → 还有别的代码引用 supabase-js,STOP 排查。

- [ ] **Step 5.5: 验证 mini DB 接通 + Bearer demo 通**

```bash
curl -s -o /dev/null -w "/api/health -> %{http_code}\n" http://127.0.0.1:4000/api/health
curl -s -H "Authorization: Bearer demo" -o /tmp/api-after-mini.json \
  -w "/api/activities -> %{http_code}\n" \
  "http://127.0.0.1:4000/api/activities?page=1&pageSize=3"
head -c 400 /tmp/api-after-mini.json; echo
```

Expected: 两个 200。`/tmp/api-after-mini.json` 里 `total > 0`,跟切换前看到的 Supabase 的活动数据**条数相同**。

---

## Task 6: 切前端 .env 触发 demo session

`apps/web/src/stores/auth.ts` 里已有 `isDemoMode = !supabaseUrl || !supabaseKey || supabaseUrl.includes('xxx.supabase.co')` 检测——env 里 URL 一空,自动走 DEMO_SESSION,**前端代码不动**。

**Files:**
- Modify: `apps/web/.env.development` (gitignored)

- [ ] **Step 6.1: 备份当前前端 .env**

```bash
cp /Users/yyjr/coding/duoshou-erp/apps/web/.env.development \
   /tmp/web-env-pre-cutover-$(date +%Y%m%dT%H%M%S).bak
```

- [ ] **Step 6.2: 改写 web .env.development**

```bash
ENV=/Users/yyjr/coding/duoshou-erp/apps/web/.env.development

# 复用同样的 add_backup 思路,通过 index 取值
add_backup() {
  local key="$1" suffix="$2"
  local backup_key="${key}_${suffix}"
  grep -q "^${backup_key}=" "$ENV" && return 0
  awk -v k="^${key}=" -v bk="${backup_key}=" '
    $0 ~ k { eq = index($0, "="); print bk substr($0, eq+1); next }
    { print }
  ' "$ENV" > "$ENV.new" && mv "$ENV.new" "$ENV"
}
add_backup VITE_SUPABASE_URL BACKUP
add_backup VITE_SUPABASE_ANON_KEY BACKUP

# 清空主线变量 → 触发 stores/auth.ts 里的 isDemoMode 检测
sed -i.tmp -E 's|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=|' "$ENV"
sed -i.tmp -E 's|^VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=|' "$ENV"
rm -f "$ENV.tmp"
cat "$ENV"
```

Expected: 看到 `VITE_SUPABASE_URL=`(空值) + `VITE_SUPABASE_ANON_KEY=`(空值) + 两个 `_BACKUP` 变量保留原值。

- [ ] **Step 6.3: 重启 Vite (worktree 上的 :5180) 重新读 env**

如果 Vite 当前在跑,Vite **不会自动**重新加载 `.env`,要手动重启。先找到进程:

```bash
ps -ef | grep -E "vite|@duoshou/web" | grep -v grep
lsof -i :5180 -sTCP:LISTEN 2>&1
```

如果 :5180 上有 vite 进程,kill 后重启:

```bash
# kill <PID>
cd /Users/yyjr/coding/duoshou-erp/.claude/worktrees/magical-hugle-4a8311/duoshou-erp
nohup pnpm dev:web > /tmp/web-mini-startup.log 2>&1 &
sleep 8
tail -20 /tmp/web-mini-startup.log
curl -s -o /dev/null -w "Web :5180 -> %{http_code}\n" http://127.0.0.1:5180/
```

Expected: 200,Vite 输出里看到 `ready in xxx ms`。

- [ ] **Step 6.4: 浏览器手测 Step 4 还显示数据**

打开浏览器(或 user 验证) https://duoshou.868818.xyz 或 http://<mac-mini>:5180/sales/temu-activity,期望:
- 跳过登录或自动走 demo session
- "/sales/temu-activity" 显示活动列表(2-N 条,跟 Task 4 行数对比里 activity 表的 count 一致)
- "/sales/temu-activity/history" 显示 enrollment 历史

确认无误后继续。

---

## Task 7: 改 sync_bi.py 的 DEST_DATABASE_URL

外部仓库 `~/mini-services/sync/sync_bi.py`。不在本仓库自动化里,手动操作 + verify。

**Files:** `~/mini-services/sync/sync_bi.py` (external repo).

- [ ] **Step 7.1: 找到 sync_bi.py 里指向 Supabase 的位置**

```bash
grep -nE "DATABASE_URL|kivdxnlpjtzgmbhzusrd|aws-1-ap-northeast-1\.pooler\.supabase\.com|DEST_DATABASE_URL" \
  ~/mini-services/sync/sync_bi.py ~/mini-services/sync/.env 2>&1 | head -20
```

Expected: 至少一行 hit,定位 DEST 配置在脚本里还是 `.env` 里。

- [ ] **Step 7.2: 改成 mini.duoshou**

如果是 `.env` 文件:

```bash
ENV=~/mini-services/sync/.env
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)

# 加 BACKUP 备份(若没),用 index() 取值避免长度计算错
grep -q '^DEST_DATABASE_URL_SUPABASE_BACKUP=' "$ENV" || \
  awk '/^DEST_DATABASE_URL=/ { eq=index($0,"="); print "DEST_DATABASE_URL_SUPABASE_BACKUP=" substr($0,eq+1); next } { print }' \
    "$ENV" > "$ENV.new" && mv "$ENV.new" "$ENV"

sed -i.tmp -E "s|^DEST_DATABASE_URL=.*|DEST_DATABASE_URL=postgresql://admin:${PG_PWD}@127.0.0.1:5432/duoshou|" "$ENV"
rm -f "$ENV.tmp"
grep -E 'DEST_DATABASE_URL' "$ENV" | sed 's|:[^@]*@|:****@|'
```

如果是脚本里硬编码:打开 `~/mini-services/sync/sync_bi.py` 找到对应常量,改成 mini-duoshou URL。同样加一个注释行备份原值。

Expected: 输出显示 DEST_DATABASE_URL 已是 mini-postgres/duoshou。

- [ ] **Step 7.3: 手动跑一次 sync_bi.py 看流程通**

```bash
cd ~/mini-services/sync
# 按本仓库实际的运行方式,例如:
# python3 sync_bi.py --once 或 docker exec mini-sync python3 sync_bi.py
# 实际命令以脚本 README 为准
```

- [ ] **Step 7.4: 验证 mini.duoshou.bi_sync_log 有新一行**

```bash
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
PGPASSWORD="$PG_PWD" psql -h 127.0.0.1 -p 5432 -U admin -d duoshou -c "
  SELECT table_name, rows_synced, status, finished_at
  FROM bi_sync_log
  ORDER BY finished_at DESC NULLS LAST
  LIMIT 5;"
```

Expected: 至少看到一行 `finished_at` 在最近几分钟内,`status` 是 `succeeded`/`success`,`table_name` 是 `bi_org_daily` / `bi_shop_daily` 之一。

- [ ] **Step 7.5: 恢复 cron**

如果 cron 之前被禁用(crontab 注释掉某行或 docker container 停了),恢复。具体取决于 mini-services 那边怎么调度的。

---

## Task 8: 重写 seed-dev-user.mjs 用 pg 直连(不再走 Supabase Auth)

切完之后没有 Supabase Auth,原脚本里 `admin.auth.admin.createUser` 等调用不能用。重写为纯 pg 操作:**直接 upsert `user` 表 + `member` 表**,让 NestJS `AuthGuard` 在 Bearer demo 时 inject 的 `DEV_USER_ID = 00000000-0000-4000-8000-000000000001` 找到对应行。

**Files:**
- Modify: `apps/api/scripts/seed-dev-user.mjs`

- [ ] **Step 8.1: 替换为 pg 直连版**

完整覆写 `apps/api/scripts/seed-dev-user.mjs`:

```javascript
// 幂等 seed: 确保 AuthGuard 在 DEV_AUTH_BYPASS=1 + Bearer demo 模式下
// 注入的 dev 用户 (id = DEV_USER_ID 00000000-0000-4000-8000-000000000001)
// 在 user 表存在,并作为 owner 加入到 BI org (mini.duoshou 上的)。
//
// Usage:  cd apps/api && node scripts/seed-dev-user.mjs
//
// 跑多次安全,已存在就跳过。
//
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_USER_EMAIL = 'dev@local';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in apps/api/.env.development');
  process.exit(2);
}

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();

console.log('=== seed dev tester (mini-postgres) ===');
console.log('  user id:  ', DEV_USER_ID);
console.log('  email:    ', DEV_USER_EMAIL);

try {
  // 1. 找有 BI 数据的 org_id (取行最多那个;通常只有一个)
  const orgRow = await client.query(`
    SELECT org_id
    FROM bi_org_daily
    GROUP BY org_id
    ORDER BY count(*) DESC
    LIMIT 1
  `);
  if (!orgRow.rows.length) {
    console.error('✗ bi_org_daily 是空的, BI 数据没同步过来? STOP');
    process.exit(3);
  }
  const orgId = orgRow.rows[0].org_id;
  console.log('  org_id:   ', orgId);

  // 2. upsert public.user
  await client.query(
    `INSERT INTO "user" (id, email, auth_provider)
     VALUES ($1, $2, 'dev-bypass')
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [DEV_USER_ID, DEV_USER_EMAIL],
  );
  console.log('  user:     upserted');

  // 3. ensure member (user_id + org_id 是复合唯一)
  const existing = await client.query(
    `SELECT id, role FROM member WHERE user_id = $1 AND org_id = $2`,
    [DEV_USER_ID, orgId],
  );
  if (existing.rows.length) {
    console.log('  member:   exists', existing.rows[0].id, 'role:', existing.rows[0].role);
  } else {
    const memberId = randomUUID();
    await client.query(
      `INSERT INTO member (id, user_id, org_id, role) VALUES ($1, $2, $3, 'owner')`,
      [memberId, DEV_USER_ID, orgId],
    );
    console.log('  member:   inserted as owner', memberId);
  }

  console.log('\n✅ dev user ready. NestJS AuthGuard 接受 Authorization: Bearer demo');
} finally {
  await client.end();
}
```

- [ ] **Step 8.2: 跑一次,看创建路径成功**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
node scripts/seed-dev-user.mjs 2>&1
```

Expected: 输出包含 `user:     upserted` + `member:   inserted as owner <uuid>`(假设之前 dump 进来的 member 表里没有 DEV_USER_ID)。或者如果 dump 含 dev-tester 那行旧的,这里会是 `member: exists`,也 OK。

- [ ] **Step 8.3: 跑第二次,验证幂等**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
node scripts/seed-dev-user.mjs 2>&1
```

Expected: 第二次输出 `user: upserted` + `member: exists ...`(member.id 跟第一次相同)。

- [ ] **Step 8.4: 验证 NestJS Bearer demo 真接受这个 user**

```bash
curl -s -H "Authorization: Bearer demo" -o /dev/null \
  -w "tenant resolve -> %{http_code}\n" \
  "http://127.0.0.1:4000/api/activities?page=1&pageSize=1"
```

Expected: 200。NestJS 内部 `TenantService.resolveForUser({id: DEV_USER_ID, ...})` 在 member 表里能找到这条,返回 BI org_id,activities 就能 list 出来。

- [ ] **Step 8.5: commit seed 脚本改动**

```bash
git -C /Users/yyjr/coding add duoshou-erp/apps/api/scripts/seed-dev-user.mjs
git -C /Users/yyjr/coding commit -m "$(cat <<'EOF'
refactor(api/scripts): rewrite seed-dev-user.mjs for pg-direct path

After the mini-postgres cutover, Supabase Auth is gone, so seed-dev-user.mjs
can no longer call admin.auth.admin.createUser. Rewritten as plain pg
upsert on user + member, keyed on the stable DEV_USER_ID that AuthGuard
injects when DEV_AUTH_BYPASS=1 + Bearer demo. Reads DATABASE_URL from
.env.development; idempotent on rerun.

Spec: docs/superpowers/specs/2026-05-16-mini-pg-migration-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 删除 smoke-bi-dashboard-real.mjs

这个脚本(commit `fe4997e`)的全部逻辑都依赖 Supabase Auth (`admin.auth.admin.createUser` 等)。切完后毫无意义,且新 seed-dev-user 已经覆盖了它的"建一个能调 API 的 user"需求。直接删。

**Files:**
- Delete: `apps/api/scripts/smoke-bi-dashboard-real.mjs`

- [ ] **Step 9.1: git rm + commit**

```bash
git -C /Users/yyjr/coding rm duoshou-erp/apps/api/scripts/smoke-bi-dashboard-real.mjs
git -C /Users/yyjr/coding commit -m "$(cat <<'EOF'
chore(api/scripts): remove smoke-bi-dashboard-real.mjs (Supabase Auth gone)

The script depended on admin.auth.admin.createUser / signInWithPassword
to create a one-shot Supabase user, attach it to the BI org, then hit
/api/dashboard/summary. After the mini-postgres cutover Supabase Auth is
no longer wired, and scripts/seed-dev-user.mjs already covers the
"make sure a user exists that AuthGuard's Bearer demo path can land on"
need with a simpler pg-direct path. Drop the script outright instead of
maintaining a parallel migration of it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 更新 README Quick Start

**Files:**
- Modify: `README.md`

- [ ] **Step 10.1: 读现状**

```bash
sed -n '20,60p' /Users/yyjr/coding/duoshou-erp/README.md
```

记住 "### Prerequisites" / "### Configure env" 节当前在哪几行。

- [ ] **Step 10.2: 替换 "### Configure env" 与 Supabase 相关段落**

打开 `/Users/yyjr/coding/duoshou-erp/README.md`,定位 "### Configure env" 那一节,把当下"Fill in DATABASE_URL=Supabase / SUPABASE_URL / SUPABASE_ANON_KEY..."的指引改为:

```markdown
### Configure env

```bash
cp apps/api/.env.development.example apps/api/.env.development
cp apps/web/.env.development.example apps/web/.env.development
```

**Database / Redis**: 默认指向 mac mini 上的 docker 容器 `mini-postgres` (库 `duoshou`) 和 `mini-redis` (`127.0.0.1:6379`)。如果你在别的机器,把 `DATABASE_URL` / `REDIS_URL` 改成你自己的实例。

**Auth**: `DEV_AUTH_BYPASS=1` 时,后端接受 `Authorization: Bearer demo`,跳过真用户校验,注入 dev 用户 `00000000-0000-4000-8000-000000000001`。前端 `apps/web/.env.development` 留空 `VITE_SUPABASE_URL` 即触发 demo session,自动带 `Bearer demo` 调 API。生产 / 接真用户时,Auth 由 `apps/api/src/modules/auth/auth.guard.ts` 的 fallback 处接入。

**Rollback to Supabase**: 想切回 Supabase 云数据库 / Auth, 把 `apps/api/.env.development` 里:
- `DATABASE_URL` 改成 `DATABASE_URL_SUPABASE_BACKUP` 的值
- `REDIS_URL` 改成 `REDIS_URL_UPSTASH_BACKUP` 的值
- 重启 NestJS 即可
```

同时把同节后面那段 "Generate `CREDS_ENCRYPTION_KEY`" 的指引保留(不动)。

- [ ] **Step 10.3: 同节更新 "Run" 部分确认端口**

如果 "### Run" 部分还写着 `http://localhost:3000/api/health`,改成 `:4000`(之前已经做过类似改动,但二次确认)。

- [ ] **Step 10.4: commit README**

```bash
git -C /Users/yyjr/coding add duoshou-erp/README.md
git -C /Users/yyjr/coding commit -m "$(cat <<'EOF'
docs(readme): switch Quick Start to mini-postgres + DEV_AUTH_BYPASS

Reflect the mini-postgres cutover: DATABASE_URL/REDIS_URL now point at the
mac mini's docker containers by default; Supabase project is preserved
only as a rollback target via DATABASE_URL_SUPABASE_BACKUP /
REDIS_URL_UPSTASH_BACKUP. Auth section explains DEV_AUTH_BYPASS=1 +
Bearer demo and points to auth.guard.ts for where real-user auth will plug in.

Spec: docs/superpowers/specs/2026-05-16-mini-pg-migration-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 回滚演练 — 切回 Supabase,再切回 mini,确保开关有效

**Files:** `apps/api/.env.development` (gitignored, 临时改动)。

- [ ] **Step 11.1: 切回 Supabase,临时改 .env**

```bash
ENV=/Users/yyjr/coding/duoshou-erp/apps/api/.env.development
# 把 _BACKUP 的值复制到主线变量
SUPABASE_URL_VAL=$(grep '^DATABASE_URL_SUPABASE_BACKUP=' "$ENV" | cut -d= -f2-)
UPSTASH_VAL=$(grep '^REDIS_URL_UPSTASH_BACKUP=' "$ENV" | cut -d= -f2-)
sed -i.tmp -E "s|^DATABASE_URL=.*|DATABASE_URL=${SUPABASE_URL_VAL}|" "$ENV"
sed -i.tmp -E "s|^REDIS_URL=.*|REDIS_URL=${UPSTASH_VAL}|" "$ENV"
rm -f "$ENV.tmp"
grep -E '^(DATABASE_URL|REDIS_URL)=' "$ENV" | sed 's|:[^@]*@|:****@|'
```

Expected: 输出显示 DATABASE_URL/REDIS_URL 已是 Supabase/Upstash 值。

- [ ] **Step 11.2: 重启 NestJS**

```bash
# kill 现 nest 进程 (lsof 找)
lsof -i :4000 -sTCP:LISTEN
# kill <PID>
cd /Users/yyjr/coding/duoshou-erp
nohup pnpm dev:api > /tmp/api-rollback-startup.log 2>&1 &
sleep 20
tail -20 /tmp/api-rollback-startup.log
curl -s -o /dev/null -w "/api/health -> %{http_code}\n" http://127.0.0.1:4000/api/health
curl -s -H "Authorization: Bearer demo" -o /dev/null -w "/api/activities (on supabase) -> %{http_code}\n" \
  "http://127.0.0.1:4000/api/activities?page=1&pageSize=1"
```

Expected: health 200,activities 200,确认回滚开关有效。

- [ ] **Step 11.3: 切回 mini**

```bash
ENV=/Users/yyjr/coding/duoshou-erp/apps/api/.env.development
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
sed -i.tmp -E "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://admin:${PG_PWD}@127.0.0.1:5432/duoshou|" "$ENV"
sed -i.tmp -E "s|^REDIS_URL=.*|REDIS_URL=redis://127.0.0.1:6379|" "$ENV"
rm -f "$ENV.tmp"
```

- [ ] **Step 11.4: 重启 NestJS 再次,确认切回 mini 也无碍**

```bash
# kill 现进程
# kill <PID>
cd /Users/yyjr/coding/duoshou-erp
nohup pnpm dev:api > /tmp/api-back-to-mini.log 2>&1 &
sleep 20
tail -20 /tmp/api-back-to-mini.log
curl -s -H "Authorization: Bearer demo" -o /dev/null -w "/api/activities (on mini) -> %{http_code}\n" \
  "http://127.0.0.1:4000/api/activities?page=1&pageSize=1"
```

Expected: 200。回到 mini 稳定状态。

---

## Task 12: Final 验收 + DoD 检查

按 spec §6 的 9 条 DoD 走一遍。

- [ ] **Step 12.1: DoD #1-3 — curl 三连**

```bash
curl -s -o /dev/null -w "DoD#1 /api/health  -> %{http_code}\n" \
  http://127.0.0.1:4000/api/health
curl -s -H "Authorization: Bearer demo" -o /tmp/dod-activities.json \
  -w "DoD#2 /api/activities -> %{http_code}\n" \
  "http://127.0.0.1:4000/api/activities?page=1&pageSize=3"
curl -s -H "Authorization: Bearer demo" -o /tmp/dod-enrollments.json \
  -w "DoD#3 /api/enrollments -> %{http_code}\n" \
  "http://127.0.0.1:4000/api/enrollments?page=1&pageSize=5"
echo "--- activities total ---"; grep -oE '"total":[0-9]+' /tmp/dod-activities.json
echo "--- enrollments total ---"; grep -oE '"total":[0-9]+' /tmp/dod-enrollments.json
```

Expected: 三个 200,total 非 0(跟 Supabase 上看到的数字相同)。

- [ ] **Step 12.2: DoD #4-5 — 浏览器手测两个 Step 4 页面**

打开 `:5180/sales/temu-activity` 看到活动行。
打开 `:5180/sales/temu-activity/history` 看到 enrollment 行。

User 主观确认无误后 ✓。

- [ ] **Step 12.3: DoD #6 — seed-dev-user 幂等**

```bash
cd /Users/yyjr/coding/duoshou-erp/apps/api
node scripts/seed-dev-user.mjs 2>&1 | grep -E "exists|inserted|upserted"
```

Expected: 第二次跑应有 `member: exists` + `user: upserted`。

- [ ] **Step 12.4: DoD #7 — sync_bi.py 新跑后 bi_sync_log 有新记录**

(Task 7 已经做了一次。如果距离 Task 7 已经过去一段时间,这里再触发一次或等下一轮 cron):

```bash
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
PGPASSWORD="$PG_PWD" psql -h 127.0.0.1 -p 5432 -U admin -d duoshou -c "
  SELECT table_name, rows_synced, status,
         to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS') AS finished
  FROM bi_sync_log
  ORDER BY finished_at DESC NULLS LAST
  LIMIT 5;"
```

Expected: 至少一行 `finished` 时间是今天的(切换日)。

- [ ] **Step 12.5: DoD #8 — NestJS 日志没 Supabase trace**

```bash
grep -iE "supabase|@supabase|kivdxnlpjtzgmbhzusrd" /tmp/api-back-to-mini.log | head -10
grep -cE "supabase|@supabase" /tmp/api-back-to-mini.log
```

Expected: 第二个计数为 0,或仅出现在历史 `*_BACKUP` 变量名相关 log(无实际调用)。

- [ ] **Step 12.6: DoD #9 — 行数对比矩阵**

(Task 4 Step 4 已经做过一次。这里再跑一次,确认稳定运行了一段时间后行数仍跟 Supabase 同步):

```bash
PG_PWD=$(docker inspect mini-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
PGPASSWORD="$PG_PWD" psql -h 127.0.0.1 -p 5432 -U admin -d duoshou -tA -c "
  SELECT t, count::text FROM (
    SELECT 'user' AS t, count(*) FROM \"user\"
    UNION ALL SELECT 'organization', count(*) FROM organization
    UNION ALL SELECT 'member', count(*) FROM member
    UNION ALL SELECT 'shop', count(*) FROM shop
    UNION ALL SELECT 'activity', count(*) FROM activity
    UNION ALL SELECT 'activity_enrollment', count(*) FROM activity_enrollment
    UNION ALL SELECT 'bi_org_daily', count(*) FROM bi_org_daily
    UNION ALL SELECT 'agent_task', count(*) FROM agent_task
  ) x ORDER BY t;
"
```

跟 `/tmp/baseline-supabase-counts.txt` 里对应表的值人眼对比。Expected: ≥ Supabase 基线(切换后可能有新 enrollment/agent_task 写入,所以是 ≥)。

---

## Task 13: 推 GitHub

- [ ] **Step 13.1: 看本地 commit log**

```bash
git -C /Users/yyjr/coding log --oneline -8
```

Expected: 从最新往下能看到 Task 2 (auth.guard 简化)、Task 8 (seed-dev-user 重写)、Task 9 (删 smoke 脚本)、Task 10 (README) 这 4 个 commit。

- [ ] **Step 13.2: subtree push**

```bash
cd /Users/yyjr/coding && bash duoshou-erp/infra/deploy/push-to-github.sh 2>&1 | tail -3
```

Expected: `Push done.`,远程 main HEAD 推进。

- [ ] **Step 13.3: 验证 GitHub 上 main 跟本地一致**

```bash
LOCAL=$(git -C /Users/yyjr/coding log --format=%H -1 main)
echo "local main : $LOCAL"
git ls-remote https://github.com/sggtong1/duoshou-erp.git refs/heads/main
```

Expected: 远程 HEAD 跟本地最新 commit 对得上(subtree 切片后 hash 通常会不同 — 验证靠语义:远程 hash 跟之前那次 push 不同,且 push 输出说 `xxx..yyy main`)。

- [ ] **Step 13.4: 检查 GitHub 上的 auth.guard.ts 真简化了**

```bash
gh api repos/sggtong1/duoshou-erp/contents/apps/api/src/modules/auth/auth.guard.ts -q '.content' \
  | base64 -d | grep -E "createClient|supabase-js|DEV_AUTH_BYPASS" | head -5
```

Expected: 只看到 `DEV_AUTH_BYPASS` 那一行,没有 `createClient` 或 `supabase-js` 引用。

---

## 完成判据

- 所有 13 个 task 全部勾完。
- Task 12 的 6 个 DoD step 全过。
- Task 11 的回滚演练验证开关有效。
- `git -C /Users/yyjr/coding log --oneline -10` 能看到 mini-postgres 相关 4 个 commit。
- `:5180/sales/temu-activity` 和 `/history` 显示真实数据。
- mini-services/sync/sync_bi.py 已切到 mini.duoshou,下一轮 cron 写入正常。

## 收尾备忘

- `.env.development` 里 `*_BACKUP` 变量是长期保留的(回滚开关),不要后续清掉。
- `apps/api/package.json` 仍依赖 `@supabase/supabase-js` (前端、auth 复原都可能用到)。本次不删,避免动 lockfile。
- 后续做 "Step 2 (插件 agent.js 真接 fetch_hook)" 时,跟 mini PG 切换无关,独立开 spec。
