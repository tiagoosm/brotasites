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
import { type Finding, findingKey, isAgentFinding, originOf } from "./findings.js";
import { checkBuild } from "./html-checks.js";

// The review loop (docs/ai-and-reviewer.md, Reviewer 3). Each round runs the deterministic
// checks (config, built files, browser) and the agent. Fixable findings go back to the
// generator, inside the catalog: another variant for the section, the text rewritten, the
// colors pulled back to AA. At most 2 fix rounds. A security finding stops the loop at once.
//
// E46: only a measured problem holds the site. A deterministic finding (config, build, layout,
// contrast, requests, accessibility, weight) that is high, or that came back after a fix, sends
// the site to the admin queue ("needsAttention") with the report. The agent's findings are
// opinions: they are rewritten once, then kept as notes for the person who reviews every site
// anyway; they hold the site only when no person will look (humanReview off, development).

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
  /**
   * E46: whether a person reviews the site before the client sees it (true unless
   * REVIEW_SKIP_HUMAN). Without one, a high finding of the agent holds the site too, and the
   * agent runs every round.
   */
  humanReview?: boolean;
  /** One line per round, without the client's text (Trigger.dev run logs). */
  log?: (message: string) => void;
}

export interface ReviewRound {
  findings: Finding[];
  /** What the generator changed after this round. */
  fixes: string[];
  costUsd: number;
  /** E46: false when the agent was not asked this round (only its own notes were fixed). */
  agent?: boolean;
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
  /**
   * E46: a site held by the review that the team may still send to the client as it is
   * ("Liberar para o cliente"): never after a security finding or an invalid config.
   */
  releasable: boolean;
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
    ["overflow", "cut-off-text", "broken-word", "touch-target"].includes(finding.check) &&
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

/** "round 2: 1 check (overflow), 2 agent (fit, repetition)": counts and categories only. */
function roundLine(round: number, findings: Finding[], agent: boolean): string {
  const describe = (items: Finding[], prefix = "") =>
    `${items.length}${items.length > 0 ? ` (${[...new Set(items.map((f) => f.check.slice(prefix.length)))].join(", ")})` : ""}`;
  const checks = findings.filter((finding) => !isAgentFinding(finding));
  const agentFindings = findings.filter(isAgentFinding);
  return `review round ${round}: ${describe(checks)} check, ${agent ? describe(agentFindings, "agent:") : "skipped"} agent`;
}

export async function reviewSite(options: ReviewOptions): Promise<ReviewReport> {
  const variants = options.variants ?? catalogVariants;
  const maxFixRounds = options.maxFixRounds ?? MAX_FIX_ROUNDS;
  const humanReview = options.humanReview ?? true;
  const browser =
    options.browser ?? ((site: BuiltSite) => checkInBrowser(site.distDir, { base: site.base }));
  const rounds: ReviewRound[] = [];
  // Deterministic findings only: an agent note in other words is not "the same problem back".
  const seen = new Map<string, number>();
  // The agent's notes already sent to the generator once: never a second time.
  const agentFixed = new Set<string>();
  let askAgent = true;
  let config = options.config;
  let costUsd = 0;

  const label = (finding: Finding, blocking: ReadonlySet<Finding>): Finding => ({
    ...finding,
    origin: originOf(finding),
    blocking: blocking.has(finding),
  });
  const finish = (
    status: ReviewReport["status"],
    reason: string,
    findings: Finding[],
    blocking: readonly Finding[] = [],
    releasable = status === "needsAttention",
  ): ReviewReport => {
    const held = new Set(blocking);
    return {
      status,
      reason,
      config,
      rounds: rounds.map((round) => ({
        ...round,
        findings: round.findings.map((finding) => label(finding, held)),
      })),
      findings: findings.map((finding) => label(finding, held)),
      costUsd,
      releasable,
    };
  };

  for (let round = 0; round <= maxFixRounds; round++) {
    const checked = checkConfig(config);
    let findings = checked.findings;
    let roundCost = 0;
    let agentRan = false;
    if (checked.config) {
      config = checked.config;
      const site = await options.build(config);
      findings.push(...checkBuild(site.distDir, { base: site.base }));
      const inBrowser = await browser(site);
      findings.push(...inBrowser.findings);
      if (askAgent && !findings.some((finding) => finding.security)) {
        const html = readFileSync(join(site.distDir, "index.html"), "utf8");
        const agent = await options.agent.review({
          config,
          form: options.form,
          html,
          screenshots: inBrowser.screenshots,
        });
        findings.push(...agent.findings);
        roundCost = agent.costUsd;
        agentRan = true;
      }
    }
    findings = findings.map(withFix);
    costUsd += roundCost;
    options.log?.(roundLine(round, findings, agentRan));

    for (const finding of findings) {
      if (isAgentFinding(finding)) continue;
      seen.set(findingKey(finding), (seen.get(findingKey(finding)) ?? 0) + 1);
    }

    const security = findings.filter((finding) => finding.security);
    if (security.length > 0) {
      rounds.push({ findings, fixes: [], costUsd: roundCost, agent: agentRan });
      return finish(
        "needsAttention",
        "Problema de segurança: o site não pode ser publicado sem revisão.",
        findings,
        security,
        false,
      );
    }
    if (!checked.config) {
      // Colors the client picked that break AA are the one invalid config the loop can fix.
      if (
        round < maxFixRounds &&
        findings.every((finding) => finding.fix?.type === "repair-colors")
      ) {
        config = repairColors(config);
        rounds.push({
          findings,
          fixes: ["cores ajustadas para contraste AA"],
          costUsd: roundCost,
          agent: agentRan,
        });
        continue;
      }
      rounds.push({ findings, fixes: [], costUsd: roundCost, agent: agentRan });
      return finish(
        "needsAttention",
        "A configuração do site é inválida.",
        findings,
        findings,
        false,
      );
    }
    const fixable = findings.filter(
      (finding) =>
        finding.fix &&
        finding.severity !== "low" &&
        !(isAgentFinding(finding) && agentFixed.has(findingKey(finding))),
    );
    if (fixable.length === 0 || round === maxFixRounds) {
      rounds.push({ findings, fixes: [], costUsd: roundCost, agent: agentRan });
      break;
    }
    const applied = await applyFixes(config, fixable, options, variants);
    rounds.push({ findings, fixes: applied.fixes, costUsd: roundCost, agent: agentRan });
    if (applied.fixes.length === 0) break;
    const valid = siteConfigSchema.safeParse(applied.config);
    if (!valid.success) break;
    config = valid.data;
    for (const finding of fixable) if (isAgentFinding(finding)) agentFixed.add(findingKey(finding));
    // The agent looks again only when a measured problem changed the page, or when no person
    // will look after it: a second opinion on its own notes costs a call and rarely ends at zero.
    askAgent = !humanReview || fixable.some((finding) => !isAgentFinding(finding));
  }

  const lastRound = rounds.at(-1);
  // When the agent was not asked in the last round, its latest notes still go to the person.
  const lastNotes =
    lastRound?.agent === false
      ? (rounds.findLast((item) => item.agent)?.findings.filter(isAgentFinding) ?? [])
      : [];
  const last = [...(lastRound?.findings ?? []), ...lastNotes];
  const checks = last.filter((finding) => !isAgentFinding(finding));
  const notes = last.filter(isAgentFinding);
  const high = checks.filter((finding) => finding.severity === "high");
  const returned = checks.filter(
    (finding) => finding.severity === "medium" && (seen.get(findingKey(finding)) ?? 0) > 1,
  );
  const unreviewed = humanReview ? [] : notes.filter((finding) => finding.severity === "high");
  if (high.length > 0 || returned.length > 0 || unreviewed.length > 0) {
    return finish(
      "needsAttention",
      high.length > 0
        ? `${high.length} problema(s) grave(s) continuam depois das correções.`
        : returned.length > 0
          ? `${returned.length} problema(s) voltaram depois das correções.`
          : `${unreviewed.length} observação(ões) grave(s) do revisor automático, e ninguém vai revisar o site antes do cliente.`,
      last,
      [...high, ...returned, ...unreviewed],
    );
  }
  if (checks.some((finding) => finding.severity === "medium")) {
    return finish("changesNeeded", "Ajustes recomendados antes de publicar.", last);
  }
  if (notes.some((finding) => finding.severity !== "low")) {
    return finish(
      "changesNeeded",
      "Observações do revisor automático para a pessoa conferir.",
      last,
    );
  }
  return finish("passed", "Nenhum problema relevante.", last);
}
