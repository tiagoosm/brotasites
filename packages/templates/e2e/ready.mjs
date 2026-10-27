// Coordinates the e2e servers: `mark <dir>` writes <dir>/.ready after a build; `wait <dir>` waits
// for a .ready written in this test run. Both read the run id from E2E_RUN (set once in
// playwright.config.ts), so a marker left by an earlier run never counts, whether the servers
// start together or one after another.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [mode, dir] = process.argv.slice(2);
const marker = join(dir ?? ".", ".ready");
const run = process.env.E2E_RUN;
if (!run) throw new Error("E2E_RUN is not set.");

if (mode === "mark") {
  writeFileSync(marker, run);
} else {
  while (!(existsSync(marker) && readFileSync(marker, "utf8") === run)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
