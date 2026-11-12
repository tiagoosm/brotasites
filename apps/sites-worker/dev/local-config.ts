// A local copy of wrangler.jsonc without its routes (E35). With routes, `wrangler dev` infers an
// origin from the first one and rewrites every request's URL to that host, so the Worker would
// see brotasites.com instead of <subdomain>.sites.localhost. Production keeps its routes in
// wrangler.jsonc; `pnpm dev` and the Miniflare test run this copy, written under .wrangler/
// (gitignored).
//
//   node dev/local-config.ts  -> writes the copy and starts `wrangler dev` with local values

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** wrangler.jsonc's settings without routes, with paths that work from the copy's folder. */
export function localConfig(text: string): Record<string, unknown> {
  const json = text
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  const { routes: _routes, $schema: _schema, ...config } = JSON.parse(json);
  return { ...config, main: join(workerRoot, String(config.main)) };
}

/** Writes the copy and returns its path. */
export function writeLocalConfig(): string {
  const text = readFileSync(join(workerRoot, "wrangler.jsonc"), "utf8");
  const folder = join(workerRoot, ".wrangler");
  mkdirSync(folder, { recursive: true });
  const path = join(folder, "local.wrangler.json");
  writeFileSync(path, `${JSON.stringify(localConfig(text), null, 2)}\n`);
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = writeLocalConfig();
  const child = spawn(
    "wrangler",
    [
      "dev",
      "--config",
      config,
      "--persist-to",
      join(workerRoot, ".wrangler/state"),
      "--var",
      "BASE_DOMAIN:sites.localhost",
      "--var",
      "PLATFORM_URL:http://localhost:3000",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", cwd: workerRoot },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}
