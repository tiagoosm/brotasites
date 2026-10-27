// Coordinates the two e2e servers: `mark <dir>` writes <dir>/.ready after a build; `wait <dir>`
// waits until a .ready newer than its own start exists (a stale build never counts).
import { existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [mode, dir] = process.argv.slice(2);
const marker = join(dir ?? ".", ".ready");

if (mode === "mark") {
  writeFileSync(marker, new Date().toISOString());
} else {
  const started = Date.now();
  while (!(existsSync(marker) && statSync(marker).mtimeMs >= started - 1000)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
