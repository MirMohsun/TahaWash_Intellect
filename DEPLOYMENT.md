# Tahawash — Deployment Runbook

End-to-end guide to deploying the backend + admin to Railway, then building
an Android APK via EAS. Follow top-to-bottom on a fresh deploy.

Expected total time: **~60–90 minutes** (mostly waiting for builds).

Expected cost (Railway): **~$10–25/month** with Postgres + Redis + 2 web
services + bandwidth. EAS Build is free for the volume we need.

---

## Prerequisites

You should have already:

- [x] Created a Railway account ([railway.com](https://railway.com)) and signed in.
- [x] Created an Expo account ([expo.dev](https://expo.dev)) — the same login is used by EAS.
- [ ] Installed the EAS CLI locally: `pnpm add -g eas-cli`
- [ ] Logged into EAS locally: `eas login`
- [ ] Run `eas init` inside `apps/mobile/` to create the EAS project (only needed once — populates the empty `projectId` in `app.config.ts`).

Optional but recommended for the APK to be useful:

- [ ] Mapbox public access token from [account.mapbox.com](https://account.mapbox.com) (free tier — 50k loads/month). Without this the map will be blank.

---

## Part 1 — Deploy the backend to Railway

### 1.1 Create the Railway project

1. Open [railway.com/new](https://railway.com/new).
2. Click **"Deploy from GitHub repo"**.
3. Authorize Railway to access the `rustamakbarli27/tahawash` repo if it isn't already connected.
4. Select the `tahawash` repo. Railway will start creating the project but will pick the wrong root by default — we'll fix that next.

### 1.2 Add PostgreSQL (with PostGIS)

The default Railway Postgres template **does not** ship with PostGIS.
Our initial migration declares `CREATE EXTENSION postgis` (and three
helper extensions), so we need an image that has them.

Easiest path:

1. In the Railway project, click **"+ New"** → **"Database"** → **"Add PostgreSQL"** for the standard image first.
2. Open the new Postgres service → **Settings** → **"Source"** → **"Docker Image"**.
3. Replace the image with: `postgis/postgis:16-3.4-alpine`
4. Click **Deploy** and wait for it to come up.
5. Verify by clicking **"Connect"** → opening the Data tab → if you can connect, the extension support is there. (PostGIS itself will be created when our migration runs.)

If Railway has updated their PostgreSQL template to support PostGIS by the
time you read this, you can use that instead — but verify the extension is
available before deploying the backend.

### 1.3 Add Redis

1. Click **"+ New"** → **"Database"** → **"Add Redis"**. Default image is fine.
2. Wait for it to come up.

### 1.4 Configure the backend service

The backend service was auto-created by step 1.1. Now configure it:

1. Click the backend service in the project canvas.
2. **Settings** tab → **Root Directory** → set to: `apps/backend` ... **WAIT.**
   Actually, don't. Our Dockerfile expects the build context to be the
   monorepo ROOT (so it can copy the workspace). Leave Root Directory at
   `/` (the repo root) and let `railway.json` (already in `apps/backend/`)
   handle the build via `dockerfilePath`.

   Specifically: in **Settings** → **Build** → confirm:
   - Builder: **Dockerfile**
   - Dockerfile Path: `apps/backend/Dockerfile`
   - Root Directory: `/` (empty / repo root)

   If Railway didn't auto-detect this, set them manually. Our `railway.json`
   tells Railway what to do, but a fresh service sometimes needs the
   Dockerfile path nudged.

3. **Settings** → **Networking** → **"Generate Domain"**. Pick a name like
   `tahawash-api.up.railway.app`. **Save this URL — you'll need it.**

### 1.5 Backend environment variables

Click **Variables** tab on the backend service. Add the following:

```ini
NODE_ENV=production
PORT=3000

# Reference variables — Railway auto-resolves these from the
# Postgres + Redis services in the same project.
# In the Variables UI, click "+ New Variable" → "Add Reference" and
# pick "Postgres → DATABASE_URL" and "Redis → REDIS_URL".
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# JWT secrets — STRONG random values. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Or use these (one-time-generated for you):
JWT_ACCESS_SECRET=5796399e6ef7567a4b52dcd168eabc37ea0c5905fd14fdabc20f8e547b136bde
JWT_REFRESH_SECRET=b6f8f82677cf109c043589cec8bd93d05ec0a8bafe63530e16b7758b53d8f4a8

JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Mock providers for now — swap in when you sign up for SMS / FCM / Resend.
SMS_PROVIDER=mock
PUSH_PROVIDER=mock
EMAIL_PROVIDER=mock

EMAIL_FROM=Tahawash <noreply@tahawash.az>

# Public URLs (set after admin is deployed; for now any valid URL works).
PUBLIC_APP_URL=https://app.tahawash.az
ADMIN_APP_URL=https://REPLACE-ME-AFTER-ADMIN-DEPLOYED.up.railway.app

# CORS — comma-separated list. Set after the admin URL is known.
# Temporarily set to "*" if you need to test before the admin is up; tighten before any real user logs in.
CORS_ORIGINS=https://REPLACE-ME-AFTER-ADMIN-DEPLOYED.up.railway.app
```

After saving, Railway will redeploy automatically. **Watch the deploy logs**
in the "Deployments" tab. Expect:

- Docker build: ~3–5 minutes (slow first time, cached after).
- `prisma migrate deploy` runs on every boot — should report "All migrations have been successfully applied."
- App listens on `0.0.0.0:3000`.

### 1.6 Verify the backend

1. Open `https://YOUR-BACKEND-DOMAIN/health` in a browser. Expected: `{"status":"ok",...}`
2. Open `https://YOUR-BACKEND-DOMAIN/api/docs`. Expected: Swagger UI.
3. If either fails, check **Logs** tab for stack traces.

### 1.7 Seed the dev super-admin

The production DB is empty. We need a super-admin to log into the admin panel.

1. In Railway, click the backend service → top-right menu → **"Open Shell"**.
2. Run: `pnpm exec prisma db seed`
3. Wait ~10 seconds. Expected output ends with: `✅ Seed complete.`
4. The seed creates:
   - super-admin login: `admin` / `tahawash-dev-2026`
   - 1 demo tenant "YuBox" + tenant login `yubox` / `yubox-dev-2026`
   - a few demo locations, bays, transactions, customers.

> ⚠ **CHANGE THE SUPER-ADMIN PASSWORD ASAP after first login.** The seed
> password is published in this repo. We don't have a "change super-admin
> password" UI yet — for now, edit the row directly via `prisma studio` over
> the Railway shell, or wait until that screen is built.

---

## Part 2 — Deploy the admin to Railway

### 2.1 Create the admin service

1. In the same Railway project, click **"+ New"** → **"Empty Service"**.
2. Open the new service → **Settings** → **Source** → **"Connect Repo"** → select `rustamakbarli27/tahawash`, branch `main`.
3. **Settings** → **Build**:
   - Builder: **Dockerfile**
   - Dockerfile Path: `apps/admin/Dockerfile`
   - Root Directory: `/` (empty / repo root)
4. **Settings** → **Networking** → **"Generate Domain"**. **Save this URL.**

### 2.2 Admin environment variables

Click **Variables** tab. The admin needs build-time Vite vars:

```ini
# REQUIRED — base URL of the backend you deployed in Part 1.
VITE_API_URL=https://YOUR-BACKEND-DOMAIN

# Optional but the map will be blank without it.
VITE_MAPBOX_TOKEN=

# Optional.
VITE_SENTRY_DSN=
VITE_POSTHOG_API_KEY=

# Railway-specific — Caddy reads $PORT to bind. Railway injects this
# automatically but we set it explicitly for clarity.
PORT=8080
```

Save. Railway will redeploy. **Watch the Build logs** — Vite freezes
`VITE_API_URL` into the bundle at build time, so changing it later requires
a fresh build (Railway handles this automatically on var changes).

### 2.3 Wire CORS back to the backend

Now you know the admin URL. Update the backend's CORS:

1. Go back to the **backend service** → **Variables**.
2. Update `CORS_ORIGINS` to the admin URL: `https://YOUR-ADMIN-DOMAIN`
3. Update `ADMIN_APP_URL` to the same URL.
4. Save. Backend redeploys.

### 2.4 Verify the admin

1. Open `https://YOUR-ADMIN-DOMAIN` in a browser. Expected: tenant admin login page.
2. Open `https://YOUR-ADMIN-DOMAIN/super-admin/login`. Expected: super-admin login.
3. Log in as `admin` / `tahawash-dev-2026`.
4. Expected: super-admin dashboard renders with real (seeded) data.
5. Open the browser DevTools → Network tab. Confirm requests to `https://YOUR-BACKEND-DOMAIN/*` succeed with 200, not CORS errors.

---

## Part 3 — Build the Android APK with EAS

### 3.1 Initialize the EAS project (one-time)

If you haven't already:

```bash
cd c:/Users/user/Desktop/YuBox/apps/mobile
eas login            # opens browser to authenticate
eas init             # creates the EAS project, writes projectId into app.config.ts
```

This will commit a change to `apps/mobile/app.config.ts` populating the
`extra.eas.projectId` field. Commit and push that change.

### 3.2 Point the preview profile at the deployed backend

Open `apps/mobile/eas.json` and find the `preview` profile. Replace
`REPLACE_WITH_RAILWAY_BACKEND_URL` with your actual backend URL:

```jsonc
"preview": {
  "distribution": "internal",
  "channel": "preview",
  "android": { "buildType": "apk" },
  "env": {
    "EXPO_PUBLIC_API_URL": "https://YOUR-BACKEND-DOMAIN"
  }
}
```

Also add `EXPO_PUBLIC_MAPBOX_TOKEN` to the env block if you have one:

```jsonc
"env": {
  "EXPO_PUBLIC_API_URL": "https://YOUR-BACKEND-DOMAIN",
  "EXPO_PUBLIC_MAPBOX_TOKEN": "pk.your-public-token"
}
```

Commit + push.

### 3.3 Build the APK

```bash
cd c:/Users/user/Desktop/YuBox/apps/mobile
eas build -p android --profile preview
```

This will:
1. Upload your source to EAS Build (~2 minutes).
2. Queue the build on Expo's infrastructure.
3. Run the build (~15–25 minutes for first build; subsequent builds reuse cache).
4. Print a download URL when done.

You can also watch progress in the Expo dashboard: [expo.dev/accounts/YOUR_USERNAME/projects/tahawash/builds](https://expo.dev).

### 3.4 Install the APK on your Android phone

1. On the Android phone, open the APK URL the build printed (or scan the QR code on the Expo build page).
2. Browser may warn about unknown sources — allow it.
3. Tap the APK → Install.
4. Open Tahawash.

### 3.5 Smoke-test the APK

Open the app and verify:

- [ ] App boots past splash, lands on phone-entry screen.
- [ ] Enter any `+994` number → tap continue → OTP screen appears.
- [ ] **OTP code** — open Railway → backend service → **Logs** tab. The OTP code printed there (e.g. `OTP for +994501234567: 123456`). Enter it on the phone.
- [ ] OTP success → lands on Wash tab. Map renders (blank if no Mapbox token).
- [ ] Bottom tabs work: Main / Wash / Scan / History / Profile.
- [ ] In Profile → Language → swap to AZ → app reloads in Azerbaijani.
- [ ] Scan tab opens the camera. (Won't find a QR unless you print one from the admin.)

If any of this fails, check **Railway backend Logs** + Expo build details
for clues.

---

## Common issues + fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend build fails: `Cannot find module '@prisma/client'` | Prisma generate didn't run | Confirm `prisma generate` runs in the Dockerfile build stage |
| Backend boots but `prisma migrate deploy` fails on `CREATE EXTENSION postgis` | Postgres service doesn't have PostGIS | Switch the Postgres image to `postgis/postgis:16-3.4-alpine` (see 1.2) |
| Admin loads but DevTools shows CORS errors | Backend `CORS_ORIGINS` doesn't include the admin URL | Update `CORS_ORIGINS` in the backend Variables (no trailing slash) |
| Admin login: "Network error" | Admin built with wrong `VITE_API_URL` | Update `VITE_API_URL` in admin Variables → Railway rebuilds + redeploys |
| APK installs but app shows "network error" | `EXPO_PUBLIC_API_URL` in `preview` profile wrong, OR Android blocks cleartext HTTP | Confirm URL is HTTPS in `eas.json` `preview.env` → rebuild |
| OTP never arrives | SMS provider is `mock` — OTP only prints to backend log | Check Railway backend Logs for `OTP for +994...` |
| EAS build fails with `Mapbox token required` | Mapbox plugin needs a token at build time | Either add a Mapbox token to eas.json `preview.env`, or remove the Mapbox plugin temporarily |

---

## What's still pending after this deploy

These are unrelated to the deploy — listed here so the picture is honest:

- **No real SMS** — OTP codes only appear in Railway logs.
- **No real payment** — `pay` button in mobile fakes credit.
- **No real push** — push provider is mock.
- **No real password-reset email** — Resend not wired.
- **No image uploads** — R2 not wired; admin image fields are URL strings.
- **No hardware** — MQTT adapter mocks the relay. No water flows.
- **Legal docs / app version / platform settings tables are empty** — these
  tables exist in the prod DB but have no published values. Mobile/admin
  surfaces fall back to bundled defaults.
- **Super-admin password is the public seed value.** Change ASAP after first login.

When you sign up for the deferred services (SMS provider, FCM, Resend, R2,
Mapbox, ePoint), come back and replace the corresponding Railway env vars +
redeploy. Code is ready to switch from `mock` to real provider via env.

---

## Re-deploying after code changes

Every push to `main` triggers Railway to rebuild + redeploy both services
automatically. `prisma migrate deploy` runs on every backend boot so new
migrations land safely.

For mobile, every change to `eas.json` env requires a fresh `eas build`. Use
EAS Update (`eas update`) for JS-only changes to avoid full APK rebuilds:

```bash
cd apps/mobile
eas update --branch preview --message "..."
```

The APK already installed will pull the new JS bundle on next launch.
