import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findFilesByMatchers } from "@trigger.dev/build/internal";
import { describe, expect, it } from "vitest";
import { IMAGE_FILES, IMAGE_PACKAGES } from "../trigger.config.js";

// E35d: what the Trigger.dev image gets besides the bundle. The full check (npm install, copy,
// astro build from the copy) is `pnpm --filter @brotasites/jobs image:smoke`; this one is fast
// and runs with the other tests.

const jobsRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(jobsRoot, "../..");
const pkg = (name: string) =>
  JSON.parse(readFileSync(join(repo, "packages", name, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
const split = (spec: string) => {
  const at = spec.lastIndexOf("@");
  return [spec.slice(0, at), spec.slice(at + 1)] as const;
};
const packages = new Map(IMAGE_PACKAGES.map(split));

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(astro|ts|css)$/.test(name)) out.push(path);
  }
  return out;
}

describe("the jobs image (E35d)", () => {
  it("pins each package to the version the workspace uses", () => {
    const templates = pkg("templates").dependencies ?? {};
    expect(packages.get("astro")).toBe(templates.astro);
    expect(packages.get("@tailwindcss/vite")).toBe(templates["@tailwindcss/vite"]);
    expect(packages.get("tailwindcss")).toBe(templates.tailwindcss);
    expect(packages.get("sharp")).toBe(pkg("generator").dependencies?.sharp);
    expect(packages.get("zod")).toBe(pkg("schema").dependencies?.zod);
    for (const version of packages.values()) expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("covers every package the templates import", () => {
    const templatesDir = join(repo, "packages/templates");
    const sources = [...files(join(templatesDir, "src")), join(templatesDir, "astro.config.ts")];
    const imported = new Set<string>();
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?:from\s+|import\s+|@import\s+)["']([^"'./][^"']*)["']/g)) {
        const spec = m[1] as string;
        if (/^(node:|astro:|@site|@padaria)/.test(spec)) continue;
        const parts = spec.split("/");
        imported.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] as string));
      }
    }
    const shipped = new Set(
      IMAGE_FILES.map((f) => /node_modules\/(@brotasites\/[^/]+)/.exec(f)?.[1]).filter(Boolean),
    );
    for (const name of imported) {
      expect(packages.has(name) || shipped.has(name), name).toBe(true);
    }
  });

  it("finds files for every additionalFiles pattern", async () => {
    const found = await findFilesByMatchers([...IMAGE_FILES], "/app", { cwd: jobsRoot });
    for (const { matcher, assets } of found) {
      expect(assets.length, matcher).toBeGreaterThan(0);
      // They land under /app/node_modules/@brotasites, where the templates find each other.
      for (const asset of assets)
        expect(asset.destination).toMatch(/^\/app\/node_modules\/@brotasites\//);
    }
  });
});
