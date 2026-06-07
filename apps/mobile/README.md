# @tahawash/mobile

> Tahawash customer mobile app — Expo + React Native.

## Quick start (Phase 0 — Expo Go test)

```bash
# From the monorepo root:
pnpm --filter @tahawash/mobile start:go
```

This starts the dev server in **tunnel mode** (uses ngrok internally, works across networks). Scan the QR code with the Expo Go app on your phone.

> **Note:** Phase 0 scaffold uses only Expo Go-compatible libraries. Phase 2 adds native modules (Mapbox, vision-camera, MMKV) which require a **dev client build** via `eas build --profile development`.

## Tech stack

- **Expo SDK 52** + **React Native 0.76** (New Architecture / Fabric enabled)
- **Expo Router 4** (file-based routing, typed routes)
- **NativeWind v4** (Tailwind for RN — same tokens as `@tahawash/admin`)
- **react-native-safe-area-context** + **react-native-screens**
- **react-native-reanimated 3** + **react-native-gesture-handler**
- **react-native-svg** (for the Tahawash logo + future custom icons)
- **i18next** + **react-i18next** + **expo-localization** (AZ/RU/EN)
- **TanStack Query** (server state — wired in Phase 2)
- **Zustand** (client state — wired in Phase 2)

## Scripts

| Script | Purpose |
|---|---|
| `pnpm start` | Start with dev client (after EAS dev build) |
| `pnpm start:go` | Tunnel mode for Expo Go testing |
| `pnpm android` | Launch on connected Android |
| `pnpm ios` | Launch on iOS Simulator (Mac required) |
| `pnpm prebuild` | Generate native `ios/` + `android/` folders (rare) |
| `pnpm type-check` | TypeScript without emit |

## Structure

```
app/
└── _layout.tsx           Root layout (gesture handler + safe area + stack)
└── index.tsx             Phase 0 placeholder landing screen

src/
├── global.css            NativeWind base styles
├── i18n/
│   ├── index.ts          i18next + expo-localization setup
│   └── locales/
│       ├── az.json
│       ├── ru.json
│       └── en.json
└── components/
    └── brand/
        └── logo.tsx      Tahawash water-drop SVG
```

## Design tokens

Tokens are defined inline in `tailwind.config.js` and mirror `@tahawash/admin` exactly (same hex values). The shared **TypeScript** token export will arrive in `packages/shared-utils` once that workspace is wired up.

## EAS

`eas.json` defines four channels: development / preview / staging / production. EAS account linking happens in Phase 0 final stage (Stage 0.12) — until then `expo start` works locally without EAS access.
