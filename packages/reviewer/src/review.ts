import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  variants as catalogVariants,
  enforceContrast,
  type PhotoQuality,
  type Variant,
} from "@brotasites/catalog";
import { allowedVariants, applyOverrides, type EngineInput } from "@brotasites/engine";
import { type SectionId, type SiteConfig, siteConfigSchema } from "@brotasites/schema/v1.2";
import type { ReviewerAgent } from "./agent.js";
import { type BrowserResult, checkInBrowser } from "./browser-checks.js";
import { checkConfig } from "./config-checks.js";
import { type Finding, findingKey } from "./findings.js";
import { checkBuild } from "./html-checks.js";

// The review loop (docs/ai-and-reviewer.md, Reviewer 3). Each round runs the deterministic
// checks (config, built files, browser) and the agent. Fixable findings go back to the
// generator, inside the catalog: another variant for the section, the text rewritten, the
// colors pulled back to AA. At most 2 fix rounds. A security finding stops the loop at once;
// a high finding left at the end, or one that came back after a fix, sends the site to the
// admin queue ("needsAttention") with the report.

export const MAX_FIX_ROUNDS = 2;

export interface BuiltSite {
  distDir: string;
  base?: string;
}

export interface ReviewOptions {
  /** The site to review. */
  config: SiteConfig;
  /** The client's own answers, before any AI rewrite: the only source of facts. */
  form: SiteConfig;
  build: (config: SiteConfig) => Promise<BuiltSite>;
  agent: ReviewerAgent;
  /** The browser checks; checkInBrowser by default. */
  browser?: (site: BuiltSite) => Promise<BrowserResult>;
  /** Rewrites the text, told what was wrong (the AI copy step); without it, copy is not fixable. */
  rewriteCopy?: (config: SiteConfig, findings: Finding[]) => Promise<SiteConfig>;
  variants?: readonly Variant[];
  maxFixRounds?: number;
}

export interface ReviewRound {
  findings: Finding[];
  /** What the generator changed after this round. */
  fixes: string[];
  costUsd: number;
}

export interface ReviewReport {
  status: "passed" | "changesNeeded" | "needsAttention";
  /** pt-BR, for the admin queue. */
  reason: string;
  config: SiteConfig;
  rounds: ReviewRound[];
  /** The findings of the last round. */
  findings: Finding[];
  costUsd: number;
}

/** What the engine needs to pick another variant for a built site. */
export function engineInputOf(config: SiteConfig): EngineInput {
  const hasPhoto = config.sections.some(
    (section) =>
      section.enabled &&
      (("image" in section.content && section.content.image) ||
        ("images" in section.content && section.content.images.length > 0)),
  );
  const photos: PhotoQuality = hasPhoto ? "good" : "none";
  return {
    name: config.business.name,
    city: config.business.address.city,
    category: config.business.category,
    family: config.business.family,
    feelings: config.brand.feelings,
    brandColors: config.brand.brandColors,
    hasLogo: Boolean(config.brand.logoAsset),
    photos,
    sections: config.sections.filter((section) => section.enabled).map((section) => section.id),
    round: config.design.round,
  };
}

/** Which fix a deterministic finding gets, when the generator can do something about it. */
function withFix(finding: Finding): Finding {
  if (finding.fix || finding.security) return finding;
  if (
    ["overflow", "cut-off-text", "touch-target"].includes(finding.check) &&
    finding.where !== "page"
  ) {
    return { ...finding, fix: { type: "swap-variant", section: finding.where } };
  }
  if (finding.check === "axe:color-contrast") return { ...finding, fix: { type: "repair-colors" } };
  return finding;
}

function swapVariant(
  config: SiteConfig,
  section: SectionId,
  variants: readonly Variant[],
): string | undefined {
  const identity = config.design.identity;
  if (!identity) return undefined;
  const current = section === "hero" ? identity.heroVariant : identity.sectionVariants[section];
  const options = allowedVariants(
    variants,
    section,
    engineInputOf(config),
    identity.personality,
  ).map((variant) => variant.id);
  const others = options.filter((id) => id !== current);
  if (others.length === 0) return undefined;
  // The next one after the current, so repeated swaps walk the list.
  const index = current ? options.indexOf(current) : -1;
  return options.slice(index + 1).find((id) => id !== current) ?? others[0];
}

function repairColors(config: SiteConfig): SiteConfig {
  const design = config.design;
  if (!design.identity) return config;
  if (design.overrides.colors && Object.keys(design.overrides.colors).length > 0) {
    if (design.directionStatus === "approved") {
      return {
        ...config,
        design: applyOverrides(
          { ...design, overrides: { ...design.overrides, colors: {} } },
          { colors: design.overrides.colors },
          { repair: true },
        ),
      };
    }
    return {
      ...config,
      design: { ...design, overrides: { ...design.overrides, colors: undefined } },
    };
  }
  return {
    ...config,
    design: {
      ...design,
      identity: { ...design.identity, palette: enforceContrast(design.identity.palette) },
    },
  };
}

async function applyFixes(
  config: SiteConfig,
  findings: Finding[],
  options: ReviewOptions,
  variants: readonly Variant[],
): Promise<{ config: SiteConfig; fixes: string[] }> {
  let next = config;
  const fixes: string[] = [];
  const swapped = new Set<SectionId>();
  for (const finding of findings) {
    const fix = finding.fix;
    if (fix?.type !== "swap-variant" || swapped.has(fix.section)) continue;
    const id = swapVariant(next, fix.section, variants);
    const identity = next.design.identity;
    if (!id || !identity) continue;
    swapped.add(fix.section);
    const nextIdentity =
      fix.section === "hero"
        ? { ...identity, heroVariant: id }
        : { ...identity, sectionVariants: { ...identity.sectionVariants, [fix.section]: id } };
    next = { ...next, design: { ...next.design, identity: nextIdentity } };
    fixes.push(`${fix.section}: variante trocada para ${id}`);
  }
  if (findings.some((finding) => finding.fix?.type === "repair-colors")) {
    next = repairColors(next);
    fixes.push("cores ajustadas para contraste AA");
  }
  const copyFindings = findings.filter((finding) => finding.fix?.type === "rewrite-copy");
  if (copyFindings.length > 0 && options.rewriteCopy) {
    next = await options.rewriteCopy(next, copyFindings);
    fixes.push("textos reescritos");
  }
  return { config: next, fixes };
}

export async function reviewSite(options: ReviewOptions): Promise<ReviewReport> {
  const variants = options.variants ?? catalogVariants;
  const maxFixRounds = options.maxFixRounds ?? MAX_FIX_ROUNDS;
  const browser =
    options.browser ?? ((site: BuiltSite) => checkInBrowser(site.distDir, { base: site.base }));
  const rounds: ReviewRound[] = [];
  const seen = new Map<string, number>();
  let config = options.config;
  let costUsd = 0;

  const finish = (
    status: ReviewReport["status"],
    reason: string,
    findings: Finding[],
  ): ReviewReport => ({
    status,
    reason,
    config,
    rounds,
    findings,
    costUsd,
  });

  for (let round = 0; round <= maxFixRounds; round++) {
    const checked = checkConfig(config);
    let findings = checked.findings;
    let roundCost = 0;
    if (checked.config) {
      config = checked.config;
      const site = await options.build(config);
      findings.push(...checkBuild(site.distDir, { base: site.base }));
      const inBrowser = await browser(site);
      findings.push(...inBrowser.findings);
      if (!findings.some((finding) => finding.security)) {
        const html = readFileSync(join(site.distDir, "index.html"), "utf8");
        const agent = await options.agent.review({
          config,
          form: options.form,
          html,
          screenshots: inBrowser.screenshots,
        });
        findings.push(...agent.findings);
        roundCost = agent.costUsd;
      }
    }
    findings = findings.map(withFix);
    costUsd += roundCost;

    for (const finding of findings)
      seen.set(findingKey(finding), (seen.get(findingKey(finding)) ?? 0) + 1);

    const security = findings.filter((finding) => finding.security);
    if (security.length > 0) {
      rounds.push({ findings, fixes: [], costUsd: roundCost });
      return finish(
        "needsAttention",
        "Problema de segurança: o site não pode ser publicado sem revisão.",
        findings,
      );
    }
    if (!checked.config) {
      // Colors the client picked that break AA are the one invalid config the loop can fix.
      if (
        round < maxFixRounds &&
        findings.every((finding) => finding.fix?.type === "repair-colors")
      ) {
        config = repairColors(config);
        rounds.push({ findings, fixes: ["cores ajustadas para contraste AA"], costUsd: roundCost });
        continue;
      }
      rounds.push({ findings, fixes: [], costUsd: roundCost });
      return finish("needsAttention", "A configuração do site é inválida.", findings);
    }
    const fixable = findings.filter((finding) => finding.fix && finding.severity !== "low");
    if (fixable.length === 0 || round === maxFixRounds) {
      rounds.push({ findings, fixes: [], costUsd: roundCost });
      break;
    }
    const applied = await applyFixes(config, fixable, options, variants);
    rounds.push({ findings, fixes: applied.fixes, costUsd: roundCost });
    if (applied.fixes.length === 0) break;
    const valid = siteConfigSchema.safeParse(applied.config);
    if (!valid.success) break;
    config = valid.data;
  }

  const last = rounds.at(-1)?.findings ?? [];
  const high = last.filter((finding) => finding.severity === "high");
  const returned = last.filter(
    (finding) => (seen.get(findingKey(finding)) ?? 0) > 1 && finding.severity !== "low",
  );
  if (high.length > 0 || returned.length > 0) {
    return finish(
      "needsAttention",
      high.length > 0
        ? `${high.length} problema(s) grave(s) continuam depois das correções.`
        : `${returned.length} problema(s) voltaram depois das correções.`,
      last,
    );
  }
  if (last.some((finding) => finding.severity === "medium")) {
    return finish("changesNeeded", "Ajustes recomendados antes de publicar.", last);
  }
  return finish("passed", "Nenhum problema relevante.", last);
}
