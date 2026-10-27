import { contrastRatio } from "@brotasites/schema";
import { contrastIssues, identitySchema, parseSiteConfig } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import {
  DeterministicEngine,
  designDistance,
  drawDirections,
  MemoryRegistry,
  MIN_DIRECTION_DISTANCE,
  MIN_SITE_DISTANCE,
  seedFor,
} from "../src/index.js";
import { businesses, fixtureVariants } from "./fixtures.js";

const draw = (index: number, round = 0) =>
  drawDirections({ ...(businesses[index] as (typeof businesses)[number]), round }, fixtureVariants);

describe("seed", () => {
  it("ignores case, accents and spacing, and changes with the round", () => {
    const a = seedFor({
      name: "Padaria do ZÉ ",
      city: "Santa Rita do Sapucaí",
      category: "padaria",
      round: 0,
    });
    const b = seedFor({
      name: "padaria  do ze",
      city: "santa rita do sapucai",
      category: "padaria",
      round: 0,
    });
    expect(a).toBe(b);
    expect(seedFor({ name: "x", city: "y", category: "z", round: 1 })).not.toBe(
      seedFor({ name: "x", city: "y", category: "z", round: 0 }),
    );
  });
});

describe("directions for 30 businesses", () => {
  const all = businesses.map((_, index) => draw(index));

  it("are deterministic", () => {
    expect(draw(0)).toEqual(all[0]);
    expect(draw(17)).toEqual(all[17]);
  });

  it("change on a redo", () => {
    expect(draw(0, 1).directions.map((d) => d.identity.fingerprint)).not.toEqual(
      all[0]?.directions.map((d) => d.identity.fingerprint),
    );
  });

  it("are 3 valid identities with AA palettes", () => {
    for (const result of all) {
      expect(result.directions.map((d) => d.id)).toEqual(["fiel-a-marca", "evolucao", "contraste"]);
      for (const direction of result.directions) {
        expect(identitySchema.safeParse(direction.identity).error?.issues).toBeUndefined();
        expect(contrastIssues(direction.identity.palette)).toEqual([]);
      }
    }
  });

  it("differ from each other by the minimum distance", () => {
    for (const result of all) {
      expect(result.warnings).toEqual([]);
      const [a, b, c] = result.directions.map((d) => d.features);
      if (!a || !b || !c) throw new Error("missing direction");
      for (const [x, y] of [
        [a, b],
        [a, c],
        [b, c],
      ] as const) {
        expect(designDistance(x, y)).toBeGreaterThanOrEqual(MIN_DIRECTION_DISTANCE);
      }
    }
  });

  it("start from the client's feelings and contrast with them", () => {
    businesses.forEach((business, index) => {
      const [first, second, third] = all[index]?.directions ?? [];
      if (business.feelings[0]) expect(first?.identity.personality).toBe(business.feelings[0]);
      if (business.feelings[1]) expect(second?.identity.personality).toBe(business.feelings[1]);
      expect(third?.identity.personality).not.toBe(first?.identity.personality);
      expect(third?.identity.personality).not.toBe(second?.identity.personality);
    });
  });

  it("keep the brand color in the faithful direction when it reads on the page", () => {
    businesses.forEach((business, index) => {
      const brand = business.brandColors[0];
      const faithful = all[index]?.directions[0]?.identity.palette;
      if (!brand || !faithful) return;
      if (contrastRatio(brand, faithful.background) >= 3) {
        expect(faithful.primary).toBe(brand.toUpperCase());
      }
    });
  });

  it("respect the photos the client has and the logo", () => {
    businesses.forEach((business, index) => {
      for (const direction of all[index]?.directions ?? []) {
        const hero = fixtureVariants.find((v) => v.id === direction.identity.heroVariant);
        if (business.photos === "none") {
          expect(hero?.requires.photo).not.toBe("required");
          expect(direction.identity.imageTreatment).toBe("none");
          expect(direction.identity.sectionVariants.galeria).toBeUndefined();
        }
        if (business.photos !== "good") expect(hero?.requires.goodPhoto).not.toBe(true);
        expect(direction.identity.markStyle === "logo").toBe(business.hasLogo);
      }
    });
  });

  it("use a hero and section variants that suit the family", () => {
    for (const result of all) {
      for (const direction of result.directions) {
        expect(direction.identity.heroVariant).toMatch(/^hero-/);
        expect(Object.keys(direction.identity.sectionVariants).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("uniqueness registry", () => {
  it("keeps 12 bakeries of the same city apart", async () => {
    const registry = new MemoryRegistry();
    const engine = new DeterministicEngine(registry, fixtureVariants);
    const designs = [];
    let warnings = 0;
    for (let index = 0; index < 12; index++) {
      const siteId = `site-${index}`;
      const input = {
        name: `Padaria ${index}`,
        city: "Santa Rita do Sapucaí",
        category: "padaria",
        family: "food" as const,
        feelings: ["acolhedor" as const],
        brandColors: [],
        hasLogo: false,
        photos: "good" as const,
        round: 0,
      };
      const result = await engine.generateDirections({ siteId, input });
      warnings += result.warnings.length;
      const chosen = result.directions[0];
      if (!chosen) throw new Error("no direction");
      for (const other of designs) {
        expect(designDistance(chosen.features, other)).toBeGreaterThanOrEqual(MIN_SITE_DISTANCE);
      }
      designs.push(chosen.features);
      await engine.recordApproved(siteId, "food", "santa rita do sapucai", chosen);
    }
    expect(warnings).toBe(0);
  });

  it("only compares sites of the same family and city", async () => {
    const registry = new MemoryRegistry();
    const direction = draw(0).directions[0];
    if (!direction) throw new Error("no direction");
    await registry.record({
      siteId: "a",
      family: "food",
      city: "Itajubá",
      fingerprint: direction.identity.fingerprint,
      features: direction.features,
    });
    expect(await registry.near("food", "ITAJUBA")).toHaveLength(1);
    expect(await registry.near("beauty", "Itajubá")).toHaveLength(0);
    expect(await registry.near("food", "Itajubá", "a")).toHaveLength(0);
  });
});

describe("fingerprint", () => {
  it("is 16 hex characters and the same for the same design", () => {
    const [a] = draw(3).directions;
    const [b] = draw(3).directions;
    expect(a?.identity.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(a?.identity.fingerprint).toBe(b?.identity.fingerprint);
  });
});

describe("the approved site", () => {
  it("is a valid 1.2 config", async () => {
    const { readFileSync } = await import("node:fs");
    const { approveDirection } = await import("../src/index.js");
    const config = JSON.parse(
      readFileSync(new URL("../../../docs/site-config.example.json", import.meta.url), "utf8"),
    );
    const direction = draw(0).directions[1];
    if (!direction) throw new Error("no direction");
    config.design = approveDirection(config.design, direction);
    expect(parseSiteConfig(config).error?.issues).toBeUndefined();
  });
});
