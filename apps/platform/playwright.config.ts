import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const FAKE_SUPABASE_PORT = 54390;
const FAKE_SUPABASE = `http://localhost:${FAKE_SUPABASE_PORT}`;

// Runs against a production build of the platform.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    // A Chromium installed elsewhere (a container with its own browsers), when given.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: [
    {
      // The platform's server calls Supabase too (the proxy's session check, the account
      // routes): a fake project in memory answers it (e2e/support/fake-supabase.mjs).
      command: `node e2e/support/fake-supabase.mjs`,
      url: `${FAKE_SUPABASE}/__test/outbox`,
      reuseExistingServer: !process.env.CI,
      env: { FAKE_SUPABASE_PORT: String(FAKE_SUPABASE_PORT) },
    },
    {
      command: `pnpm run build && pnpm exec next start --port ${PORT}`,
      url: `http://localhost:${PORT}/`,
      env: {
        NEXT_TELEMETRY_DISABLED: "1",
        // The fake project: the browser's calls are answered inside each test, the server's by
        // the fake above, so nothing reaches real Supabase or Trigger.dev.
        NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_test",
        SUPABASE_SECRET_KEY: "sb_secret_e2e_test",
        NEXT_PUBLIC_CAPTCHA_MODE: "simulated",
        NEXT_PUBLIC_PREVIEW_ORIGIN: "https://previa.sites.localhost",
        NEXT_PUBLIC_BASE_DOMAIN: "sites.localhost",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
