# Tahawash — Runbook

> Operational procedures for common tasks. Keep this updated as we learn what breaks.

## Daily / common tasks

### Run all apps locally
```bash
pnpm dev
```

### Run just one app
```bash
pnpm --filter backend dev
pnpm --filter admin dev
pnpm --filter mobile dev
```

### Start local infrastructure (PostgreSQL + Redis)
```bash
docker compose up -d
docker compose ps             # verify running
docker compose down           # stop
docker compose down -v        # stop + wipe data
```

### Run migrations
```bash
pnpm --filter backend prisma:migrate:dev
```

### Seed local database
```bash
pnpm --filter backend prisma:seed
```

---

## Deployment

### Backend → Railway
- Triggered by push to `main` (via GitHub Actions → Railway deploy hook)
- Staging deploys from `staging` branch
- Manual rollback: in Railway dashboard, redeploy a previous build

### Admin → Railway
- Same pattern as backend.

### Mobile → EAS
```bash
# Build for staging (internal install)
eas build --profile staging --platform all

# Submit to App Store + Play Store
eas submit --profile production --platform all

# OTA hotfix (no rebuild needed for JS changes)
eas update --branch production --message "fix: ..."
```

---

## Secrets & environment variables

- **Local:** `.env` file (never committed)
- **Railway:** Set via Railway dashboard → variables tab per service
- **EAS:** Set via `eas secret:create` (for build-time) or `.env.production`

Rotation procedure: TBD (document when first rotation happens).

---

## Backups & recovery

- **PostgreSQL:** Railway automatic daily snapshots (7-day retention dev, 30-day prod)
- **R2 files:** Versioning enabled on bucket
- **Code:** Git on GitHub (mirrored locally on dev machine)

Recovery time objective: ≤4 hours.

---

## Incident response

TBD. To be filled in as incidents occur.

---

## Status

**Phase 0** — most procedures here will be filled in as we actually use them.
