import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;
const PORT_V12 = 4323;
const PORT_MATRIX = 4324;
const fixtureConfig = fileURLToPath(new URL("./e2e/fixture/site-config.json", import.meta.url));
const fixtureV12 = fileURLToPath(new URL("./e2e/fixture-v12/site-config.json", import.meta.url));
// One id per test run, shared by the servers through e2e/ready.mjs.
const E2E_RUN = process.env.E2E_RUN ?? `${Date.now()}-${process.pid}`;
process.env.E2E_RUN = E2E_RUN;

// Builds the fixture sites (every section on, placeholder photos), 1.1 and 1.2, and serves the
// static output of each.
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
      testIgnore: /(v12|variants)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "v12-desktop",
      testMatch: /v12\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        baseURL: `http://localhost:${PORT_V12}`,
      },
    },
    {
      name: "v12-mobile",
      testMatch: /v12\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
        baseURL: `http://localhost:${PORT_V12}`,
      },
    },
    {
      name: "variants",
      testMatch: /variants\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORT_MATRIX}` },
    },
    {
      name: "mobile",
      testIgnore: /(v12|variants)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  // Astro builds of the same project must not run at the same time, so the first server builds
  // every site in turn and serves the 1.1 one; the others wait for their build to be marked
  // ready in this run and serve it. A plain static server (e2e/serve.mjs) replaces astro preview, which
  // allows one server per project and may move itself to the background.
  webServer: [
    {
      command: `pnpm exec astro build --outDir dist-e2e && BROTASITES_CONFIG=${fixtureV12} pnpm exec astro build --outDir dist-e2e-v12 && node e2e/ready.mjs mark dist-e2e-v12 && node e2e/build-matrix.mjs && node e2e/ready.mjs mark dist-e2e-matrix && node e2e/serve.mjs dist-e2e ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: { BROTASITES_CONFIG: fixtureConfig, ASTRO_TELEMETRY_DISABLED: "1", E2E_RUN },
      reuseExistingServer: !process.env.CI,
      timeout: 360_000,
    },
    {
      command: `node e2e/ready.mjs wait dist-e2e-v12 && node e2e/serve.mjs dist-e2e-v12 ${PORT_V12}`,
      url: `http://localhost:${PORT_V12}`,
      env: { BROTASITES_CONFIG: fixtureV12, ASTRO_TELEMETRY_DISABLED: "1", E2E_RUN },
      reuseExistingServer: !process.env.CI,
      timeout: 360_000,
    },
    {
      command: `node e2e/ready.mjs wait dist-e2e-matrix && node e2e/serve.mjs dist-e2e-matrix ${PORT_MATRIX}`,
      url: `http://localhost:${PORT_MATRIX}/0/`,
      env: { ASTRO_TELEMETRY_DISABLED: "1", E2E_RUN },
      reuseExistingServer: !process.env.CI,
      timeout: 360_000,
    },
  ],
});
