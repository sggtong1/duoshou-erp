# 切到 mini-postgres 的数据库迁移设计

**日期**：2026-05-16
**作者**：yyjr + Claude（brainstorming 协作）
**状态**：spec — 等待写 implementation plan

---

## 背景与动机

`duoshou-erp` 后端目前连 Supabase 云 Postgres（`aws-1-ap-northeast-1.pooler.supabase.com`），Redis 连 Upstash 云，Auth 用 Supabase Auth API 验证 JWT。同时 mac mini 上跑着 `mini-postgres` / `mini-redis` 容器（已经在跑 `temu-data-scrap` 爬虫数据、metabase 等本地服务），希望把 ERP 项目所有数据从云上搬到本地，让整套系统跑在 mac mini 内闭环，只把公网入口（`duoshou.868818.xyz`）经 VPS → Tailscale 透到 mac mini。

**目标**：把 duoshou-erp 的 26 张 Prisma 表从 Supabase 迁到 mini-postgres，Redis 从 Upstash 迁到 mini-redis，Auth 从 Supabase Auth 退化到 `DEV_AUTH_BYPASS=1 + Bearer demo`。保留 Supabase 项目作为回滚兜底。

**非目标**（YAGNI）：
- 不引入 Postgres FDW、`@@schema` 多 schema、view 等高级特性。
- 不实现真用户 Auth（密码 / OAuth / 邮箱验证），未来真上线再做。
- 不做生产部署 SSO / TLS 加固（mac mini 本机访问、Tailscale 内网通信）。
- 不重写 `DashboardService` 改读 ecommerce 源表（保留 `bi_*` 中转，跟上一轮 BI 改造工作一致）。

---

## 切换前 / 切换后对比

| 维度 | 现状 | 切完 |
|---|---|---|
| 业务数据库 | Supabase Postgres / `public` schema | mini-postgres / `duoshou` 库 |
| BI 中转 | mini-postgres/ecommerce → sync_bi.py → Supabase/bi_* | mini-postgres/ecommerce → sync_bi.py → mini-postgres/duoshou/bi_* |
| Redis | Upstash 云 (rediss://) | mini-redis (127.0.0.1:6379) |
| Auth | Supabase Auth API 校验 JWT | `DEV_AUTH_BYPASS=1` 接受 `Bearer demo` |
| `auth.guard.ts` | 调 `@supabase/supabase-js` | 仅检查 `DEV_AUTH_BYPASS=1` |
| `apps/web/.env` `VITE_SUPABASE_URL` | 真实地址 | 注释/清空 → 触发已存在的 `isDemoMode` 分支 |
| Supabase 项目 | 真实读写 | 保留不动，仅作回滚 |

---

## 1. 目标架构

```
mac mini (Tailscale 内网)
├── docker: mini-postgres (postgres:16-alpine)
│   ├── ecommerce 库 ── 爬虫的 29 张表(不动)
│   └── duoshou 库 ──── 新建 owner=admin
│                       Prisma 26 张表 (Supabase 全量 dump restore)
├── docker: mini-redis (redis:7-alpine, 127.0.0.1:6379)
├── process: NestJS API :4000
│   DATABASE_URL = postgresql://admin:****@127.0.0.1:5432/duoshou
│   REDIS_URL    = redis://127.0.0.1:6379
│   DEV_AUTH_BYPASS = 1
└── process: Vite :5180 (worktree) / :5173 (main 偶尔)
    stores/auth.ts demo session 自动触发(VITE_SUPABASE_URL 空)

mini-services/sync/sync_bi.py
  src  = mini-postgres / ecommerce
  dest = mini-postgres / duoshou (改了)

Supabase 项目 kivdxnlpjtzgmbhzusrd
  仅保留不读不写, .env 里的 *_SUPABASE_BACKUP 变量随时切回
```

---

## 2. 选型与备选方案

### 选型：方案 A — 独立 `duoshou` 库

mini-postgres 实例下新建 `duoshou` 库（owner `admin`），跟 `ecommerce` 库并列。Prisma schema 不动，sync_bi.py 改写入目标 URL。

**优势**：
- Prisma 26 个 model **零修改**。
- 跨库 sync 仍存在但在 mini 单机内（localhost socket）。
- 回滚干脆：`DROP DATABASE duoshou`。
- 跟爬虫库 `ecommerce` 边界清晰，不混入 duoshou-erp 业务表。

**劣势**：
- 同实例下两库间 `bi_*` 跟爬虫源表存在轻度数据冗余（约 12k+ 行可接受）。

### 备选：方案 B — `ecommerce` 库 + `duoshou` schema

26 个 model 全部加 `@@schema("duoshou")`，Prisma 开 `multiSchema` preview。优势是同库可用 SQL view 让 `bi_*` 虚拟成 `public.sku_daily_metrics` 投影，省掉 `sync_bi.py`。但 Q3 已经选择保留 sync，view 的优势用不上，剩下的只是少一层冗余，不值得为它付 26 个 model 加注的工作量 + multiSchema 仍在 preview。**否决**。

---

## 3. 组件改动清单

### 3.1 基础设施

| 任务 | 命令 |
|---|---|
| 新建 duoshou 库 | `docker exec mini-postgres psql -U admin -d postgres -c "CREATE DATABASE duoshou OWNER admin"` |
| 跑 Prisma migrate | `cd apps/api && DATABASE_URL=postgresql://admin:****@127.0.0.1:5432/duoshou pnpm prisma migrate deploy` |
| 备份 Supabase 数据 | `pg_dump "$SUPABASE_URL" --schema=public --data-only --column-inserts --no-owner --no-acl > /tmp/supabase-data.sql` |
| 灌进 duoshou | `psql "postgresql://admin:****@127.0.0.1:5432/duoshou" -f /tmp/supabase-data.sql` |
| 行数对比验证 | 对 `organization` / `member` / `shop` / `activity` / `activity_enrollment` / `price_review` / `bi_org_daily` / `bi_sku_snapshot` / `agent_task` 各 `SELECT count(*)`，跟 Supabase 对齐 |

### 3.2 后端 `apps/api/.env.development`

```diff
-DATABASE_URL=postgresql://postgres.kivdxnlpjtzgmbhzusrd:****@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
+DATABASE_URL=postgresql://admin:****@127.0.0.1:5432/duoshou
+DATABASE_URL_SUPABASE_BACKUP=postgresql://postgres.kivdxnlpjtzgmbhzusrd:****@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres

-REDIS_URL=rediss://default:****@rare-frog-40380.upstash.io:6379
+REDIS_URL=redis://127.0.0.1:6379
+REDIS_URL_UPSTASH_BACKUP=rediss://default:****@rare-frog-40380.upstash.io:6379

-SUPABASE_URL=https://kivdxnlpjtzgmbhzusrd.supabase.co
-SUPABASE_ANON_KEY=...
-SUPABASE_SERVICE_ROLE_KEY=...
+SUPABASE_URL_BACKUP=https://kivdxnlpjtzgmbhzusrd.supabase.co
+SUPABASE_ANON_KEY_BACKUP=...
+SUPABASE_SERVICE_ROLE_KEY_BACKUP=...

 DEV_AUTH_BYPASS=1
```

### 3.3 后端 `apps/api/src/modules/auth/auth.guard.ts`

简化为纯 dev bypass，去掉 `@supabase/supabase-js` 调用（依赖保留，不删 package.json，方便日后回滚 Auth 或上真实 Auth 时再启用）：

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    if (process.env.DEV_AUTH_BYPASS !== '1') {
      // 未来上真实用户 Auth 时,在这里加 JWT 校验
      throw new UnauthorizedException('Production auth not implemented');
    }
    req.user = { id: 'demo', email: 'demo@duoshou.local' };
    return true;
  }
}
```

### 3.4 前端 `apps/web/.env.development`

```diff
-VITE_SUPABASE_URL=https://kivdxnlpjtzgmbhzusrd.supabase.co
-VITE_SUPABASE_ANON_KEY=...
+VITE_SUPABASE_URL_BACKUP=https://kivdxnlpjtzgmbhzusrd.supabase.co
+VITE_SUPABASE_ANON_KEY_BACKUP=...
```

`stores/auth.ts` 已有 `isDemoMode = !supabaseUrl || ...` 检测（之前 worktree commit 加的），env 里 URL 空就自动走 DEMO_SESSION（`Bearer demo`），**前端代码无需改动**。

### 3.5 sync_bi.py（`~/mini-services/sync/sync_bi.py`，不在本仓库）

把 `DEST_DATABASE_URL` 从 Supabase 改成 mini-postgres/duoshou。具体配置文件位置以脚本实际为准（可能是 `.env`、配置常量或 CLI 参数），由 implementation plan 阶段确认。

### 3.6 文档

- `README.md`：「Quick start」从 Supabase project 改为 mini-postgres docker。加一句回滚开关说明。
- 本 spec 文档：保留在 `docs/superpowers/specs/`。

### 3.7 工具脚本

`apps/api/scripts/smoke-bi-dashboard-real.mjs` 当前用 `@supabase/supabase-js` admin client 创建 member（依赖 Supabase Auth API）。切完之后 Supabase Auth 不再启用，此脚本 **改用 pg 直连** 或干脆删除，由后续 `seed-dev-user.mjs` 的等价版本取代（也需要改成 pg 直连）。implementation plan 阶段决定。

---

## 4. 数据流（切换前 / 切换期间 / 切换后）

### 切换期间（30-60 分钟单次窗口）

```
T0   现状: 后端 → Supabase, sync_bi.py → Supabase
T1   pause NestJS (避免迁移中产生新写入)
T2   pause sync_bi.py cron (避免源端再写)
T3   CREATE DATABASE duoshou
T4   prisma migrate deploy → 建 schema
T5   pg_dump Supabase public --data-only → dump.sql
T6   psql mini/duoshou < dump.sql
T7   行数对比验证 (organization/member/shop/activity/bi_*/agent_task 等)
T8   改 .env.development (DATABASE_URL / REDIS_URL / Auth 备份)
T9   简化 auth.guard.ts (git commit)
T10  改 apps/web/.env.development 触发 demo mode
T11  启动后端 + curl /api/health + curl /api/activities + 行数 sanity
T12  浏览器打开 :5180/sales/temu-activity 看 Step 4 数据还在
T13  改 sync_bi.py DEST_DATABASE_URL → 重启 cron
T14  下一轮 cron 触发, 看 bi_sync_log 表里有新记录
```

### 切换后稳态

**写路径**（不变方向，只换目标库）：
```
temu-data-scrap → mini.ecommerce.{爬虫表}
sync_bi.py      → mini.duoshou.{bi_*}
Chrome 扩展     → /api/agent-tasks/:id/result → AgentResultIngestor → mini.duoshou.{activity,activity_enrollment}
NestJS *-sync.cron → Prisma → mini.duoshou.{price_review,activity,...}
```

**读路径**：
```
浏览器 → Vite :5180 → fetch /api/* (Bearer demo)
       → NestJS Controllers (AuthGuard 走 DEV_AUTH_BYPASS 通过)
       → Prisma → mini.duoshou
```

**不再走**：
- Supabase Auth API（auth.guard 已去除）
- Supabase Postgres（代码不读不写，仅 env 备份保留）
- Upstash Redis（同上）

---

## 5. 错误处理 / 风险点

| 风险 | 缓解 |
|---|---|
| `pg_dump` 大表慢 / 网络中断 | dump 在切换窗口外提前跑一次预热；单次 12k 行 BI + 几百活动数据规模 < 1 分钟 |
| `--column-inserts` 导入数据时遇约束冲突 | 先 `truncate cascade` 再 import；migrate 完表是空的，理论不冲突 |
| UUID / BigInt 字段往返 | `pg_dump --column-inserts` 保留字面值；Prisma + 现有 BigInt 处理代码不动 |
| 切换窗口中有写请求落到 Supabase | T1/T2 显式 pause；窗口结束后旧请求要 retry 落到 mini |
| sync_bi.py cron 在 T2–T13 期间没运行 | 1 小时窗口最多丢 1 个 cron 周期，下次跑自动补；BI 数据是 daily 聚合，单次缺失无明显影响 |
| 前端的旧 Supabase JWT 还在 localStorage 里 | `stores/auth.ts` `isDemoMode` 检测优先于 stored session；env 改完一刷新就走 demo |
| auth.guard 改完没人测 cover | implementation plan 阶段加一个 vitest 覆盖 `DEV_AUTH_BYPASS=1` + 缺 token 两条路径 |
| Tailscale 异常 / mac mini 重启 | DB 是本机进程到本机 docker，不走 Tailscale；不影响 |

---

## 6. 测试 / 验收

### 切换完成的 Definite-Done 标准

1. `curl http://localhost:4000/api/health` → `200`
2. `curl -H "Authorization: Bearer demo" http://localhost:4000/api/activities?page=1&pageSize=3` → `200` + 跟 Supabase 同样的活动行
3. `curl -H "Authorization: Bearer demo" http://localhost:4000/api/enrollments?page=1&pageSize=5` → `200` + enrollment 行
4. 浏览器 `:5180/sales/temu-activity` 仍看到迁过去的真活动（跟上次 Step 4 验证一致）
5. 浏览器 `:5180/sales/temu-activity/history` 仍看到迁过去的真 enrollment
6. `seed-dev-user.mjs`（改造后）跑两次，第二次 `exists` → demo 用户在 mini.duoshou.member 表里
7. sync_bi.py 下一轮 cron 跑完，`SELECT * FROM mini.duoshou.bi_sync_log ORDER BY finished_at DESC LIMIT 3` 看到新记录，目标库行数增加
8. NestJS 日志里 **没有任何** `@supabase/supabase-js` 相关 trace、错误、`SUPABASE_URL undefined` 警告
9. **行数对比矩阵**：每张关键表 mini 行数 = Supabase 行数（迁完即刻），关键表清单 = organization / member / user / shop / shop_credentials / activity / activity_session / activity_enrollment / price_review / price_adjustment_order / sku_price_history / product / sku / product_template / bulk_job / bulk_job_item / shop_sku_snapshot / org_settings / agent_task + 7 张 bi_*

### 回滚演练（implementation plan 阶段执行）

在 implementation plan 中安排一次回滚演练：把 `.env` 切回 `DATABASE_URL=$DATABASE_URL_SUPABASE_BACKUP` 等，重启 NestJS，验证仍能跑通基本 health + activities curl。完成后再切回 mini。

---

## 7. 实施顺序（粗）

implementation plan 阶段细化，初步划分：

1. **准备**：mini-postgres 上 `CREATE DATABASE duoshou`；`pg_dump` Supabase 预演一遍。
2. **schema**：`prisma migrate deploy` 到 duoshou，行数为零。
3. **数据**：pg_dump → restore，跑行数对比。
4. **代码**：改 `.env`、简化 `auth.guard.ts`、commit 到 main。
5. **前端**：改 `.env`（清 SUPABASE_URL），不需要 commit 代码改动。
6. **运行**：重启 NestJS、curl 验证、浏览器验证。
7. **下游**：改 sync_bi.py DEST_DATABASE_URL，恢复 cron。
8. **清理**：`smoke-bi-dashboard-real.mjs` 改造或删除；README 更新。
9. **回滚演练**：切回 Supabase 再切回 mini，验证开关有效。

---

## 8. 不在本 spec 范围内

- **Step 2（插件 agent.js 真接 fetch_hook）**：跟 DB 切换无关，独立 task。
- **Production 部署**：当下 mac mini 同时承担 dev + 自用，没有云上"prod"概念，已禁用 GitHub Actions 的 deploy job。
- **真用户 Auth**：保留 `DEV_AUTH_BYPASS=1` 即可。
