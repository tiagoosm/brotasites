import { variants as catalogVariants, type Variant } from "@brotasites/catalog";
import { type RedoFeedback, type RedoReason, redoReasons } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import {
  allowedVariants,
  CompositionRejected,
  choiceOf,
  composeDirections,
  designDistance,
  drawDirections,
  type EngineInput,
  MIN_REDO_DISTANCE,
  type PreviousDirection,
  previousFeatures,
  VISIBLE_AXES_REQUIRED,
  visibleDifferences,
} from "../src/index.js";
import { businesses, fixtureVariants } from "./fixtures.js";

// E41: "Refazer" changes for real. Rounds 0 -> 1 -> 2 of 30 fictional businesses, with the
// stand-in variants and with the real catalog: every new direction keeps MIN_REDO_DISTANCE and
// 2 visible differences from every earlier one (or the admin gets a warning), personalities
// rotate, and the chips steer the engine deterministically.

type Rounds = { inputs: EngineInput[]; results: ReturnType<typeof drawDirections>[] };

function rounds(index: number, variants: readonly Variant[], feedback?: RedoFeedback): Rounds {
  const business = businesses[index] as (typeof businesses)[number];
  const previous: PreviousDirection[] = [];
  const inputs: EngineInput[] = [];
  const results: ReturnType<typeof drawDirections>[] = [];
  for (let round = 0; round <= 2; round++) {
    const input: EngineInput = {
      ...business,
      round,
      ...(round > 0 ? { previous: [...previous], ...(feedback ? { feedback } : {}) } : {}),
    };
    const result = drawDirections(input, variants);
    inputs.push(input);
    results.push(result);
    for (const direction of result.directions) {
      previous.push({ round, identity: direction.identity });
    }
  }
  return { inputs, results };
}

const catalogs: [string, readonly Variant[]][] = [
  ["stand-in variants", fixtureVariants],
  ["the real catalog", catalogVariants],
];

describe.each(catalogs)("redo rounds with %s", (_name, variants) => {
  const all = businesses.map((_, index) => rounds(index, variants));

  it("keeps the distance and 2 visible differences from every earlier round, or warns", () => {
    let pairs = 0;
    let warned = 0;
    for (const { inputs, results } of all) {
      for (let round = 1; round <= 2; round++) {
        const earlier = previousFeatures(inputs[round]?.previous ?? []);
        const result = results[round] as ReturnType<typeof drawDirections>;
        for (const direction of result.directions) {
          const close = earlier.some(
            (other) =>
              designDistance(direction.features, other) < MIN_REDO_DISTANCE ||
              visibleDifferences(direction.features, other).length < VISIBLE_AXES_REQUIRED,
          );
          pairs += earlier.length;
          if (close) {
            warned++;
            expect(result.warnings.join(" ")).toContain(direction.label);
          }
        }
      }
    }
    expect(pairs).toBeGreaterThan(0);
    // The rule holds for nearly every direction; the rest are flagged to the admin.
    expect(warned).toBeLessThanOrEqual(Math.ceil(all.length * 6 * 0.05));
  });

  it("rotates personalities: at least 2 of 3 new against the round before", () => {
    for (const { results } of all) {
      for (let round = 1; round <= 2; round++) {
        const before = new Set(
          results[round - 1]?.directions.map((direction) => direction.identity.personality),
        );
        const now = results[round]?.directions.map((d) => d.identity.personality) ?? [];
        expect(now.filter((personality) => !before.has(personality)).length).toBeGreaterThanOrEqual(
          2,
        );
        expect(new Set(now).size).toBe(3);
      }
    }
  });

  it("round 0 draws exactly as before", () => {
    businesses.forEach((business, index) => {
      expect(all[index]?.results[0]).toEqual(drawDirections({ ...business, round: 0 }, variants));
    });
  });

  it("is deterministic: same answers, round and feedback give the same directions", () => {
    const feedback: RedoFeedback = { reasons: ["darker", "fonts"] };
    expect(rounds(3, variants, feedback)).toEqual(rounds(3, variants, feedback));
  });
});

describe("the chips steer the engine", () => {
  const variants = catalogVariants;
  const second = (index: number, reasons: RedoReason[]) => {
    const business = businesses[index] as (typeof businesses)[number];
    const first = drawDirections({ ...business, round: 0 }, variants);
    const previous = first.directions.map((direction) => ({
      round: 0,
      identity: direction.identity,
    }));
    return {
      first,
      next: drawDirections({ ...business, round: 1, previous, feedback: { reasons } }, variants),
    };
  };
  const sample = [0, 4, 9, 13, 17, 22, 27];

  it("Mais escuro: dark wherever the personality allows it", () => {
    for (const index of sample) {
      const { next } = second(index, ["darker"]);
      for (const direction of next.directions) {
        if (direction.identity.personality !== "acolhedor") {
          expect(direction.features.mode, direction.identity.personality).toBe("dark");
        }
      }
    }
  });

  it("Mais claro and Mais colorido: light everywhere", () => {
    for (const reasons of [["lighter"], ["colorful"]] as RedoReason[][]) {
      for (const index of sample) {
        for (const direction of second(index, reasons).next.directions) {
          expect(direction.features.mode).toBe("light");
        }
      }
    }
  });

  it("Outras fontes: no font pair of the round before", () => {
    for (const index of sample) {
      const { first, next } = second(index, ["fonts"]);
      const used = new Set(first.directions.map((d) => d.identity.fontPair));
      for (const direction of next.directions) {
        expect(used.has(direction.identity.fontPair)).toBe(false);
      }
    }
  });

  it("Layout diferente: no hero of the round before", () => {
    for (const index of sample) {
      const { first, next } = second(index, ["layout"]);
      const used = new Set(first.directions.map((d) => d.identity.heroVariant));
      const business = businesses[index] as (typeof businesses)[number];
      for (const direction of next.directions) {
        // Only when the catalog has another hero for this personality and family.
        const heroes = allowedVariants(
          variants,
          "hero",
          { ...business, round: 1 },
          direction.identity.personality,
        );
        if (heroes.some((hero) => !used.has(hero.id))) {
          expect(used.has(direction.identity.heroVariant)).toBe(false);
        }
      }
    }
  });

  it("the style chips choose the personalities", () => {
    const expected: [RedoReason, string[], string[]][] = [
      ["sober", ["elegante", "robusto"], ["ousado"]],
      ["classic", ["elegante", "acolhedor"], ["ousado"]],
      ["modern", ["moderno", "ousado"], ["acolhedor"]],
      ["colorful", ["ousado", "moderno", "acolhedor"], ["elegante"]],
    ];
    for (const [reason, wanted, avoided] of expected) {
      for (const index of sample) {
        const personalities = second(index, [reason]).next.directions.map(
          (d) => d.identity.personality,
        );
        expect(wanted, reason).toContain(personalities[0]);
        for (const personality of personalities) expect(avoided).not.toContain(personality);
      }
    }
  });

  it("every chip is mapped", () => {
    expect(redoReasons).toHaveLength(8);
  });
});

describe("a proposed composition is checked against earlier rounds (the AI art director)", () => {
  const business = businesses[2] as (typeof businesses)[number];
  const first = drawDirections({ ...business, round: 0 }, catalogVariants);
  const previous = first.directions.map((direction) => ({
    round: 0,
    identity: direction.identity,
  }));
  const input: EngineInput = { ...business, round: 1, previous };

  it("rejects the same 3 directions again, saying why", () => {
    expect(() =>
      composeDirections(input, catalogVariants, first.directions.map(choiceOf)),
    ).toThrowError(CompositionRejected);
    try {
      composeDirections(input, catalogVariants, first.directions.map(choiceOf));
    } catch (error) {
      const reasons = (error as CompositionRejected).reasons.join(" ");
      expect(reasons).toMatch(/new against the round before|repeats an earlier round/);
    }
  });

  it("accepts what the engine itself draws for the redo", () => {
    const next = drawDirections(input, catalogVariants);
    if (next.warnings.length === 0) {
      expect(() =>
        composeDirections(input, catalogVariants, next.directions.map(choiceOf)),
      ).not.toThrow();
    }
  });

  it("holds the client to the fonts they asked to change", () => {
    const withFonts: EngineInput = { ...input, feedback: { reasons: ["fonts"] } };
    expect(() =>
      composeDirections(withFonts, catalogVariants, first.directions.map(choiceOf)),
    ).toThrowError(/other fonts/);
  });
});
