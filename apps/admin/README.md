# @tahawash/admin

> Tahawash admin web app — single app serving tenant admin + super-admin via role-based routing.

## Quick start

```bash
# From the monorepo root:
cp apps/admin/.env.example apps/admin/.env.local
pnpm --filter @tahawash/admin dev   # starts on http://localhost:5173
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build locally |
| `pnpm type-check` | TypeScript without emit |
| `pnpm lint` | ESLint |

## Tech stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** with Tahawash design tokens (brand-* / accent-* / ink-* / etc.)
- **shadcn/ui** primitive layer (`@/components/ui/`) — Button, Card, Input, Label so far
- **TanStack Router** (programmatic for Phase 0, will migrate to file-based later)
- **TanStack Query** for server state
- **react-hook-form + zod** for forms
- **i18next + react-i18next** for AZ/RU/EN
- **lucide-react** for icons
- **sonner** for toasts
- **date-fns + date-fns-tz** for Asia/Baku time

## Design tokens

Design tokens live in `src/index.css` as CSS variables (`--brand-500`, `--ink-900`, etc.). Tailwind's config (`tailwind.config.ts`) maps them to utility classes like `bg-brand-500`, `text-ink-700`, etc.

The token values mirror the mobile design system exactly (see project memory `project_yubox_DESIGN_SYSTEM_LOCKED.md`). Both apps share a single visual language.

## Per-tenant theming (later phase)

The admin will eventually load a tenant's brand profile at login and inject overrides for `--brand-500`, `--brand-600`, etc. via `ThemeProvider`. This is wired in Phase 1 once the backend can serve tenant brand assets.

## Structure

```
src/
├── main.tsx                Bootstrap
├── router.tsx              TanStack Router config
├── index.css               Tailwind directives + design token CSS variables
├── lib/
│   └── utils.ts            cn(), formatAZN(), formatAzPhone()
├── components/
│   ├── brand/
│   │   └── logo.tsx        Tahawash water-drop SVG
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── label.tsx
├── features/
│   └── auth/
│       └── login-page.tsx  Placeholder login (Phase 1.2 wires real auth)
└── i18n/
    ├── index.ts            i18next setup
    └── locales/
        ├── az.json
        ├── ru.json
        └── en.json
```
