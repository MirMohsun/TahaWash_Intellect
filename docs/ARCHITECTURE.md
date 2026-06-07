# Tahawash — Architecture

> System architecture, data flow, integration points.

## Overview

```
                    ┌─────────────────────┐
                    │   TAHAWASH (SaaS)   │
                    │                     │
                    │  Super-admin web    │
                    │  Customer mobile    │
                    │  Tenant admin web   │
                    └──────────┬──────────┘
                               │
                       ┌───────┴────────┐
                       │  BACKEND API   │
                       │  (NestJS)      │
                       └───┬────┬────┬──┘
                           │    │    │
                  ┌────────┘    │    └────────┐
                  ▼             ▼             ▼
            ┌─────────┐   ┌─────────┐   ┌─────────┐
            │PostgreSQL│   │ Redis  │   │   R2    │
            │   16    │   │(cache+ │   │(files)  │
            │+PostGIS │   │ queue) │   │         │
            └─────────┘   └─────────┘   └─────────┘
                  │             │
                  ▼             ▼
            External services:
              ePoint (payments)
              Mapbox (maps)
              FCM (push)
              Resend (email)
              Sentry / PostHog
              MQTT broker (hardware, Phase 5+)
```

## Apps

### `apps/backend` — NestJS API
- Multi-tenant via `tenant_id` column + Prisma middleware + guards
- JWT auth (15-min access + 30-day refresh, rotation enabled)
- BullMQ for background jobs (subscription expiry notifier, push delivery, hardware credit timeout watcher)
- 14+ modules (auth, tenants, locations, bays, transactions, etc.)

### `apps/mobile` — Expo + React Native
- Customer-facing app (iOS + Android)
- Phone + OTP auth
- Scan → Charge → Pay → Hardware credit flow ("Magic Moment")
- File-based routing via Expo Router
- NativeWind v4 styling
- EAS Build/Submit/Update pipeline

### `apps/admin` — React + Vite
- Tenant admin + super-admin in one app (role-routed)
- Per-tenant theming via CSS variables loaded at login
- Tailwind + shadcn/ui
- TanStack Router + Query

## Shared packages

- `shared-types` — domain interfaces (Tenant, Customer, Transaction, etc.)
- `shared-utils` — formatAZN, formatAzPhone, formatDateBaku, validation helpers
- `api-client` — typed axios wrapper with auth refresh interceptor
- `i18n-locales` — AZ/RU/EN translation JSON files

## Environments

| Env | Backend | DB | ePoint | Mobile channel |
|---|---|---|---|---|
| local | localhost:3000 | local Docker PG | mock | dev client |
| staging | staging-api.tahawash.az | Railway PG (staging) | test mode | staging |
| production | api.tahawash.az | Railway PG (prod) | live | production |

## Data flow — the Magic Moment

1. Customer scans QR sticker on wash bay
2. App calls `GET /public/devices/:short_id` → backend returns device + tenant config
3. Customer sets amount on charge screen
4. App calls `POST /payments` → backend creates transaction, returns ePoint payment URL
5. ePoint hosted page → user confirms (Apple Pay / Google Pay / saved card)
6. ePoint webhook → `POST /webhooks/epoint` → backend marks transaction paid
7. Backend pushes credit command to hardware via MQTT
8. Hardware ACKs → backend updates transaction status to "credited"
9. App polls / SSE / WebSocket receives confirmation → shows success
10. If hardware fails to ACK in 30s → transaction marked "Paid – Hardware error"

## Multi-tenancy

- Every business-data table has `tenant_id` (NOT NULL, foreign key)
- Prisma middleware auto-scopes queries based on JWT context
- Super-admin context bypasses scoping
- Customer context scoped to own data only (transactions, favorites, etc.)

## Status

**Phase 0 — Pre-development setup** (monorepo bootstrap complete).

See `BUILD_PLAN.md` in project memory for full phased plan.
