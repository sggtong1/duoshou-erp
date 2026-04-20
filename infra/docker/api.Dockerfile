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

# Prune dev dependencies for runtime
RUN pnpm --filter @duoshou/api --prod deploy /output

# pnpm deploy copies declared deps but may skip the Prisma-generated `.prisma/`
# directory (it isn't a package). Copy it over explicitly so runtime finds the
# generated client. Same for @prisma/client's internal node_modules that hold
# the engine binary.
RUN cp -r /app/node_modules/.prisma /output/node_modules/.prisma 2>/dev/null \
    || cp -r /app/apps/api/node_modules/.prisma /output/node_modules/.prisma 2>/dev/null \
    || echo "No .prisma directory found (checking for @prisma/client only variant)"

# -------- Runtime stage --------
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=build /output/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/main.js"]
