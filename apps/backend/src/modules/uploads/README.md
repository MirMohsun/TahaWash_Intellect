# Uploads (Cloudflare R2)

Direct **browser → R2** uploads via presigned PUT URLs. The Railway backend
signs a one-time URL; the file bytes go straight to R2 and never touch our
server.

```
browser ──(1) POST /tenant/me/uploads/sign──▶ backend ──signs──▶ R2
browser ──(2) PUT file ─────────────────────────────────────────▶ R2
browser ──(3) PATCH /tenant/me {logoUrl} OR POST /tenant/me/photos {url}──▶ backend (persist)
```

## Bucket CORS — required for browser uploads

A browser PUT to `https://<bucket>.<account>.r2.cloudflarestorage.com/...`
is cross-origin, so it triggers a CORS preflight. **The policy must live on
the R2 bucket itself** — the backend's own `enableCors` only governs
browser → backend calls, not browser → R2.

### Automatic (preferred)

On boot, `R2Service.onModuleInit()` calls `ensureCors()` which `PutBucketCors`
with the origins from `CORS_ORIGINS`, merging any origins already on the
bucket. This needs an R2 API token with **bucket-settings** permission
("Admin Read & Write"). If the token lacks it, boot logs a warning with the
exact policy to paste manually (see below) — uploads stay broken until you do.

### Manual (Cloudflare dashboard)

R2 → your bucket → **Settings → CORS Policy → Edit**, paste (swap in your
real admin origin(s)):

```json
[
  {
    "AllowedOrigins": [
      "https://valiant-appreciation-production-5a8c.up.railway.app",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`AllowedOrigins` must match the admin app origin **exactly** (scheme + host +
port, no trailing slash, no path).

## Checksum gotcha (why uploads can fail even with CORS set)

AWS SDK v3 (≥ 3.729) adds a CRC32 checksum to `PutObject` by default. For a
**presigned** PUT that checksum is computed over the *empty* command body at
sign time and baked into the URL as `x-amz-checksum-crc32`, so the real file
the browser uploads fails the check. `R2Service` sets
`requestChecksumCalculation: 'WHEN_REQUIRED'` to stop this. Don't remove it.

## Size enforcement

`signPut` binds `ContentLength` into the signature from the DTO's `sizeBytes`,
so R2 rejects any upload whose actual size differs from what was signed — the
8 MB `@Max` cap is a hard limit, not an honor-system claim.

## Orphan cleanup

Every signed key is logged to `UploadedFile`. A daily cron
(`OrphanFileCleanupService`, 00:15 Asia/Baku) lists the bucket, builds the set
of keys referenced by live records (tenant logo, tenant/location photos, promo
images), and deletes any object that is unreferenced **and** older than 24 h.
