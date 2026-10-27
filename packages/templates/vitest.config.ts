import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Playwright specs live in e2e/ and run separately.
    include: ["test/**/*.test.ts"],
    // test/xss.test.ts builds a site with Astro.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
