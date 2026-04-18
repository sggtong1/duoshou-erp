# Supabase migration guide

## 1. Create a Supabase project

Go to https://supabase.com/dashboard, create a new project called `duoshou-erp-dev`.

## 2. Configure DATABASE_URL

From **Settings → Database → Connection string**, copy the `postgresql://...` URL
with `?pgbouncer=true&connection_limit=1` if using the pooler, or the direct connection
URL if using direct PostgreSQL.

Put it in `apps/api/.env.development` as `DATABASE_URL=...`.

## 3. Apply the initial migration

```bash
cd apps/api
pnpm prisma migrate deploy
```

This applies `prisma/migrations/20260418000000_init/migration.sql` to your Supabase DB.

Alternative (if you want Prisma to manage schema + migrations interactively):
```bash
pnpm prisma migrate dev
```

## 4. Verify

```bash
pnpm prisma studio
```

Opens a web UI where you can see the 5 tables: `user`, `organization`, `member`, `shop`, `shop_credentials`.

## Notes

- Row Level Security (RLS) policies are **not** managed by Prisma. Enable RLS and write
  policies in the Supabase Dashboard → Database → Tables → Row Level Security.
- For production, set DATABASE_URL via deployment secrets, not .env files.
- The `shop_credentials` table stores AES-256-GCM encrypted blobs — plaintext never
  touches the database.
