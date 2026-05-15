# 舵手 ERP

面向 Temu 多店铺卖家的「跨店聚合 + 批量操作」SaaS 工作台。

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

- Node.js 20+, pnpm 9+
- Redis 7 (local: `docker run -d --name duoshou-redis -p 6379:6379 redis:7-alpine`)
- Supabase project (free tier is fine): create at https://supabase.com/dashboard
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

Fill in:

- `DATABASE_URL` — Supabase Postgres connection string (Settings → Database)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project → API settings
- `CREDS_ENCRYPTION_KEY` — generate with:

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
