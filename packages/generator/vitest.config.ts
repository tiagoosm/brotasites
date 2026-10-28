import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Builds share the templates folder (and its Astro cache), so they must not overlap.
    fileParallelism: false,
    // Image re-encoding (sharp) and builds are CPU work; in CI they share the runner with the
    // other packages' suites, so the default 5 s is too short.
    testTimeout: 60_000,
  },
});
