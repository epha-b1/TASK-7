import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright runs against the real frontend (Nginx-served Vue) talking to
 * the real backend (Express + MySQL) started by docker compose.
 *
 * The E2E_BASE_URL and E2E_API_URL env vars are set by docker-compose when
 * the `e2e` service runs; local runs fall back to the host port mapping.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://frontend:80",
    extraHTTPHeaders: {
      // Backend CSRF origin guard expects a matching Origin header.
      Origin: process.env.E2E_BASE_URL ?? "http://frontend:80",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
