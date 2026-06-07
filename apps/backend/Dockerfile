# syntax=docker/dockerfile:1.7
# Tahawash backend — Railway-ready container.
#
# Multi-stage:
#   1. base   — Node 22 + pnpm + OpenSSL (Prisma needs libssl)
#   2. deps   — install ALL deps for the workspace (frozen lockfile)
#   3. build  — generate Prisma client + build the NestJS app
#   4. runner — slim runtime stage; copies dist + node_modules + prisma files
#
# Why Debian slim (not alpine):
#   - bcrypt is a native dep; building on alpine (musl) needs python+make+g++.
#   - Prisma's distroless engine plays best with glibc; alpine needs special
#     binary targets in schema.prisma. Avoid the headache.
#
# Build context: the monorepo ROOT (not apps/backend). Railway is configured
# to use this Dockerfile via railway.json's `dockerfilePath` field.

# ─── 1. Base — node + pnpm + system libs ─────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate

# OpenSSL for Prisma's query engine; tini for proper PID-1 signal handling.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app


# ─── 2. Deps — install the entire workspace ──────────────────────
FROM base AS deps

# Copy lockfile + workspace manifest first so this layer caches across changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./

# Copy ONLY package.json files from every workspace project so pnpm can
# resolve the dependency graph without copying all source code yet.
COPY apps/backend/package.json apps/backend/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/api-client/package.json packages/api-client/
COPY packages/i18n-locales/package.json packages/i18n-locales/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/

# pnpm.patchedDependencies references files in patches/ — must be present
# before `pnpm install` or it fails with ENOENT. The mobile-only patch for
# expo-modules-core lives here; it's harmless to copy into the backend image.
COPY patches ./patches

# Install everything (with native deps built via pnpm hooks).
# We need devDependencies in the build stage for `nest build` and `prisma generate`.
# Note: no --mount=type=cache here — Railway's Metal builder requires
# cache-mount ids to be scoped with a cacheKey prefix, which is finicky
# across builders. Trading off slower first builds for portability.
RUN pnpm install --frozen-lockfile


# ─── 3. Build — generate Prisma client + compile NestJS ──────────
FROM deps AS build

# Copy backend source + Prisma schema + shared packages (the backend imports them).
COPY apps/backend ./apps/backend
COPY packages ./packages
COPY tsconfig*.json ./

# Generate Prisma Client (writes to node_modules/.prisma/client).
RUN pnpm --filter @tahawash/backend exec prisma generate

# Compile TypeScript → dist/main.js.
RUN pnpm --filter @tahawash/backend build


# ─── 4. Runner — slim production image ───────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000

# pnpm fetch all production deps into a clean store, then assemble.
# Easier: just copy node_modules from the build stage. Slightly bigger image
# but simpler and reliable for a monorepo with workspace deps.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./

WORKDIR /app/apps/backend

# Healthcheck — Railway will probe via the in-app /health endpoint instead;
# this is here in case anyone runs the container outside Railway.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini → handles SIGTERM properly so Railway's rolling restarts shut down cleanly.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command. Railway can override via railway.json's startCommand if needed.
# We run migrations on every deploy via the railway.json startCommand wrapper,
# so this default is just the app server.
CMD ["node", "dist/main.js"]
