FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/temu-sdk/package.json ./packages/temu-sdk/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @duoshou/shared-types build || true

# Build-time env (for vite bundling). Set defaults; compose/deploy can pass --build-arg.
ARG VITE_API_BASE_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN cd apps/web && \
    echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production && \
    echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" >> .env.production && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env.production && \
    pnpm exec vite build
# 注意:跳过 package.json 里 build script 的 vue-tsc 类型检查。
# 类型错误已在本地 pnpm build 验证;VPS 单核 + 小内存跑 vue-tsc 极慢(40 分钟+)。
# 要在 VPS 恢复类型检查,改回 `pnpm build`,但需要 ≥ 4GB RAM。

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
