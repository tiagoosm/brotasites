import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { siteConfigSchema } from "@brotasites/schema";
import { describe, expect, it } from "vitest";
import { checkImages, readSiteConfig, validateSiteConfig } from "../src/index.js";

const examplePath = fileURLToPath(
  new URL("../../../docs/site-config.example.json", import.meta.url),
);
const example: unknown = JSON.parse(readFileSync(examplePath, "utf8"));

// biome-ignore lint/suspicious/noExplicitAny: the example is edited as loose JSON in the failure cases.
type Json = Record<string, any>;

function cloneExample(): Json {
  return structuredClone(example) as Json;
}

function errorsFor(data: unknown): string[] {
  const result = validateSiteConfig(data);
  expect(result.success).toBe(false);
  return result.success ? [] : result.errors;
}

describe("validateSiteConfig", () => {
  it("accepts the example", () => {
    expect(validateSiteConfig(example).success).toBe(true);
  });

  it("names the section and says the field is required", () => {
    const config = cloneExample();
    delete config.sections[0].content.title;
    expect(errorsFor(config)).toEqual(['Seção "Hero (topo)" › content.title: Campo obrigatório.']);
  });

  it("explains the WhatsApp format in Portuguese", () => {
    const config = cloneExample();
    config.business.contact.whatsapp = "(35) 99999-0000";
    expect(errorsFor(config)).toEqual([
      "business.contact.whatsapp: Informe o WhatsApp só com números, incluindo país e DDD (ex.: 5535999990000).",
    ]);
  });

  it("uses Portuguese messages for generic errors", () => {
    const config = cloneExample();
    config.business.name = "Z";
    expect(errorsFor(config)[0]).toMatch(/^business\.name: Pequeno demais/);
  });

  it("rejects templates that are not implemented yet", () => {
    const config = cloneExample();
    config.design.template = "moderno";
    expect(siteConfigSchema.safeParse(config).success).toBe(true);
    expect(errorsFor(config)).toEqual([
      'design.template: O modelo "moderno" ainda não está disponível. Modelos disponíveis: classico.',
    ]);
  });
});

describe("readSiteConfig", () => {
  it("reports a missing file", async () => {
    const result = await readSiteConfig("nao-existe.json");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.errors[0]).toMatch(/^Arquivo de configuração não encontrado/);
  });
});

describe("checkImages", () => {
  it("warns about every missing image in enabled sections", async () => {
    const result = validateSiteConfig(example);
    if (!result.success) throw new Error("example should be valid");
    const warnings = await checkImages(result.config, dirname(examplePath));
    expect(warnings).toHaveLength(6);
    expect(warnings[0]).toBe(
      "Imagem não encontrada (logo): assets/logo.png. O site será gerado sem ela.",
    );
  });
});
