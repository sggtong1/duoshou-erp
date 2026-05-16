# 舵手 ERP

面向多平台电商卖家的「跨平台 BI 看板 + 聚合运营操作」SaaS 工作台；当前首个深度适配平台为 Temu。

## Status

W0 (foundation) complete. See `docs/w0-done-checklist.md` for what's in place.

Next: W1 Cross-shop product listing, W2 price/activity, W3 inventory, W4 launch.

Design spec: `docs/superpowers/specs/2026-04-18-duoshou-erp-v1-design.md`
Implementation plan (W0): `docs/superpowers/plans/2026-04-18-w0-foundation.md`

## Tech stack

- Backend: Node.js 20 + NestJS 10 + TypeScript 5 + Prisma 7
- Frontend: Vue 3 + Vite + Naive UI + Pinia
- SDK: `@duoshou/temu-sdk` — 178 code-generated Temu API methods with signing, rate limiting, retry
- Storage: PostgreSQL (Supabase hosted) + Redis 7 (cache, queue, rate limit)
- Auth: Supabase Auth (email/password, expandable)
- Deploy: Docker Compose on 阿里云 / 火山云 ECS via GitHub Actions

## Quick start (development)

### Prerequisites

- Node.js 20.19+, pnpm 9+
- PostgreSQL 16 + Redis 7. Default: the mac-mini `mini-postgres` + `mini-redis` docker containers (this project's `duoshou` database lives in `mini-postgres`). For development on another machine, point `DATABASE_URL` / `REDIS_URL` at your own instances.
- (For integration tests) Temu service-provider test credentials — see below

### Install

```bash
cd duoshou-erp
corepack enable && corepack prepare pnpm@9.0.0 --activate
pnpm install
```

### Configure env

```bash
cp apps/api/.env.development.example apps/api/.env.development
cp apps/web/.env.development.example apps/web/.env.development
```

**Database / Redis**: defaults assume the mac-mini docker containers `mini-postgres` (db `duoshou`, user `admin`, `127.0.0.1:5432`) and `mini-redis` (`127.0.0.1:6379`). On a different machine, swap `DATABASE_URL` and `REDIS_URL` to your own instances.

**Auth**: dev runs with `DEV_AUTH_BYPASS=1` and the backend accepts `Authorization: Bearer demo` (or `Bearer dev`). The guard injects a stable dev user `id = 00000000-0000-4000-8000-000000000001`. Frontend auto-detects demo mode when `VITE_SUPABASE_URL` is blank in `apps/web/.env.development` — `stores/auth.ts` then issues `Bearer demo` on every request. Real-user auth (JWT verification etc.) plugs in at `apps/api/src/modules/auth/auth.guard.ts`.

**Seed the dev user** so it owns the working org (Bearer demo lands here):

```bash
cd apps/api && node scripts/seed-dev-user.mjs
```

The script picks the org with the most agent-task activity (the "real-work" org), cleans up any orphan member rows, and is safe to rerun.

**Rollback to Supabase**: the cutover keeps the Supabase project (kivdxnlpjtzgmbhzusrd) alive and `.env.development` retains all original values as `_BACKUP` aliases. To revert:

1. `DATABASE_URL` ← `DATABASE_URL_SUPABASE_BACKUP`
2. `REDIS_URL` ← `REDIS_URL_UPSTASH_BACKUP`
3. (If reviving Supabase Auth) restore the original `auth.guard.ts` from git history before the simplification commit, plus the `SUPABASE_*` env vars from their `_BACKUP` aliases
4. Restart `pnpm dev:api`

**`CREDS_ENCRYPTION_KEY`** — generate fresh per environment:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Generate Temu SDK

```bash
pnpm codegen
```

This reads `packages/temu-sdk/spec/temu-api-spec.json` and produces `src/generated/types.ts` + `src/generated/methods.ts`.

### Apply Prisma migration

```bash
cd apps/api
pnpm prisma migrate deploy
```

Alternative if you want an interactive flow:
```bash
pnpm prisma migrate dev
```

See `apps/api/prisma/MIGRATION_GUIDE.md` for details.

### Run

```bash
# In one terminal
pnpm dev:api
# In another
pnpm dev:web
```

- API: http://localhost:4000/api/health
- Web: http://localhost:5173

### Ports (mac mini dev machine)

The mac mini hosts several long-running services. duoshou-erp's API was moved off the default 3000 to avoid them; the current allocation is:

| Port | Owner |
|------|-------|
| 3000 | `mini-metabase` (BI, always-on) |
| 3001 | `supply-chain-api` |
| **4000** | **`duoshou-erp-api`** |
| 5173 | Vite dev (shared by supply-chain / duoshou-erp — don't run both at once) |
| 5432 | `mini-postgres` |
| 5433 | `supply-chain-postgres` |
| 6379 | `mini-redis` |
| 8081 | `mini-adminer` |

If you run this project on a different machine where 3000 is free, change `PORT` in `apps/api/.env.development` and the matching `proxy` target in `apps/web/vite.config.ts`.

### Test

```bash
pnpm -r test
```

### Integration tests (optional)

Set Temu test creds in `apps/api/.env.development`:

```
TEMU_FULL_TEST_1_APP_KEY=...
TEMU_FULL_TEST_1_APP_SECRET=...
TEMU_FULL_TEST_1_ACCESS_TOKEN=...
TEMU_FULL_TEST_1_SHOP_ID=1052202882
```

(Get these from the Temu developer portal sandbox docs.)

```bash
cd apps/api
pnpm vitest run test/shop.e2e.test.ts
```

## Repository layout

```
duoshou-erp/
├─ apps/
│  ├─ api/             NestJS backend
│  └─ web/             Vue 3 frontend
├─ packages/
│  ├─ temu-sdk/        214-method Temu API client (code-generated)
│  └─ shared-types/    cross-app DTO types
├─ infra/
│  ├─ docker/          Dockerfiles + compose + nginx
│  └─ deploy/          SSH deploy scripts
├─ docs/
│  ├─ references/temu/ 214 captured Temu docs (markdown)
│  └─ superpowers/     specs, plans, decisions
├─ .github/workflows/  CI (test on PR) + deploy (on main)
└─ README.md
```

## License

Proprietary — all rights reserved.
