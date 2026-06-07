/**
 * Tahawash backend — integration test Jest config.
 *
 * Distinct from the unit-test Jest config in package.json (which scans
 * src/ for `*.spec.ts`). This config:
 *   - Scans only `test/integration/` for `*.integration.spec.ts`
 *   - Uses the tsconfig.json next to it (allows imports from src/)
 *   - Runs tests sequentially via the npm script `--runInBand` flag —
 *     integration tests share a Postgres DB so parallel runs would
 *     race on truncate / seed.
 *   - Tighter testTimeout (30s) to accommodate DB roundtrips.
 *
 * Run via: pnpm --filter @tahawash/backend test:integration
 *
 * Requires:
 *   - Docker Compose postgres (or any Postgres 16 + PostGIS) reachable
 *     at localhost:5434
 *   - A test database named `tahawash_test` exists. One-time setup:
 *       docker compose exec postgres psql -U postgres \
 *         -c "CREATE DATABASE tahawash_test;"
 *   - TEST_DATABASE_URL env var (defaults to
 *     postgresql://postgres:postgres@localhost:5434/tahawash_test).
 */
module.exports = {
  rootDir: __dirname,
  testRegex: '\\.integration\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  testEnvironment: 'node',
  testTimeout: 30_000,
  globalSetup: '<rootDir>/global-setup.ts',
};
