import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Malicious input in every text field a client fills (docs/security.md, item 10): the built
// site must show it as text, never run it or turn it into markup.

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = join(root, "e2e/fixture-v12");
const payloads = [
  "<script>alert(1)</script>",
  '"><img src=x onerror=alert(2)>',
  "</title><script>alert(3)</script>",
  "javascript:alert(4)",
  "<svg onload=alert(5)>",
  "{{constructor.constructor('alert(6)')()}}",
  "</script><script>alert(7)</script>",
];
const pick = (index: number, max: number) => payloads[index % payloads.length]?.slice(0, max) ?? "";

let html = "";
/** The page with every quoted attribute value emptied: text inside a value is never markup. */
let markup = "";
let dir = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "brotasites-xss-"));
  const config = JSON.parse(readFileSync(join(fixture, "site-config.json"), "utf8"));
  config.business.name = pick(0, 80);
  config.business.tagline = pick(1, 120);
  config.business.description = pick(6, 500);
  config.business.address.street = pick(1, 120);
  config.business.address.district = pick(4, 80);
  config.business.openingHours.note = pick(4, 120);
  config.seo.title = pick(2, 70);
  config.seo.description = pick(1, 160);
  config.seo.keywords = [pick(0, 40), pick(4, 40)];
  config.navigation.ctaLabel = pick(4, 30);
  let index = 0;
  for (const section of config.sections) {
    const content = section.content;
    if ("title" in content) content.title = pick(index++, 60);
    if ("subtitle" in content) content.subtitle = pick(index++, 160);
    if ("text" in content) content.text = pick(index++, 800);
    if (content.image) content.image.alt = pick(1, 160);
    if (content.cta) content.cta.label = pick(index++, 30);
    for (const item of content.items ?? []) {
      for (const key of [
        "name",
        "description",
        "title",
        "text",
        "question",
        "answer",
        "context",
        "price",
      ]) {
        if (key in item) item[key] = pick(index++, key === "price" ? 30 : 50);
      }
    }
    for (const step of content.steps ?? []) step.title = pick(index++, 60);
    for (const image of content.images ?? []) image.alt = pick(index++, 160);
  }
  writeFileSync(join(dir, "site-config.json"), JSON.stringify(config));
  cpSync(join(fixture, "assets"), join(dir, "assets"), { recursive: true });
  const build = spawnSync("pnpm", ["exec", "astro", "build", "--outDir", join(dir, "dist")], {
    cwd: root,
    env: {
      ...process.env,
      BROTASITES_CONFIG: join(dir, "site-config.json"),
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    encoding: "utf8",
  });
  if (build.status !== 0) throw new Error(`${build.stdout}\n${build.stderr}`);
  html = readFileSync(join(dir, "dist/index.html"), "utf8");
  markup = html.replace(/="[^"]*"/g, '=""');
}, 180_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("malicious text in every field", () => {
  it("shows up as escaped text", () => {
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;svg onload=alert(5)&gt;");
  });

  it("adds no script, event handler or markup", () => {
    const scripts = markup.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toEqual(['<script type="">', '<script type="" src="">']);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toMatch(/<script type="module" src="\/_astro\/[^"]+\.js"><\/script>/);
    // Tags only (text between tags may say "onload=" harmlessly, it is escaped).
    const tags = markup.match(/<[a-z][^<>]*>/gi) ?? [];
    expect(tags.filter((tag) => /\son[a-z]+=/i.test(tag))).toEqual([]);
    expect(
      tags.filter((tag) => /^<(img|svg|iframe|object|embed)\b/i.test(tag) && /alert/.test(tag)),
    ).toEqual([]);
    // Attribute values keep their quotes: no value can end early and start a new attribute.
    expect(html).not.toMatch(/=""?><img/);
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("keeps the structured data inside its own block", () => {
    const block =
      html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
    expect(block).not.toContain("</");
    expect(block).not.toContain("<script");
    expect(JSON.parse(block).name).toBe(payloads[0]);
  });

  it("keeps the title and meta tags intact", () => {
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("<title>&lt;/title&gt;&lt;script&gt;alert(3)&lt;/script&gt;</title>");
  });
});
