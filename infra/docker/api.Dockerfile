# Multi-stage build for @duoshou/api

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
# Required by some Node native modules
RUN apk add --no-cache libc6-compat

# -------- Build stage --------
FROM base AS build
ENV NODE_ENV=development
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/temu-sdk/package.json ./packages/temu-sdk/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/api ./apps/api

# Generate Temu SDK (types + methods) and build packages, then the API
RUN pnpm --filter @duoshou/temu-sdk exec pnpm codegen || pnpm --filter @duoshou/temu-sdk codegen
RUN pnpm --filter @duoshou/shared-types build
RUN pnpm --filter @duoshou/temu-sdk build

# Generate Prisma Client into node_modules (writes PrismaClient class + model delegates
# that the compiled API code imports at build AND runtime).
RUN pnpm --filter @duoshou/api exec prisma generate

RUN pnpm --filter @duoshou/api build

# -------- Runtime stage --------
# Inherit the entire build stage /app tree:保留 pnpm workspace 的 hoisted
# node_modules + apps/api/node_modules + 所有 .prisma 输出路径。不走 pnpm deploy
# 因为它在 workspace + generated files 场景下会漏 .prisma,在 runtime 里 require
# '.prisma/client/default' 就挂。镜像会变大(多带 dev deps + 源码),公测够用。
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat
WORKDIR /app/apps/api

COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/main.js"]
