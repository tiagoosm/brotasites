import { describe, expect, it } from "vitest";
import {
  applyCategory,
  bodyFonts,
  buildPreviewConfig,
  draftSections,
  fontPairings,
  headingFonts,
  moveSection,
  sectionIds,
  sectionInfo,
  setColor,
  setFonts,
  setPalette,
  setStyle,
  setTemplate,
  templateOptions,
  templates,
  toggleSection,
} from "../src/index.js";

const bakery = () => applyCategory({ business: { name: "Padaria do Zé" } }, "Padaria");

describe("design options", () => {
  it("only offer fonts and templates the schema accepts", () => {
    for (const pairing of fontPairings) {
      expect(headingFonts).toContain(pairing.heading);
      expect(bodyFonts).toContain(pairing.body);
    }
    expect(templateOptions.map((t) => t.id).sort()).toEqual([...templates].sort());
    expect(sectionInfo.map((s) => s.id)).toEqual([...sectionIds]);
  });
});

describe("design actions", () => {
  it("applies a palette and remembers the choice", () => {
    const draft = setPalette(bakery(), "noite");
    expect(draft.design?.paletteId).toBe("noite");
    expect(draft.design?.colors?.background).toBe("#14110F");
    // A later business type change keeps the client's palette.
    expect(applyCategory(draft, "Barbearia").design?.paletteId).toBe("noite");
  });

  it("custom colors leave the ready-made palette", () => {
    const draft = setColor(setPalette(bakery(), "forno"), "primary", "#0055AA");
    expect(draft.design?.paletteId).toBeUndefined();
    expect(draft.design?.colors).toMatchObject({ primary: "#0055AA", background: "#FFFBEB" });
    expect(buildPreviewConfig(draft).design.colors.primary).toBe("#0055AA");
  });

  it("sets template, fonts and style", () => {
    let draft = setTemplate(bakery(), "classico");
    draft = setFonts(draft, "Lora", "Inter");
    draft = setStyle(draft, "borderRadius", "round");
    draft = setStyle(draft, "buttons", "outline");
    const config = buildPreviewConfig(draft);
    expect(config.design.fonts).toEqual({ heading: "Lora", body: "Inter" });
    expect(config.design.style).toEqual({ borderRadius: "round", buttons: "outline" });
  });
});

describe("section actions", () => {
  it("turns sections on and off but keeps the top", () => {
    let draft = toggleSection(bakery(), "faq", false);
    expect(draftSections(draft).find((s) => s.id === "faq")?.enabled).toBe(false);
    draft = toggleSection(draft, "hero", false);
    expect(draftSections(draft).find((s) => s.id === "hero")?.enabled).toBe(true);
    expect(draft.customized?.sections).toBe(true);
  });

  it("reorders sections without passing the top", () => {
    let draft = moveSection(bakery(), "contato", -1);
    const order = () => draftSections(draft).map((s) => s.id);
    expect(order().slice(-2)).toEqual(["contato", "cta-final"]);
    draft = moveSection(draft, "sobre", -1);
    expect(order()[0]).toBe("hero");
    expect(moveSection(draft, "hero", 1)).toBe(draft);
  });

  it("the preview follows the chosen order", () => {
    const draft = moveSection(bakery(), "faq", -1);
    const ids = buildPreviewConfig(draft).sections.map((s) => s.id);
    expect(ids.indexOf("faq")).toBeLessThan(ids.indexOf("depoimentos"));
  });
});
