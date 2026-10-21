import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Playwright specs live in e2e/ and run separately.
    include: ["src/**/*.test.ts"],
  },
});
