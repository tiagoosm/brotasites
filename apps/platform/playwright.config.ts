import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const PREVIEW_PORT = 4410;
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

// Runs against a production build of the platform.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
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
      // The live preview server (apps/preview), allowed to be framed by the test platform.
      command: "pnpm --dir ../preview exec astro build && node ../preview/dist/server/entry.mjs",
      url: `${PREVIEW_URL}/render`,
      env: {
        PORT: String(PREVIEW_PORT),
        PREVIEW_FRAME_ANCESTORS: `http://localhost:${PORT}`,
        ASTRO_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
      url: `http://localhost:${PORT}/criar/negocio`,
      env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_PREVIEW_URL: PREVIEW_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
