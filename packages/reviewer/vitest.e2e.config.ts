import { defineConfig } from "vitest/config";

// The browser suite: builds real sites and checks them in Chromium. Set PW_CHROMIUM to use a
// specific Chromium binary.
export default defineConfig({
  test: { include: ["test/e2e/**/*.test.ts"], testTimeout: 600_000, hookTimeout: 600_000 },
});
