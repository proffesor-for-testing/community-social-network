import { defineConfig } from 'vitest/config';
import * as path from 'path';
import baseConfig from './vitest.config';

/**
 * Postgres-backed persistence test suite.
 *
 * Exercises the real Postgres repositories (libs/infrastructure/*\/src/repositories/postgres-*.repository.ts)
 * against a live Postgres database, unlike the default vitest.config.ts run which only
 * exercises in-memory repository implementations.
 *
 * Run with: RUN_DB_TESTS=1 npx vitest run --config vitest.persistence.config.ts
 * (npm script: npm run test:persistence)
 *
 * The whole run is skipped with a clear message unless RUN_DB_TESTS=1 is set --
 * see tests/persistence/setup/global-setup.ts.
 */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['tests/persistence/**/*.spec.ts'],
    // Override (not merge) the root config's exclude -- it excludes
    // tests/persistence/** so the default run doesn't pick these up, which
    // would otherwise also exclude them here.
    exclude: ['**/node_modules/**'],
    // A single shared Postgres database is truncated between tests, so tests
    // (and test files) must not run concurrently.
    fileParallelism: false,
    globalSetup: [path.resolve(__dirname, 'tests/persistence/setup/global-setup.ts')],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
