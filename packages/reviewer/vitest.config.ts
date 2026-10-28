import { defineConfig } from "vitest/config";

// Unit tests only; the browser suite (test/e2e) runs with vitest.e2e.config.ts after CI
// installs Chromium.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], exclude: ["test/e2e/**"] },
});
