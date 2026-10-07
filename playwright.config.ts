import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the built site running in the Workers runtime (wrangler dev), so the
 * static assets, _headers, the 404 page and the contact Worker are all the real thing.
 * Build first: `pnpm run build && pnpm run test:e2e`. Set CHROMIUM_PATH to use another Chromium.
 */
const port = 8788;
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    // Smooth scrolling moves elements while Playwright clicks them; the animations have their own test.
    reducedMotion: "reduce",
    launchOptions,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions } },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: {
    command: `pnpm exec wrangler dev --port ${port} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
