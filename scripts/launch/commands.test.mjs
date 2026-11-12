import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// E35b: `pnpm --filter <package> deploy` runs pnpm's own `deploy` command (it copies a workspace
// package to a folder), not the package's `deploy` script, and the "Deploy Worker" workflow
// failed with ERR_PNPM_INVALID_DEPLOY_TARGET. Scripts named like a pnpm command are called with
// `run` (or the tool with `exec`). This keeps the wrong form out of workflows, docs and configs.

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

// `pnpm`, a filter (--filter x, --filter=x, -F x), then `deploy` straight away: no run or exec.
const BARE_DEPLOY = /\bpnpm\s+(?:(?:--filter|-F)(?:=|\s+)\S+\s+)+deploy\b/;

function files(dir, keep) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".wrangler")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path, keep));
    else if (keep(name)) out.push(path);
  }
  return out;
}

const scanned = () => [
  ...files(join(root, ".github"), (n) => /\.ya?ml$/.test(n)),
  ...files(join(root, "docs"), (n) => /\.(md|json)$/.test(n)),
  ...files(join(root, "scripts"), (n) => /\.(mjs|js|ts)$/.test(n)),
  ...readdirSync(join(root, "apps")).flatMap((app) =>
    ["package.json", "wrangler.jsonc"]
      .map((f) => join(root, "apps", app, f))
      .filter((f) => {
        try {
          return statSync(f).isFile();
        } catch {
          return false;
        }
      }),
  ),
  ...["README.md", "PLAN.md", "CLAUDE.md", "package.json", ".env.example"].map((f) =>
    join(root, f),
  ),
];

describe("pnpm commands in workflows and docs (E35b)", () => {
  it("recognises the wrong form and accepts run and exec", () => {
    expect(BARE_DEPLOY.test("pnpm --filter @brotasites/sites-worker deploy")).toBe(true);
    expect(BARE_DEPLOY.test("pnpm -F @brotasites/sites-worker deploy")).toBe(true);
    expect(BARE_DEPLOY.test("pnpm --filter=@brotasites/sites-worker deploy")).toBe(true);
    expect(BARE_DEPLOY.test("pnpm --filter @brotasites/sites-worker run deploy")).toBe(false);
    expect(BARE_DEPLOY.test("pnpm --filter @brotasites/sites-worker exec wrangler deploy")).toBe(
      false,
    );
    expect(BARE_DEPLOY.test("pnpm --filter @brotasites/jobs exec trigger deploy --env prod")).toBe(
      false,
    );
  });

  it("never calls a package's deploy script without run or exec", () => {
    const found = [];
    for (const file of scanned()) {
      if (file === fileURLToPath(import.meta.url)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, at) => {
          if (BARE_DEPLOY.test(line)) found.push(`${relative(root, file)}:${at + 1}`);
        });
    }
    expect(found).toEqual([]);
  });

  it("deploys the Worker with run and the jobs with exec", () => {
    const worker = readFileSync(join(root, ".github/workflows/deploy-worker.yml"), "utf8");
    const jobs = readFileSync(join(root, ".github/workflows/deploy-jobs.yml"), "utf8");
    expect(worker).toMatch(/run: pnpm --filter @brotasites\/sites-worker run deploy$/m);
    expect(jobs).toMatch(/run: pnpm --filter @brotasites\/jobs exec trigger deploy /m);
  });
});
