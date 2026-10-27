import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { siteConfigSchema } from "@brotasites/schema";
import { afterAll, describe, expect, it } from "vitest";
import { generateSite, localizeRemoteImages } from "../src/index.js";

const examplePath = fileURLToPath(
  new URL("../../../docs/legacy/site-config.example.v1.1.json", import.meta.url),
);
const photo = fileURLToPath(
  new URL("../../templates/e2e/fixture/assets/hero.jpg", import.meta.url),
);
const STORAGE = "https://projeto.supabase.co/storage/v1/object/public/site-images/u/s";

async function exampleWith(images: { hero?: string; gallery?: string[] }) {
  const config = siteConfigSchema.parse(JSON.parse(await readFile(examplePath, "utf8")));
  for (const section of config.sections) {
    if (section.id === "hero") section.content.image = images.hero ?? null;
    if (section.id === "galeria") {
      section.enabled = true;
      section.content.images = images.gallery ?? [];
    }
  }
  return config;
}

/** Serves the fixture photo for storage addresses, 404 for anything else. */
const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  if (!url.startsWith(STORAGE)) return new Response("não", { status: 404 });
  if (url.endsWith(".txt")) return new Response("x", { headers: { "content-type": "text/plain" } });
  return new Response(await readFile(photo), { headers: { "content-type": "image/jpeg" } });
};

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "brotasites-"));
  dirs.push(dir);
  return dir;
}

describe("localizeRemoteImages", () => {
  it("downloads uploaded photos and points the config to the copies", async () => {
    const dir = await tempDir();
    const config = await exampleWith({
      hero: `${STORAGE}/hero.webp`,
      gallery: [`${STORAGE}/1.webp`, `${STORAGE}/hero.webp`],
    });
    const result = await localizeRemoteImages(config, dir, { fetch: fakeFetch });
    expect(result.warnings).toEqual([]);
    // The same photo used twice is downloaded once.
    expect(result.downloaded).toBe(2);
    const hero = result.config.sections.find((s) => s.id === "hero");
    const image = hero?.id === "hero" ? hero.content.image : undefined;
    expect(image).toMatch(/^_brotasites-images\/[0-9a-f]{16}\.jpg$/);
    expect((await stat(join(dir, image as string))).size).toBeGreaterThan(0);
  });

  it("refuses other hosts, plain http and files that are not photos", async () => {
    const dir = await tempDir();
    const config = await exampleWith({
      hero: "https://exemplo.com/foto.jpg",
      gallery: ["http://projeto.supabase.co/a.jpg", `${STORAGE}/nota.txt`, `${STORAGE}/ok.webp`],
    });
    const result = await localizeRemoteImages(config, dir, { fetch: fakeFetch });
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toContain("endereço não permitido");
    const gallery = result.config.sections.find((s) => s.id === "galeria");
    expect(gallery?.id === "galeria" && gallery.content.images).toHaveLength(1);
    const hero = result.config.sections.find((s) => s.id === "hero");
    expect(hero?.id === "hero" && hero.content.image).toBeNull();
  });
});

describe("generateSite with uploaded photos", () => {
  it("builds optimized local copies", { timeout: 180_000 }, async () => {
    const dir = await tempDir();
    const configPath = join(dir, "site-config.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(configPath, JSON.stringify(await exampleWith({ hero: `${STORAGE}/h.webp` })));
    const outDir = join(dir, "out");
    const result = await generateSite({ configPath, outDir, fetch: fakeFetch });
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
    const html = await readFile(join(outDir, "index.html"), "utf8");
    expect(html).not.toContain(STORAGE);
    expect(html).toMatch(/<img[^>]+src="\/_astro\/[^"]+\.webp"/);
    // The temporary copies are cleaned up.
    await expect(stat(join(dir, "_brotasites-images"))).rejects.toThrow();
  });
});
