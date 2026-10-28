import { playwright } from "@trigger.dev/build/extensions/playwright";
import { defineConfig } from "@trigger.dev/sdk";

// Trigger.dev project (decision of E10, docs/owner-steps.md). The project ref comes from the
// owner's account (TRIGGER_PROJECT_REF); the Playwright extension installs Chromium for the
// reviewer and the direction screenshots.
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_to_be_created",
  dirs: ["./src/trigger"],
  maxDuration: 1800,
  build: {
    extensions: [playwright({ browsers: ["chromium"] })],
  },
});
