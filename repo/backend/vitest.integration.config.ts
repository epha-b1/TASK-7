import { defineConfig } from "vitest/config";

/**
 * No-mock backend integration config. Tests under test-integration/ run
 * against a real MySQL (started by docker-compose) and exercise the full
 * request -> service -> repository -> DB path through createApp().
 *
 * These tests require DB_HOST/DB_PORT/etc. to be set by the environment
 * (docker-compose provides them); locally they fall back to the docker
 * network defaults in setup-env.ts.
 */
export default defineConfig({
  test: {
    include: ["test-integration/**/*.int.test.ts"],
    environment: "node",
    globals: true,
    // Real DB round-trips + argon2 hashing per test mean we need a longer
    // timeout than the unit suite.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["test-integration/setup-env.ts"],
    // Integration tests share the DB; run them sequentially so inserts from
    // one file don't race another's assertions.
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    clearMocks: true,
    restoreMocks: true,
  },
});
