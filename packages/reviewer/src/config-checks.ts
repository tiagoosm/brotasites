import { effectivePalette } from "@brotasites/engine";
import {
  contrastIssues,
  type Section,
  type SiteConfig,
  siteConfigSchema,
} from "@brotasites/schema/v1.2";
import type { Finding } from "./findings.js";

// Checks on the configuration, before any build: the schema, AA contrast on the colors the site
// is built with, empty sections and text that may have been cut at a field's limit.

const sectionOf = (path: readonly PropertyKey[], config: unknown): Finding["where"] => {
  if (path[0] !== "sections" || typeof path[1] !== "number") return "page";
  const sections = (config as { sections?: { id?: string }[] }).sections;
  return (sections?.[path[1]]?.id as Finding["where"]) ?? "page";
};

/** Fields with a limit where a text exactly at the limit, without a final stop, looks cut. */
const limits: [string, (section: Section) => string | undefined, number][] = [
  ["hero", (s) => (s.id === "hero" ? s.content.subtitle : undefined), 200],
  ["sobre", (s) => (s.id === "sobre" ? s.content.text : undefined), 800],
  ["cta-final", (s) => (s.id === "cta-final" ? s.content.subtitle : undefined), 160],
];

export function checkConfig(input: unknown): { config?: SiteConfig; findings: Finding[] } {
  const parsed = siteConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      findings: parsed.error.issues.map((issue) => ({
        check:
          issue.path.includes("palette") || issue.path.includes("colors") ? "contrast" : "schema",
        severity: "high" as const,
        where: sectionOf(issue.path, input),
        message: `${issue.path.join(".") || "configuração"}: ${issue.message}`,
        ...(issue.path.includes("colors") ? { fix: { type: "repair-colors" as const } } : {}),
      })),
    };
  }
  const config = parsed.data;
  const findings: Finding[] = [];

  const palette = effectivePalette(config.design);
  if (!palette) {
    findings.push({
      check: "schema",
      severity: "high",
      where: "page",
      message: "O site não tem identidade visual: escolha uma direção antes de gerar.",
    });
  } else {
    for (const [fg, bg] of contrastIssues(palette)) {
      findings.push({
        check: "contrast",
        severity: "high",
        where: "page",
        message: `Contraste abaixo de AA entre ${fg} e ${bg}.`,
        fix: { type: "repair-colors" },
      });
    }
  }

  for (const section of config.sections) {
    if (!section.enabled) continue;
    if (section.id === "sobre" && section.content.text.trim() === "") {
      findings.push({
        check: "empty-section",
        severity: "medium",
        where: "sobre",
        message: 'A seção "Sobre" está ligada, mas sem texto.',
        fix: { type: "rewrite-copy" },
      });
    }
    if (
      section.id === "servicos" &&
      section.content.items.every((item) => !item.description && !item.price)
    ) {
      findings.push({
        check: "empty-section",
        severity: "low",
        where: "servicos",
        message: "Os serviços só têm nome: uma descrição curta ajuda o visitante.",
        fix: { type: "rewrite-copy" },
      });
    }
    for (const [id, pick, max] of limits) {
      const text = section.id === id ? pick(section) : undefined;
      if (text && text.length >= max && !/[.!?…)"”]$/.test(text.trim())) {
        findings.push({
          check: "cut-off-text",
          severity: "medium",
          where: section.id,
          message: `O texto chegou ao limite de ${max} caracteres e parece cortado.`,
          fix: { type: "rewrite-copy" },
        });
      }
    }
  }
  return { config, findings };
}
