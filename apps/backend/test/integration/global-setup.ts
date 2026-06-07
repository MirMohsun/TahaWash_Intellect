import { execSync } from 'node:child_process';
import * as path from 'node:path';

/**
 * Global setup — runs ONCE before any integration test.
 *
 * Applies the current Prisma schema (all migrations) against the test
 * database. The DB itself must exist; if missing, prisma migrate will
 * throw P1003 and the user creates it manually (see jest.config.cjs
 * comment for the createdb command).
 *
 * We don't seed here — each test suite is responsible for its own
 * fixtures via `helpers/fixtures.ts` so suites stay independent.
 */
export default async function globalSetup(): Promise<void> {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5434/tahawash_test';

  // eslint-disable-next-line no-console
  console.log('[integration] applying Prisma migrations to test DB...');

  const backendRoot = path.resolve(__dirname, '..', '..');
  try {
    execSync('pnpm exec prisma migrate deploy', {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'pipe',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[integration] Failed to apply migrations to ${testDbUrl}.\n\n` +
        `Common causes:\n` +
        `  - test database doesn't exist yet. Create it once with:\n` +
        `      docker compose exec postgres psql -U postgres -c "CREATE DATABASE tahawash_test;"\n` +
        `  - Postgres container not running. Start with: docker compose up -d\n\n` +
        `Original error:\n${message}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('[integration] migrations applied.');
}
