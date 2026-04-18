# W0 Foundation — Done Checklist

- [x] **T1** Monorepo scaffold (pnpm workspaces, 4 packages, shared tsconfig, prettier, editorconfig)
- [x] **T2** Temu 214 docs ingested + normalized spec extracted (184 API specs)
- [x] **T3** Code-generated TypeScript types from Temu spec (178 Request/Response interfaces)
- [x] **T4** Code-generated 178 Temu API method functions + registry
- [x] **T5** Temu API request signing (MD5 + sorted key-value sandwich + app_secret)
- [x] **T6** HTTP client with gateway routing (CN: `openapi.kuajingmaihuo.com`, PA: `openapi-b-partner.temu.com`), retry policy
- [x] **T7** Redis token bucket rate limiter (Lua atomic, per-shop 3-5 qps)
- [x] **T8** `TemuClient` class composing all of the above
- [x] **T9** NestJS API scaffold with health endpoint + zod-validated env
- [x] **T10** Vue 3 + Vite + Pinia + Naive UI scaffold
- [x] **T11** Prisma schema + initial migration (user/org/member/shop/shop_credentials)
- [x] **T12** AES-256-GCM credential encryption + shop connect flow (validates via bg.mall.info.get)
- [x] **T13** Supabase Auth integration (backend JWT guard + frontend login/signup + router guard)
- [x] **T14** Tenant/Member auto-creation on first authenticated request
- [x] **T15** Docker Compose + GitHub Actions deploy to ECS
- [x] **T16** E2E smoke test + README + this checklist

## Known gaps / W1+ follow-ups

1. TLS/HTTPS setup on the web nginx server — add an HTTPS server block and Let's Encrypt automation on first deploy
2. Verify `nest build` output path matches `apps/api/dist/main.js` for the Dockerfile CMD
3. Implement RLS policies in Supabase for multi-tenant isolation (backend currently uses service_role key bypass — fine for W0)
4. Test coverage on HomePage.vue and LoginPage.vue (UI tests, not prioritized for W0)
5. Audit paramType mapping: paramType=3 and 9 were not observed in the spec, but future Temu doc updates might introduce them
6. `TemuClient.call` does not surface `interfaceName` from the registry — low priority enhancement
7. `packageManager` in root package.json is pinned to `pnpm@9.0.0`; consider bumping to latest when team is ready

## Commit log (W0)

Run `git log --oneline` from `/Users/mx4com/coding` to see the full W0 history.
