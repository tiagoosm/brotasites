import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Builds share the templates folder (and its Astro cache), so they must not overlap.
    fileParallelism: false,
  },
});
