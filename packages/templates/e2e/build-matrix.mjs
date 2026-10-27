// Builds the variant matrix for e2e/variants.spec.ts: a few copies of the 1.2 fixture site that
// together use every variant in the catalog, each with another personality and light mode.
// Output: dist-e2e-matrix/<n>/ (built with BROTASITES_BASE=/<n>/) and matrix.json.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compatibleFontPairs,
  createRandom,
  generatePalette,
  personalityPalettes,
  variants,
} from "@brotasites/catalog";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-e2e-matrix");
const work = join(out, ".work");
const fixtureDir = join(root, "e2e/fixture-v12");
const base = JSON.parse(readFileSync(join(fixtureDir, "site-config.json"), "utf8"));
const personalities = ["acolhedor", "robusto", "ousado", "moderno", "elegante"];

const bySection = new Map();
for (const variant of variants) {
  bySection.set(variant.section, [...(bySection.get(variant.section) ?? []), variant.id]);
}
const count = Math.max(...[...bySection.values()].map((list) => list.length));

rmSync(out, { recursive: true, force: true });
const sites = [];
for (let n = 0; n < count; n++) {
  const config = structuredClone(base);
  const identity = config.design.identity;
  const personality = personalities[n % personalities.length];
  const modes = personalityPalettes[personality].modes;
  const mode = modes[n % modes.length];
  identity.personality = personality;
  identity.fontPair =
    compatibleFontPairs(personality)[n % compatibleFontPairs(personality).length].id;
  identity.palette = generatePalette({
    personality,
    mode,
    random: createRandom(`matrix-${n}`),
    brandColors: config.brand.brandColors,
  });
  const chosen = {};
  for (const [section, ids] of bySection) {
    const id = ids[n % ids.length];
    chosen[section] = id;
    if (section === "hero") identity.heroVariant = id;
    else identity.sectionVariants[section] = id;
  }
  const siteDir = join(work, String(n));
  mkdirSync(siteDir, { recursive: true });
  cpSync(join(fixtureDir, "assets"), join(siteDir, "assets"), { recursive: true });
  writeFileSync(join(siteDir, "site-config.json"), JSON.stringify(config, null, 2));
  const build = spawnSync("pnpm", ["exec", "astro", "build", "--outDir", join(out, String(n))], {
    cwd: root,
    env: {
      ...process.env,
      BROTASITES_CONFIG: join(siteDir, "site-config.json"),
      BROTASITES_BASE: `/${n}/`,
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    encoding: "utf8",
  });
  if (build.status !== 0)
    throw new Error(`Matrix build ${n} failed:\n${build.stdout}\n${build.stderr}`);
  sites.push({ path: `/${n}/`, personality, mode, variants: chosen });
}
writeFileSync(join(out, "matrix.json"), JSON.stringify(sites, null, 2));
console.log(`Built ${sites.length} matrix sites into ${out}`);
