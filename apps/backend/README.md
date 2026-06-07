# @tahawash/backend

> NestJS API for the Tahawash platform.

## Quick start

```bash
# From the monorepo root:
docker compose up -d                  # start PG + Redis
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @tahawash/backend prisma:generate
pnpm --filter @tahawash/backend dev   # starts on http://localhost:3000
```

Then visit:
- `http://localhost:3000/health` — liveness
- `http://localhost:3000/health/ready` — readiness (pings DB)
- `http://localhost:3000/api/docs` — Swagger UI

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start in watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run compiled `dist/main` |
| `pnpm type-check` | TypeScript without emit |
| `pnpm test` | Jest unit tests |
| `pnpm test:e2e` | Jest e2e tests |
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:migrate:dev` | Create + apply migration locally |
| `pnpm prisma:studio` | Open Prisma Studio (DB GUI) |

## Structure

```
src/
├── main.ts                      Bootstrap
├── app.module.ts                Root module
├── config/
│   └── env.schema.ts            Zod-validated env vars
└── modules/
    ├── prisma/                  Prisma client wrapper (global)
    └── health/                  /health + /health/ready endpoints
```

More modules will be added in Phase 1 (auth, tenants, locations, bays, transactions...).

See the monorepo root `docs/ARCHITECTURE.md` for the full system picture.
