# syntax=docker/dockerfile:1.7
# Tahawash admin — Railway-ready container.
#
# Two-stage:
#   1. build  — install deps + run `vite build` → produces dist/
#   2. runner — Caddy serves the static SPA with index.html fallback
#                for client-side routing (TanStack Router)
#
# Build context: monorepo ROOT (Railway configured via railway.json's
# dockerfilePath).
#
# Build-time env vars:
#   VITE_API_URL          — REQUIRED — base URL of the deployed backend
#   VITE_MAPBOX_TOKEN     — optional; map renders blank without it
#   VITE_SENTRY_DSN       — optional
#   VITE_POSTHOG_API_KEY  — optional
#
# These must be passed to Railway as build-time ARG/env vars; Vite freezes
# them into the bundle at build time (NOT runtime). Changing them later
# requires a rebuild.

# ─── 1. Build ────────────────────────────────────────────────────
FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate

WORKDIR /app

# Workspace manifests first → cacheable layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/admin/package.json apps/admin/
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY packages/api-client/package.json packages/api-client/
COPY packages/i18n-locales/package.json packages/i18n-locales/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/

# pnpm.patchedDependencies references files in patches/ — must be present
# before `pnpm install` or it fails with ENOENT. The mobile-only patch for
# expo-modules-core lives here; it's harmless to copy into the admin image.
COPY patches ./patches

# Note: no --mount=type=cache here — Railway's Metal builder requires
# cache-mount ids to be scoped with a cacheKey prefix. Trading off
# slower first builds for portability.
RUN pnpm install --frozen-lockfile

# Source.
COPY apps/admin ./apps/admin
COPY packages ./packages
COPY tsconfig*.json ./

# Build-time public env vars. Railway sets these as ARGs (via service config)
# and Vite freezes them into the bundle.
ARG VITE_API_URL
ARG VITE_MAPBOX_TOKEN
ARG VITE_SENTRY_DSN
ARG VITE_POSTHOG_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_POSTHOG_API_KEY=$VITE_POSTHOG_API_KEY

RUN pnpm --filter @tahawash/admin build


# ─── 2. Runner — Caddy serves the static bundle ──────────────────
FROM caddy:2-alpine AS runner

# Copy built static assets.
COPY --from=build /app/apps/admin/dist /srv

# Caddy config: serve /srv, SPA fallback to index.html, gzip, cache headers.
COPY apps/admin/Caddyfile /etc/caddy/Caddyfile

# Railway injects $PORT; Caddyfile reads it.
EXPOSE 8080
