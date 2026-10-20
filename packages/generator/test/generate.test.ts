import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { generateSite } from "../src/index.js";

const examplePath = fileURLToPath(
  new URL("../../../docs/site-config.example.json", import.meta.url),
);

describe("generateSite", () => {
  let outDir: string | undefined;

  afterAll(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  // Full Astro build; downloads Google Fonts on the first run.
  it("builds the example into static HTML", { timeout: 120_000 }, async () => {
    outDir = await mkdtemp(join(tmpdir(), "brotasites-"));
    const result = await generateSite({ configPath: examplePath, outDir });
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);

    const html = await readFile(join(outDir, "index.html"), "utf8");
    expect(html).toContain("<h1");
    expect(html).toContain("Pão quentinho todo dia");
    expect(html).toContain('<section id="faq"');
    // Disabled sections are not rendered.
    expect(html).not.toContain('id="depoimentos"');
  });

  it("does not build an invalid config", async () => {
    const result = await generateSite({ configPath: "nao-existe.json", outDir: "unused" });
    expect(result.success).toBe(false);
  });
});
