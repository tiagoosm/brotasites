import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteConfigSchema } from "../src/index.js";

const examplePath = new URL("../../../docs/site-config.example.json", import.meta.url);
const example: unknown = JSON.parse(readFileSync(examplePath, "utf8"));

// biome-ignore lint/suspicious/noExplicitAny: the example is edited as loose JSON in the failure cases.
type Json = Record<string, any>;

function cloneExample(): Json {
  return structuredClone(example) as Json;
}

function findSection(config: Json, id: string): Json {
  const section = config.sections.find((s: Json) => s.id === id);
  if (!section) throw new Error(`Section "${id}" not found in the example`);
  return section;
}

function issuePaths(config: Json): string[] {
  const result = siteConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("siteConfigSchema", () => {
  it("accepts the Padaria do Zé example", () => {
    const result = siteConfigSchema.safeParse(example);
    expect(result.error?.issues).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it("rejects a hero without a title", () => {
    const config = cloneExample();
    delete findSection(config, "hero").content.title;
    expect(issuePaths(config)).toContain("sections.0.content.title");
  });

  it("rejects a color that is not #RRGGBB", () => {
    for (const color of ["#FFF", "B45309", "#B4530G", "#B453090", "red"]) {
      const config = cloneExample();
      config.design.colors.primary = color;
      expect(issuePaths(config), color).toEqual(["design.colors.primary"]);
    }
  });

  it("rejects an invalid subdomain", () => {
    for (const subdomain of [
      "ab",
      "-padaria",
      "padaria-",
      "Padaria",
      "padaria_ze",
      "a".repeat(41),
    ]) {
      const config = cloneExample();
      config.site.subdomain = subdomain;
      expect(issuePaths(config), subdomain).toEqual(["site.subdomain"]);
    }
  });

  it("rejects a WhatsApp number in the wrong format", () => {
    for (const whatsapp of ["(35) 99999-0000", "35999990000", "+5535999990000", "55359999900001"]) {
      const config = cloneExample();
      config.business.contact.whatsapp = whatsapp;
      expect(issuePaths(config), whatsapp).toEqual(["business.contact.whatsapp"]);
    }
  });

  it("rejects the testimonials section enabled with no testimonials", () => {
    const config = cloneExample();
    findSection(config, "depoimentos").enabled = true;
    const result = siteConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]?.path.join(".")).toBe("sections.4.content.items");
    expect(result.error?.issues[0]?.message).toMatch(/pelo menos um depoimento/);
  });

  it("accepts the testimonials section enabled with a real testimonial", () => {
    const config = cloneExample();
    const testimonials = findSection(config, "depoimentos");
    testimonials.enabled = true;
    testimonials.content.items = [{ name: "Maria", text: "O melhor pão de queijo da cidade." }];
    expect(siteConfigSchema.safeParse(config).success).toBe(true);
  });
});

describe("ctaSchema", () => {
  it("only accepts web addresses for link buttons", async () => {
    const { ctaSchema } = await import("../src/index.js");
    expect(
      ctaSchema.safeParse({ label: "Ver", action: "link", target: "https://exemplo.com" }).success,
    ).toBe(true);
    for (const target of ["javascript:alert(1)", "data:text/html,oi", "exemplo.com"]) {
      expect(ctaSchema.safeParse({ label: "Ver", action: "link", target }).success, target).toBe(
        false,
      );
    }
    // Other actions keep their own targets (e.g. a section id to scroll to).
    expect(ctaSchema.safeParse({ label: "Ver", action: "scroll", target: "faq" }).success).toBe(
      true,
    );
  });
});
