import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compatibleFontPairs,
  createRandom,
  generatePalette,
  type Personality,
} from "@brotasites/catalog";
import { buildStaticSite } from "@brotasites/generator";
import { type SiteConfig, siteConfigSchema } from "@brotasites/schema/v1.2";
import { templatesRoot } from "@brotasites/templates";
import type { Browser } from "@playwright/test";
import { SimulatedReviewerAgent } from "./agent.js";
import { checkInBrowser } from "./browser-checks.js";
import { checkConfig } from "./config-checks.js";
import type { Finding } from "./findings.js";
import { checkBuild } from "./html-checks.js";

// The calibration set (docs/ai-and-reviewer.md, Reviewer 4): 20 sites with one known defect
// each, plus 5 clean sites, all from the 1.2 fixture (Padaria do Zé). Each defect is made in the
// config before the build or in the built files after it, and names the check that must catch
// it. Measured: hits (the defect's check reported) and false alarms (medium or high findings on
// the clean sites, or on a defective site from a check unrelated to its defect).

const fixtureDir = join(templatesRoot, "e2e/fixture-v12");
const fixture = (): SiteConfig =>
  siteConfigSchema.parse(JSON.parse(readFileSync(join(fixtureDir, "site-config.json"), "utf8")));

type Mutable = Record<string, unknown> & SiteConfig;

export interface CalibrationCase {
  id: string;
  /** Checks that must report it (any one of them is a hit). */
  expect: string[];
  /** Checks a correct reviewer may also report for this defect (not false alarms). */
  alsoOk?: string[];
  config?: (config: Mutable) => void;
  dist?: (distDir: string, html: string) => string | undefined;
}

const section = (config: SiteConfig, id: string) =>
  config.sections.find((item) => item.id === id) as
    | { content: Record<string, unknown> }
    | undefined;

const cssFile = (distDir: string) => {
  const dir = join(distDir, "_astro");
  const name = readdirSync(dir).find((file) => file.endsWith(".css"));
  if (!name) throw new Error("No CSS in the build");
  return join(dir, name);
};

const firstImage = (html: string) =>
  /<img[^>]*\ssrc="([^"]+)"/.exec(html.split("</header>")[1] ?? html)?.[1];

export const defects: CalibrationCase[] = [
  {
    id: "low-contrast-colors",
    expect: ["contrast"],
    config: (config) => {
      config.design.overrides = { colors: { text: "#D9D9D9", textMuted: "#E0E0E0" } };
    },
  },
  {
    id: "empty-about",
    expect: ["empty-section"],
    config: (config) => {
      (section(config, "sobre") as { content: { text: string } }).content.text = "";
    },
  },
  {
    id: "about-cut-at-limit",
    expect: ["cut-off-text"],
    config: (config) => {
      (section(config, "sobre") as { content: { text: string } }).content.text =
        "A Padaria do Zé abriu as portas em 1998 na Rua das Flores e desde então "
          .repeat(12)
          .slice(0, 800);
    },
  },
  {
    id: "invented-fact",
    expect: ["agent:invented-fact"],
    config: (config) => {
      (section(config, "hero") as { content: { subtitle: string } }).content.subtitle =
        "Desde 1985, com mais de 10 mil clientes atendidos.";
    },
  },
  {
    id: "banned-phrase",
    expect: ["agent:generic-copy"],
    config: (config) => {
      (section(config, "sobre") as { content: { text: string } }).content.text =
        "Venha conhecer a Padaria do Zé: excelência em pães desde 1998.";
    },
  },
  {
    id: "repeated-titles",
    expect: ["agent:repetition"],
    config: (config) => {
      (section(config, "servicos") as { content: { title: string } }).content.title =
        "Nossa história";
      (section(config, "sobre") as { content: { title: string } }).content.title = "Nossa história";
    },
  },
  {
    id: "european-portuguese",
    expect: ["agent:portuguese"],
    config: (config) => {
      (section(config, "cta-final") as { content: { subtitle: string } }).content.subtitle =
        "Encomende pelo telemóvel com 2 dias de antecedência.";
    },
  },
  {
    id: "inline-script",
    expect: ["inline-script"],
    dist: (_, html) => html.replace("</body>", "<script>alert(1)</script></body>"),
  },
  {
    id: "external-image",
    expect: ["external-request"],
    dist: (_, html) =>
      html.replace("</main>", '<img src="https://example.com/x.png" alt="x"></main>'),
  },
  {
    id: "javascript-link",
    expect: ["unsafe-link"],
    dist: (_, html) =>
      html.replace("</main>", '<p><a href="javascript:alert(1)">Promoção</a></p></main>'),
  },
  {
    id: "missing-alt",
    expect: ["image-alt", "axe:image-alt"],
    alsoOk: ["axe:image-alt", "image-alt"],
    dist: (_, html) => html.replace(/(<main[\s\S]*?<img[^>]*?)\salt="[^"]*"/, "$1"),
  },
  {
    id: "broken-image",
    expect: ["broken-resource", "broken-request"],
    alsoOk: ["broken-resource", "broken-request"],
    dist: (distDir, html) => {
      const src = firstImage(html);
      if (src) rmSync(join(distDir, src.replace(/^\//, "")), { force: true });
      return undefined;
    },
  },
  {
    id: "broken-anchor",
    expect: ["broken-anchor"],
    dist: (_, html) => html.replace("</main>", '<p><a href="#nao-existe">Ver mais</a></p></main>'),
  },
  {
    id: "inline-style",
    expect: ["inline-style"],
    dist: (_, html) => html.replace("<main", '<main style="outline:0"'),
  },
  {
    id: "heavy-page",
    expect: ["page-weight"],
    alsoOk: ["heavy-image"],
    dist: (distDir, html) => {
      writeFileSync(join(distDir, "_astro", "enorme.webp"), Buffer.alloc(1_700_000, 1));
      return html.replace("</main>", '<img src="/_astro/enorme.webp" alt="Foto grande"></main>');
    },
  },
  {
    id: "tiny-touch-target",
    expect: ["touch-target"],
    dist: (_, html) => html.replace("</main>", '<a href="#contato" class="tiny-link">.</a></main>'),
  },
  {
    id: "hidden-content",
    expect: ["reduced-motion"],
    dist: (distDir) => {
      appendFileSync(cssFile(distDir), "#sobre p{opacity:0!important}");
      return undefined;
    },
  },
  {
    id: "sideways-overflow",
    expect: ["overflow"],
    dist: (distDir) => {
      appendFileSync(
        cssFile(distDir),
        "footer p{white-space:nowrap!important;width:1600px!important}",
      );
      return undefined;
    },
  },
  {
    id: "css-import",
    expect: ["external-request"],
    dist: (distDir) => {
      const file = cssFile(distDir);
      writeFileSync(
        file,
        `@import url(https://fonts.googleapis.com/css2?family=Roboto);${readFileSync(file, "utf8")}`,
      );
      return undefined;
    },
  },
  {
    id: "low-contrast-text",
    expect: ["axe:color-contrast"],
    dist: (distDir) => {
      appendFileSync(cssFile(distDir), "#sobre p{color:#e8e8e8!important}");
      return undefined;
    },
  },
];

function withPersonality(personality: Personality, mode: "light" | "dark") {
  return (config: Mutable) => {
    const identity = config.design.identity;
    if (!identity) return;
    identity.personality = personality;
    identity.fontPair = (compatibleFontPairs(personality)[0] as { id: string }).id;
    identity.palette = generatePalette({
      personality,
      mode,
      random: createRandom(`${personality}|${mode}`),
      brandColors: config.brand.brandColors,
    });
    config.design.overrides = {};
  };
}

export const cleanSites: CalibrationCase[] = [
  { id: "clean-fixture", expect: [] },
  { id: "clean-robusto-dark", expect: [], config: withPersonality("robusto", "dark") },
  { id: "clean-ousado", expect: [], config: withPersonality("ousado", "light") },
  { id: "clean-elegante", expect: [], config: withPersonality("elegante", "light") },
  {
    id: "clean-short-page",
    expect: [],
    config: (config) => {
      for (const item of config.sections) {
        if (!["hero", "servicos", "contato"].includes(item.id)) item.enabled = false;
      }
    },
  },
];

export interface CalibrationResult {
  id: string;
  defective: boolean;
  hit: boolean;
  findings: Finding[];
  falseAlarms: Finding[];
}

export interface CalibrationReport {
  results: CalibrationResult[];
  hits: number;
  defects: number;
  falseAlarms: number;
  cleanSites: number;
}

const matches = (check: string, list: readonly string[]) => list.includes(check);

/** Builds and reviews every case with the deterministic checks and the simulated agent. */
export async function runCalibration(
  options: { browser?: Browser; executablePath?: string } = {},
): Promise<CalibrationReport> {
  const work = mkdtempSync(join(tmpdir(), "brotasites-calibration-"));
  const agent = new SimulatedReviewerAgent();
  const form = fixture();
  const results: CalibrationResult[] = [];
  const builds = new Map<string, string>();

  const buildConfig = async (key: string, config: SiteConfig) => {
    const cached = builds.get(key);
    if (cached) return cached;
    const dir = join(work, key);
    cpSync(join(fixtureDir, "assets"), join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "site-config.json"), JSON.stringify(config));
    const out = join(dir, "dist");
    const result = await buildStaticSite(join(dir, "site-config.json"), out);
    if (!result.ok) throw new Error(`Build ${key} failed:\n${result.log}`);
    builds.set(key, out);
    return out;
  };

  try {
    for (const item of [...defects, ...cleanSites]) {
      const raw = fixture() as Mutable;
      item.config?.(raw);
      const checked = checkConfig(raw);
      const findings = [...checked.findings];
      if (checked.config) {
        const base = await buildConfig(item.config ? item.id : "base", checked.config);
        let distDir = base;
        if (item.dist) {
          distDir = join(work, `${item.id}-dist`);
          cpSync(base, distDir, { recursive: true });
          const indexPath = join(distDir, "index.html");
          const changed = item.dist(distDir, readFileSync(indexPath, "utf8"));
          if (changed !== undefined) writeFileSync(indexPath, changed);
        }
        findings.push(...checkBuild(distDir));
        const browser = await checkInBrowser(distDir, {
          browser: options.browser,
          executablePath: options.executablePath,
          screenshotWidths: [],
        });
        findings.push(...browser.findings);
        const html = readFileSync(join(distDir, "index.html"), "utf8");
        findings.push(
          ...(await agent.review({ config: checked.config, form, html, screenshots: [] })).findings,
        );
      }
      const expected = [...item.expect, ...(item.alsoOk ?? [])];
      const falseAlarms = findings.filter(
        (finding) => finding.severity !== "low" && !matches(finding.check, expected),
      );
      results.push({
        id: item.id,
        defective: item.expect.length > 0,
        hit:
          item.expect.length === 0 ||
          findings.some((finding) => matches(finding.check, item.expect)),
        findings,
        falseAlarms,
      });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const defective = results.filter((result) => result.defective);
  return {
    results,
    hits: defective.filter((result) => result.hit).length,
    defects: defective.length,
    falseAlarms: results.reduce((sum, result) => sum + result.falseAlarms.length, 0),
    cleanSites: results.length - defective.length,
  };
}
