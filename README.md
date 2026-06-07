# Tahawash

> Self-service carwash payment platform for Azerbaijan.

Customers scan a QR code on a wash bay, pay any amount with their phone, and the wash box is automatically credited — no cash, no coins.

---

## Architecture

Monorepo managed with **pnpm workspaces** + **Turborepo**.

```
tahawash/
├── apps/
│   ├── mobile/             Expo + React Native customer app (iOS + Android)
│   ├── admin/              React + Vite — tenant admin + super-admin (single app, role-routed)
│   └── backend/            NestJS API
│
├── packages/
│   ├── shared-types/       Domain TypeScript types used by all apps
│   ├── shared-utils/       Currency, date, phone formatting helpers
│   ├── api-client/         Typed axios wrapper used by mobile + admin
│   └── i18n-locales/       AZ / RU / EN translation files (shared)
│
├── docs/
│   ├── ARCHITECTURE.md     System design + data flow
│   ├── RUNBOOK.md          Ops tasks (deploy, restore, rotate secrets, etc.)
│   └── ADRs/               Architectural Decision Records
│
├── .github/workflows/      CI/CD pipelines
├── Design_Mobile_App/      Reference designs (mobile high-fi mockups)
└── Design_Admin_Panels/    Reference designs (admin inspiration)
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native, Expo SDK 52+, EAS Build/Submit/Update |
| Web admin | React 18, Vite, TypeScript, Tailwind, shadcn/ui |
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Hosting | Railway (backend + DB + admin), Cloudflare R2 (files), Cloudflare DNS+CDN |
| Payments | ePoint (Azerbaijan) |
| Maps | Mapbox |
| Push | Firebase Cloud Messaging via `expo-notifications` |
| Email | Resend |
| Monitoring | Sentry + PostHog |

See `docs/ARCHITECTURE.md` for the full picture.

---

## Prerequisites

- **Node 22 LTS** (pinned in `.nvmrc`)
- **pnpm 10+**
- **Docker Desktop** (for local PostgreSQL + Redis)
- **Git** with credential manager configured for GitHub

---

## First-time setup

```bash
# 1. Clone (skip if already done)
git clone https://github.com/rustamakbarli27/tahawash.git
cd tahawash

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.example .env
# (then fill in real values — see ARCHITECTURE.md)

# 4. Start local infrastructure (PostgreSQL + Redis via Docker)
docker compose up -d

# 5. Run everything in dev mode (parallel)
pnpm dev
```

---

## Common commands

```bash
pnpm dev              # Run all apps in dev mode (parallel)
pnpm build            # Build all apps
pnpm lint             # Lint all apps
pnpm test             # Run tests
pnpm type-check       # TypeScript type check
pnpm format           # Auto-format all files with Prettier
pnpm format:check     # Check formatting without changes
pnpm clean            # Clear build outputs + node_modules
```

Per-app commands (e.g. only run mobile):

```bash
pnpm --filter mobile dev
pnpm --filter backend dev
pnpm --filter admin dev
```

---

## Project status

Active development. Currently in **Phase 0 — Pre-development setup**.

See:

- `docs/ARCHITECTURE.md` — system architecture
- `docs/RUNBOOK.md` — operational procedures

---

## License

Proprietary. © Tahawash. All rights reserved.
