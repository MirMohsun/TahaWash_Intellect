# ADR 0001 — Monorepo with pnpm workspaces + Turborepo

Date: 2026-05-27
Status: Accepted

## Context

Tahawash has three applications (mobile, web admin, backend) plus shared types, utilities, and translation files. We need a repository structure that:

- Lets the backend, admin, and mobile share TypeScript types end-to-end
- Avoids duplicating utilities (currency formatting, phone validation)
- Keeps shared i18n translation files in one place
- Supports fast incremental builds and caching
- Is hireable later if the team grows

## Decision

Single monorepo at `https://github.com/rustamakbarli27/tahawash`, managed by **pnpm workspaces** for dependency management and **Turborepo** for task orchestration.

Structure:

```
apps/
  mobile/      Expo + RN
  admin/       React + Vite
  backend/     NestJS
packages/
  shared-types/
  shared-utils/
  api-client/
  i18n-locales/
```

## Alternatives considered

1. **Three separate repos** — rejected: forces duplication of types, harder cross-cutting changes, three CI/CD pipelines to maintain.
2. **pnpm workspaces only (no Turbo)** — rejected: no caching, no parallel task graph, slow CI.
3. **Nx instead of Turborepo** — rejected: more powerful but more complex; Turbo is sufficient and lighter.
4. **Yarn workspaces** — rejected: pnpm is faster and uses less disk via hard links.

## Consequences

- Single `pnpm install` at root installs all apps' deps via hard-linked store
- Type changes in `packages/shared-types` propagate immediately to all apps
- `pnpm dev` runs all apps in parallel; `turbo` caches and skips unchanged tasks
- CI runs only what changed (Turbo's affected-only mode)
- Onboarding: one clone, one install, one command to run everything
