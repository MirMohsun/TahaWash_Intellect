import { z } from 'zod';

/**
 * Tahawash backend environment schema.
 *
 * Validated at startup via @nestjs/config. If any required variable is
 * missing or malformed, the application refuses to boot. This is the
 * single source of truth for what env vars the backend needs.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // Cache + queue
  REDIS_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // SMS for OTP. `mock` logs OTP codes to console (dev only).
  // Real AZ providers will be added when one is contracted.
  SMS_PROVIDER: z.enum(['mock', 'albatros', 'lifecell']).default('mock'),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().default('Tahawash'),

  // Push notifications.
  //   - `mock` logs to console (dev).
  //   - `expo` delivers real device pushes via Expo's Push API (the app mints
  //     ExponentPushTokens). Expo relays to FCM/APNs — so the Expo PROJECT must
  //     have FCM credentials uploaded for Android to actually receive.
  //   - `fcm` (direct Firebase) is not implemented; use `expo`.
  PUSH_PROVIDER: z.enum(['mock', 'expo', 'fcm']).default('mock'),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  // Optional Expo access token for "enhanced security" push sending. When set,
  // it's sent as a Bearer token so only holders can push on this project's
  // behalf. Recommended in production; not required for delivery to work.
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // Email. `mock` logs to console; `resend` posts to the Resend API
  // (wired when the account + domain DNS are provisioned).
  EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  RESEND_API_KEY: z.string().optional(),
  /** From-address used for all transactional email. */
  EMAIL_FROM: z.string().default('Tahawash <noreply@tahawash.az>'),

  // Public-facing URL used inside QR codes (Universal Links + App Links).
  PUBLIC_APP_URL: z.string().url().default('https://app.tahawash.az'),

  // Public-facing admin URL — emailed inside password-reset links so
  // tenant staff land on the right hostname for each environment.
  ADMIN_APP_URL: z.string().url().default('http://localhost:5173'),

  // CORS allowlist — comma-separated list of allowed origins (no trailing
  // slash). Defaults to dev URLs. In production, set the deployed admin
  // domain(s) explicitly so nothing else can call this API from a browser.
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),

  // Cloudflare R2 (S3-compatible object storage) for tenant logos + photos.
  //   - All five vars are OPTIONAL at the schema level so dev/test envs
  //     without R2 still boot. The uploads endpoint returns 503 with a
  //     clear "uploads disabled" error when any required value is missing.
  //   - R2_ACCOUNT_ID is the Cloudflare account id (top of the R2 page).
  //   - R2_BUCKET is just the bucket name, e.g. "tahawash-uploads".
  //   - R2_PUBLIC_BASE_URL is what gets stored in DB + served to clients;
  //     points at the bucket's r2.dev URL OR a connected custom domain
  //     (cdn.tahawash.az). NO trailing slash.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validation function passed to @nestjs/config.
 * Throws a friendly aggregated error if env vars are invalid.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
