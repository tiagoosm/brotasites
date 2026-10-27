import { describe, expect, it } from "vitest";
import {
  categories,
  categoryIds,
  familyInfo,
  isReservedSubdomain,
  reviewLevel,
} from "../../src/v1.2/index.js";

describe("taxonomy 1.2", () => {
  it("has unique category ids that are valid subdomain-style slugs", () => {
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
    for (const id of categoryIds) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("reviews regulated health and sensitive categories by a person", () => {
    expect(reviewLevel("dentista")).toBe("mandatory");
    for (const id of ["chaveiro", "guincho", "desentupidora", "advogado", "adega", "outro"]) {
      expect(reviewLevel(id)).not.toBe("standard");
    }
    expect(reviewLevel("padaria")).toBe("standard");
  });

  it("opens reinforced categories only in wave 3", () => {
    for (const category of categories) {
      if (category.review !== "standard") expect(category.wave).toBe(3);
    }
    expect(categories.find((c) => c.id === "padaria")?.wave).toBe(1);
    expect(categories.find((c) => c.id === "idiomas")?.wave).toBe(2);
  });

  it("starts every family's default sections with the hero and ends with contact", () => {
    for (const info of Object.values(familyInfo)) {
      expect(info.defaultSections[0]).toBe("hero");
      expect(info.defaultSections.at(-1)).toBe("contato");
    }
  });
});

describe("reserved subdomains", () => {
  it("refuses imitation words anywhere and reserved names alone", () => {
    expect(isReservedSubdomain("www")).toBe(true);
    expect(isReservedSubdomain("nubank-ofertas")).toBe(true);
    expect(isReservedSubdomain("loja-do-gov")).toBe(true);
    expect(isReservedSubdomain("caixa-de-costura")).toBe(false);
    expect(isReservedSubdomain("padaria-do-ze")).toBe(false);
  });
});
