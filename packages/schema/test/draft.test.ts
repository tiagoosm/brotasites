import { describe, expect, it } from "vitest";
import {
  applyCategory,
  buildPreviewConfig,
  businessStepSchema,
  categories,
  contrastRatio,
  defaultSections,
  findCategory,
  findPalette,
  mostReadable,
  PLACEHOLDER_NAME,
  palettes,
  siteConfigSchema,
} from "../src/index.js";

describe("palettes", () => {
  it.each(palettes.map((p) => [p.name, p]))("%s keeps text and buttons readable", (_, p) => {
    expect(contrastRatio(p.text, p.background)).toBeGreaterThanOrEqual(7);
    const onPrimary = mostReadable(p.primary, [p.background, p.text]);
    expect(contrastRatio(p.primary, onPrimary)).toBeGreaterThanOrEqual(4.5);
    const onBand = mostReadable(p.secondary, [p.background, p.text]);
    expect(contrastRatio(p.secondary, onBand)).toBeGreaterThanOrEqual(4.5);
  });

  it("every category points to existing palettes", () => {
    for (const category of categories) {
      for (const id of category.palettes)
        expect(findPalette(id), `${category.id}: ${id}`).toBeDefined();
    }
  });
});

describe("findCategory", () => {
  it("finds by id or label and falls back to 'outro'", () => {
    expect(findCategory("padaria").label).toBe("Padaria");
    expect(findCategory("Salão de beleza").id).toBe("salao");
    expect(findCategory("Floricultura").id).toBe("outro");
    expect(findCategory(undefined).id).toBe("outro");
  });
});

describe("applyCategory", () => {
  it("applies the category's palette, fonts and sections", () => {
    const draft = applyCategory({}, "Barbearia");
    expect(draft.business?.category).toBe("Barbearia");
    expect(draft.design?.paletteId).toBe("navalha");
    expect(draft.design?.fonts).toEqual({ heading: "Roboto Slab", body: "Inter" });
    expect(draft.sections?.filter((s) => s.enabled).map((s) => s.id)).toContain("galeria");
  });

  it("keeps the client's own design and section choices", () => {
    const custom = applyCategory({}, "Padaria");
    const edited = {
      ...custom,
      design: { ...custom.design, paletteId: "noite" },
      sections: defaultSections("Padaria").map((s) => ({
        ...s,
        enabled: s.id !== "faq" ? s.enabled : false,
      })),
      customized: { design: true, sections: true },
    };
    const next = applyCategory(edited, "Oficina mecânica");
    expect(next.design?.paletteId).toBe("noite");
    expect(next.sections?.find((s) => s.id === "faq")?.enabled).toBe(false);
  });

  it("keeps section content when the category changes", () => {
    const draft = applyCategory({}, "Padaria");
    draft.sections = draft.sections?.map((s) =>
      s.id === "sobre" ? { ...s, content: { title: "Desde 1998" } } : s,
    );
    const next = applyCategory(draft, "Cafeteria");
    expect(next.sections?.find((s) => s.id === "sobre")?.content).toEqual({ title: "Desde 1998" });
  });
});

describe("buildPreviewConfig", () => {
  it("turns an empty draft into a valid config", () => {
    const config = buildPreviewConfig({});
    expect(siteConfigSchema.safeParse(config).success).toBe(true);
    expect(config.business.name).toBe(PLACEHOLDER_NAME);
    expect(config.sections[0]?.id).toBe("hero");
  });

  it("uses what the client typed", () => {
    const draft = applyCategory(
      { business: { name: "Barbearia do Léo", contact: { address: { city: "Pouso Alegre" } } } },
      "Barbearia",
    );
    const config = buildPreviewConfig(draft);
    expect(config.business.name).toBe("Barbearia do Léo");
    expect(config.business.contact.address?.city).toBe("Pouso Alegre");
    expect(config.design.colors.primary).toBe("#1E3A5F");
    const hero = config.sections.find((s) => s.id === "hero");
    expect(hero?.content).toMatchObject({ title: "Barbearia do Léo" });
  });

  it("falls back while a value is half-typed", () => {
    const config = buildPreviewConfig({
      design: { colors: { primary: "#12" } },
      business: { contact: { whatsapp: "3599", email: "joao@" } },
      sections: [{ id: "hero", enabled: true, content: { title: "x".repeat(200) } }],
    });
    expect(config.design.colors.primary).toMatch(/^#[0-9A-F]{6}$/i);
    expect(config.business.contact.whatsapp).toBeUndefined();
    expect(config.business.contact.email).toBeUndefined();
    expect(config.sections[0]?.content).toMatchObject({ title: PLACEHOLDER_NAME });
  });
});

describe("businessStepSchema", () => {
  it("explains what is missing in Portuguese", () => {
    const result = businessStepSchema.safeParse({ name: " ", category: "", city: "X" });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toEqual([
      "Escreva o nome do negócio, com pelo menos 2 letras.",
      "Escolha um tipo da lista ou escreva qual é.",
      "Escreva a cidade onde o negócio fica.",
    ]);
  });

  it("trims the values", () => {
    expect(
      businessStepSchema.parse({ name: " Zé ", category: "Padaria", city: " Lavras " }),
    ).toEqual({
      name: "Zé",
      category: "Padaria",
      city: "Lavras",
    });
  });
});
