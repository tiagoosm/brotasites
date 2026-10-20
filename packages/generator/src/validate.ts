import { readFile } from "node:fs/promises";
import { type SectionId, type SiteConfig, siteConfigSchema } from "@brotasites/schema";
import { availableTemplates } from "@brotasites/templates";
import { type core, z } from "zod";

// Everything here is shown to clients or support staff, so messages are in pt-BR.

const sectionNames: Record<SectionId, string> = {
  hero: "Hero (topo)",
  sobre: "Sobre",
  servicos: "Serviços",
  galeria: "Galeria",
  depoimentos: "Depoimentos",
  faq: "Perguntas frequentes",
  "cta-final": "Chamada final",
  contato: "Contato",
};

const ptBR = z.locales.ptBR().localeError;

// Missing fields read better as "required" than as a type mismatch.
const errorMap: core.$ZodErrorMap = (issue) =>
  issue.code === "invalid_type" && issue.input === undefined ? "Campo obrigatório." : ptBR(issue);

export type ValidationResult =
  | { success: true; config: SiteConfig }
  | { success: false; errors: string[] };

function describePath(path: PropertyKey[], data: unknown): string {
  if (path.length === 0) return "Configuração";
  const [root, index, ...rest] = path;
  if (root === "sections" && typeof index === "number") {
    const id = (data as { sections?: { id?: string }[] })?.sections?.[index]?.id;
    const name = sectionNames[id as SectionId] ?? `nº ${index + 1}`;
    return rest.length ? `Seção "${name}" › ${rest.join(".")}` : `Seção "${name}"`;
  }
  return path.join(".");
}

function formatIssues(issues: core.$ZodIssue[], data: unknown): string[] {
  return issues.map((issue) => `${describePath(issue.path, data)}: ${issue.message}`);
}

/** Validates a parsed config with pt-BR messages, including generator-only checks. */
export function validateSiteConfig(data: unknown): ValidationResult {
  const result = siteConfigSchema.safeParse(data, { error: errorMap });
  if (!result.success) return { success: false, errors: formatIssues(result.error.issues, data) };

  const { template } = result.data.design;
  if (!availableTemplates.includes(template)) {
    return {
      success: false,
      errors: [
        `design.template: O modelo "${template}" ainda não está disponível. Modelos disponíveis: ${availableTemplates.join(", ")}.`,
      ],
    };
  }
  return { success: true, config: result.data };
}

/** Reads and validates a config file. File and JSON errors become validation errors. */
export async function readSiteConfig(configPath: string): Promise<ValidationResult> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    return { success: false, errors: [`Arquivo de configuração não encontrado: ${configPath}`] };
  }
  try {
    return validateSiteConfig(JSON.parse(raw));
  } catch (error) {
    return {
      success: false,
      errors: [`O arquivo de configuração não é um JSON válido: ${(error as Error).message}`],
    };
  }
}
