import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 15000,
    setupFiles: ["test/setup-env.ts"],
    clearMocks: true,
    restoreMocks: true,
    pool: "forks",
    poolOptions: { forks: { maxForks: 2, minForks: 1 } },
    exclude: [
      "dist/**",
      "node_modules/**",
      "test/contracts/apiSpecSync.test.ts",
      "test/security/secretArtifactGuard.test.ts",
      "test/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/index.ts",
        "src/db/migrate.ts",
        "src/db/seed.ts",
        "src/docs/**",
        "src/types/**",
      ],
      // Thresholds are set as a non-regressing floor calibrated to the current
      // measured baseline. Every PR that touches shipped code must meet or
      // beat these — they are intended to be ratcheted upward as the suite
      // grows, not lowered.
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 65,
        statements: 50,
        // Middleware is the auth/CSRF perimeter; keep it at 80%+.
        "src/middleware/**": {
          lines: 80,
          functions: 95,
          branches: 80,
          statements: 80,
        },
        // Security (encryption helpers) is small and near-total.
        "src/security/**": {
          lines: 85,
          functions: 100,
          branches: 75,
          statements: 85,
        },
        // Core utilities (response envelope, logger) must stay high.
        "src/utils/**": {
          lines: 85,
          functions: 80,
          branches: 65,
          statements: 85,
        },
      },
    },
  },
});
