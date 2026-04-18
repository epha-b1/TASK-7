import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    extensions: [".ts", ".tsx", ".mjs", ".js", ".mts", ".jsx", ".json"],
  },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/e2e/**", "node_modules/**"],
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    pool: "forks",
    poolOptions: { forks: { maxForks: 2, minForks: 1 } },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,vue}"],
      exclude: [
        "src/**/*.d.ts",
        "src/main.ts",
        "src/env.d.ts",
        "src/types/**",
        // router/index.ts is a pure Vue-Router route-table declaration that
        // is covered end-to-end by the Playwright E2E suite (real browser
        // navigation). Exercising it in vitest would require bundling the
        // whole app and adds no incremental assertion value.
        "src/router/index.ts",
      ],
      thresholds: {
        // Calibrated to the current measured baseline so CI regressions fail
        // immediately. Ratchet these up, not down, as more tests land.
        lines: 50,
        functions: 50,
        branches: 55,
        statements: 50,
        "src/router/**": {
          lines: 85,
          functions: 85,
          branches: 75,
          statements: 85,
        },
        "src/telemetry/**": {
          lines: 85,
          functions: 90,
          branches: 70,
          statements: 85,
        },
      },
    },
  },
});
