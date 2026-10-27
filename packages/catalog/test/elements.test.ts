import { describe, expect, it } from "vitest";
import {
  buildOrnament,
  catalogIds,
  createRandom,
  dividerSvg,
  dividers,
  fluid,
  grammar,
  imageTreatments,
  isCatalogId,
  monogramLetters,
  ornamentIds,
  ornamentSets,
  ornamentSvg,
  patterns,
  personalities,
  rhythms,
  scaleVariables,
  sectionTones,
  stepSize,
  typeScales,
} from "../src/index.js";

const unsafe = /<script|on[a-z]+=|javascript:|href=|xlink|@import|https?:/i;

describe("ids", () => {
  it("are unique catalog ids", () => {
    for (const [field, ids] of Object.entries(catalogIds)) {
      expect(new Set(ids).size, field).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/);
    }
  });

  it("the grammar only names catalog ids, with positive weights", () => {
    for (const personality of personalities) {
      const rules = grammar[personality];
      const check = (
        field: Parameters<typeof isCatalogId>[0],
        list: readonly (readonly [string, number])[],
      ) => {
        expect(list.length, `${personality} ${field}`).toBeGreaterThan(0);
        for (const [id, weight] of list) {
          expect(isCatalogId(field, id), `${personality} ${field} ${id}`).toBe(true);
          expect(weight).toBeGreaterThan(0);
        }
      };
      check("scale", rules.scales);
      check("shape", rules.shapes);
      check("pattern", rules.patterns);
      check("dividerStyle", rules.dividers);
      check("ornamentSet", rules.ornamentSets);
      check("imageTreatment", rules.imageTreatments);
      check("rhythm", rules.rhythms);
      check("markStyle", rules.marks);
    }
  });
});

describe("ornaments", () => {
  it("build valid, decorative SVG with no outside reference", () => {
    for (const id of ornamentIds) {
      for (const seed of ["a", "b", "c"]) {
        const svg = ornamentSvg(buildOrnament(id, createRandom(seed)));
        expect(svg).toMatch(
          /^<svg class="ornament ornament-[a-z-]+" viewBox="[\d. ]+" aria-hidden="true" focusable="false">/,
        );
        expect(svg).not.toMatch(unsafe);
        expect(svg).not.toContain("NaN");
      }
    }
  });

  it("vary with the seed where they are seeded, and repeat with the same seed", () => {
    const blob = (seed: string) => ornamentSvg(buildOrnament("blob", createRandom(seed)));
    expect(blob("a")).toBe(blob("a"));
    expect(blob("a")).not.toBe(blob("b"));
  });

  it("sets only list known ornaments", () => {
    for (const set of ornamentSets)
      for (const id of set.ornaments) expect(ornamentIds).toContain(id);
  });

  it("refuses class names that could break out of the attribute", () => {
    expect(() => ornamentSvg(buildOrnament("seal", createRandom("a")), '" onload="x')).toThrow();
  });
});

describe("dividers, patterns and treatments", () => {
  it("dividers are inline SVG paths within their box", () => {
    for (const divider of dividers) {
      const svg = dividerSvg(divider);
      if (divider.height === 0) {
        expect(svg).toBe("");
        continue;
      }
      expect(svg).not.toMatch(unsafe);
      const numbers = divider.path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      expect(Math.max(...numbers)).toBeLessThanOrEqual(1440);
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    }
  });

  it("patterns and treatments make no outside request", () => {
    for (const pattern of patterns) expect(pattern.background).not.toMatch(/url\(|@import/);
    for (const treatment of imageTreatments) {
      expect(treatment.css).not.toMatch(/@import|https?:|javascript:|@keyframes|transition/);
      for (const url of treatment.css.match(/url\([^)]*\)/g) ?? []) {
        expect(url).toBe('url("/assets/grain.svg")');
      }
    }
  });
});

describe("type scale", () => {
  it("grows from phone to desktop and keeps the title jump", () => {
    for (const scale of typeScales) {
      const [phoneBody, desktopBody] = stepSize(scale, 0);
      const [phoneTitle, desktopTitle] = stepSize(scale, 5);
      expect(desktopBody).toBeGreaterThanOrEqual(phoneBody);
      expect(desktopTitle / desktopBody).toBeGreaterThanOrEqual(2.4);
      // A 360 px phone fits a 10-letter word of the h1.
      expect(phoneTitle * 0.62 * 10).toBeLessThanOrEqual(360 - 32);
      expect(Object.keys(scaleVariables(scale))).toContain("--step-display");
    }
  });

  it("writes clamp() values", () => {
    expect(fluid(16, 18)).toBe("clamp(1rem, 0.951rem + 0.217vw, 1.125rem)");
  });
});

describe("rhythm and marks", () => {
  it("ends every page on the rhythm's last tone", () => {
    for (const rhythm of rhythms) {
      const tones = sectionTones(rhythm, 6);
      expect(tones).toHaveLength(6);
      expect(tones.at(-1)).toBe(rhythm.last);
    }
  });

  it("makes monograms from the meaningful words", () => {
    expect(monogramLetters("Padaria do Zé")).toBe("PZ");
    expect(monogramLetters("Ateliê")).toBe("A");
    expect(monogramLetters("Salão & Cia.")).toBe("SC");
    expect(monogramLetters("ótica são josé")).toBe("ÓJ");
    expect(monogramLetters("  ")).toBe("");
  });
});

describe("the 1.2 example", () => {
  it("uses catalog ids for every token of its identity", async () => {
    const { readFileSync } = await import("node:fs");
    const example = JSON.parse(
      readFileSync(new URL("../../../docs/site-config.example.json", import.meta.url), "utf8"),
    );
    const identity = example.design.identity;
    expect(isCatalogId("fontPair", identity.fontPair)).toBe(true);
    expect(isCatalogId("scale", identity.typeScale)).toBe(true);
    expect(isCatalogId("shape", identity.shape)).toBe(true);
    expect(isCatalogId("ornamentSet", identity.ornamentSet)).toBe(true);
    expect(isCatalogId("pattern", identity.pattern)).toBe(true);
    expect(isCatalogId("imageTreatment", identity.imageTreatment)).toBe(true);
    expect(isCatalogId("dividerStyle", identity.dividerStyle)).toBe(true);
    expect(isCatalogId("markStyle", identity.markStyle)).toBe(true);
    expect(isCatalogId("rhythm", identity.rhythm)).toBe(true);
    expect(isCatalogId("motionPreset", identity.motionPreset)).toBe(true);
  });
});
