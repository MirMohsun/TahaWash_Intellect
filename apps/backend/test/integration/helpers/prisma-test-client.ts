import { PrismaClient } from '@prisma/client';
import { tenantScopingExtension } from '../../../src/modules/prisma/tenant-scoping.extension';

/**
 * Build a fresh PrismaClient + scoping extension for integration tests.
 *
 * Pointed at TEST_DATABASE_URL (defaults to localhost:5434/tahawash_test).
 * Returns two clients:
 *   - `raw`: bare PrismaClient — used for test setup / assertions where
 *     scoping should be skipped (e.g. "verify what's actually in the DB
 *     regardless of actor").
 *   - `scoped`: extended client — exercises the multi-tenancy extension
 *     end-to-end. This is what production service code uses.
 *
 * Both clients share the same connection. `disconnect()` closes both.
 */
export interface TestPrismaClients {
  raw: PrismaClient;
  scoped: PrismaClient;
  disconnect: () => Promise<void>;
}

export async function createTestPrismaClients(): Promise<TestPrismaClients> {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5434/tahawash_test';

  const raw = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
  await raw.$connect();

  // Cast through unknown — Prisma's $extends return type is wider than the
  // public PrismaClient interface but covers all the methods we use.
  const scoped = raw.$extends(tenantScopingExtension()) as unknown as PrismaClient;

  return {
    raw,
    scoped,
    disconnect: () => raw.$disconnect(),
  };
}
