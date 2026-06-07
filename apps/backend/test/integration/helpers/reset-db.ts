import type { PrismaClient } from '@prisma/client';

/**
 * Truncate every business-data table in the test DB.
 *
 * `TRUNCATE ... RESTART IDENTITY CASCADE` is fast and resets sequences.
 * `_prisma_migrations` is excluded so we don't re-run migrations next time.
 *
 * Tables list is explicit (rather than introspecting schema) so adding
 * a new model surfaces in this list during code review.
 */
const TABLES = [
  // Children first (reverse FK order isn't strictly necessary with CASCADE,
  // but listing leaves first is good documentation).
  'audit_logs',
  'transactions',
  'subscriptions',
  'push_notifications',
  'featured_tenants',
  'promos',
  'saved_cards',
  'favorites',
  'customer_refresh_tokens',
  'customers',
  'bays',
  'location_photos',
  'locations',
  'tenant_photos',
  'service_displays',
  'tenant_refresh_tokens',
  'tenant_users',
  'tenants',
  'super_admin_refresh_tokens',
  'super_admin_users',
  'otp_codes',
  'app_versions',
  'legal_documents',
  'platform_settings',
  'uploaded_files',
];

export async function resetDb(prisma: PrismaClient): Promise<void> {
  // Single statement so Postgres commits atomically.
  // Quote each name to handle reserved-word edge cases.
  const stmt = `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`;
  await prisma.$executeRawUnsafe(stmt);
}
