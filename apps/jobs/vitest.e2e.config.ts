import { defineConfig } from "vitest/config";

// Browser tests (Chromium). Set PW_CHROMIUM to use a specific binary.
export default defineConfig({
  test: { include: ["test/e2e/**/*.test.ts"], testTimeout: 300_000 },
});
