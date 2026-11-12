import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";
import { afterAll, describe, expect, it } from "vitest";

// E39: in production the reviewer failed with "__name is not defined". Trigger.dev bundles the
// jobs with esbuild and keepNames (the same esbuild 0.23.1 its CLI uses), which wraps named
// functions in __name(...) calls; page.evaluate sends those functions to Chromium, where the
// helper does not exist. This bundles browser-checks.ts the same way and runs it on a real page:
// without the init script it fails exactly like production, with it the checks run.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(root, "src/browser-checks.ts");
// Inside the package, so the bundle resolves @playwright/test and axe from its node_modules.
const out = join(root, "node_modules/.keep-names-test");
const SHIM_LINE = "await context.addInitScript(KEEP_NAMES_SHIM);";

/** Takes the E39 fix out, to show the bundle fails without it. */
const withoutShim: Plugin = {
  name: "without-shim",
  setup(esbuild) {
    esbuild.onLoad({ filter: /browser-checks\.ts$/ }, () => {
      const text = readFileSync(source, "utf8");
      if (!text.includes(SHIM_LINE)) throw new Error("The shim line moved: update this test.");
      return { contents: text.replace(SHIM_LINE, ""), loader: "ts" };
    });
  },
};

type CheckInBrowser = typeof import("../../src/browser-checks.js").checkInBrowser;

async function bundle(name: string, plugins: Plugin[] = []): Promise<CheckInBrowser> {
  const outfile = join(out, `${name}.mjs`);
  await build({
    entryPoints: [source],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    keepNames: true,
    packages: "external",
    plugins,
    logLevel: "silent",
  });
  const text = readFileSync(outfile, "utf8");
  // The premise: the bundle really wraps functions that go to the browser.
  expect(text).toMatch(/__name\(/);
  const module = (await import(pathToFileURL(outfile).href)) as { checkInBrowser: CheckInBrowser };
  return module.checkInBrowser;
}

function site(): string {
  const dir = mkdtempSync(join(tmpdir(), "brotasites-keep-names-"));
  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Padaria do Zé</title>
<style>body{margin:0;font:16px/1.5 sans-serif} main{padding:1rem}</style>
</head><body><main><section id="abertura"><h1>Padaria do Zé</h1>
<p>Pão francês quentinho toda manhã.</p></section></main></body></html>`,
  );
  return dir;
}

describe("the reviewer bundled with keepNames (E39)", () => {
  mkdirSync(out, { recursive: true });
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it("fails with __name is not defined without the init script", async () => {
    const checkInBrowser = await bundle("without-shim", [withoutShim]);
    await expect(checkInBrowser(site(), { widths: [360] })).rejects.toThrow(
      /__name is not defined/,
    );
  });

  it("runs every check with the init script", async () => {
    const checkInBrowser = await bundle("with-shim");
    const result = await checkInBrowser(site(), { widths: [360], screenshotWidths: [360] });
    expect(result.screenshots).toHaveLength(1);
    expect(result.findings.filter((finding) => /__name/.test(finding.message))).toEqual([]);
  });
});
