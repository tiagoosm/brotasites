import { describe, expect, it } from "vitest";
import {
  activeVariants,
  type CatalogWeights,
  CompositionRejected,
  choiceOf,
  choicesOfIdentity,
  composeDirections,
  compositionKey,
  type Direction,
  drawDirections,
  type EngineInput,
  MIN_EXPLORATION,
  NO_WEIGHTS,
} from "../src/index.js";
import { businesses, fixtureVariants } from "./fixtures.js";

// The admin's catalog decisions (docs/catalog-promotion.md): recommended compositions are drawn
// more, retired ones never, and the draw keeps exploring.

const inputs: EngineInput[] = businesses.map((business) => ({ ...business, round: 0 }));

describe("catalog weights", () => {
  it("change nothing when there are none", () => {
    for (const input of inputs.slice(0, 5)) {
      expect(drawDirections(input, fixtureVariants, [], NO_WEIGHTS)).toEqual(
        drawDirections(input, fixtureVariants),
      );
    }
  });

  it("never draw a retired variant while the section has another", () => {
    const counts = new Map<string, number>();
    for (const input of inputs) {
      for (const direction of drawDirections(input, fixtureVariants).directions) {
        const id = direction.identity.heroVariant;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const [mostUsed] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    expect(mostUsed).toBeDefined();
    const weights: CatalogWeights = {
      ...NO_WEIGHTS,
      variants: { [mostUsed as string]: "retired" },
    };
    for (const input of inputs) {
      const heroes = drawDirections(input, fixtureVariants, [], weights).directions.map(
        (direction) => direction.identity.heroVariant,
      );
      const others = activeVariants(fixtureVariants, weights).filter(
        (variant) =>
          variant.section === "hero" &&
          (variant.families === "all" || variant.families.includes(input.family)),
      );
      if (others.some((variant) => variant.id !== mostUsed)) expect(heroes).not.toContain(mostUsed);
    }
  });

  it("keep a section's last variant even when it is retired", () => {
    const heroes = fixtureVariants.filter((variant) => variant.section === "hero");
    const weights: CatalogWeights = {
      ...NO_WEIGHTS,
      variants: Object.fromEntries(heroes.map((variant) => [variant.id, "retired"])),
    };
    expect(activeVariants(fixtureVariants, weights).filter((v) => v.section === "hero")).toEqual(
      heroes,
    );
  });

  it("draw recommended compositions more, never in Contraste, and keep exploring", () => {
    // Recommend the second direction (Evolução) of every business, as an admin would after seeing them.
    const recommended = inputs.map((input) =>
      choicesOfIdentity(
        (drawDirections(input, fixtureVariants).directions[1] as Direction).identity,
      ),
    );
    const weights: CatalogWeights = {
      variants: {},
      compositions: Object.fromEntries(recommended.map((c) => [compositionKey(c), "recommended"])),
      recommended,
    };
    const keys = new Set(Object.keys(weights.compositions));
    let suggestions = 0;
    let fromRecommended = 0;
    for (const input of inputs) {
      for (const direction of drawDirections(input, fixtureVariants, [], weights).directions) {
        suggestions++;
        const key = compositionKey(choicesOfIdentity(direction.identity));
        if (keys.has(key)) {
          fromRecommended++;
          expect(direction.id).not.toBe("contraste");
        }
      }
    }
    expect(fromRecommended).toBeGreaterThan(0);
    expect(1 - fromRecommended / suggestions).toBeGreaterThanOrEqual(MIN_EXPLORATION);
  });

  it("retire a composition from the draw and from the art director's proposals", () => {
    const input = inputs[0] as EngineInput;
    const first = drawDirections(input, fixtureVariants).directions;
    const retiredKey = compositionKey(choicesOfIdentity((first[0] as Direction).identity));
    const weights: CatalogWeights = {
      ...NO_WEIGHTS,
      compositions: { [retiredKey]: "retired" },
    };
    const again = drawDirections(input, fixtureVariants, [], weights).directions;
    expect(again.map((d) => compositionKey(choicesOfIdentity(d.identity)))).not.toContain(
      retiredKey,
    );
    expect(() =>
      composeDirections(input, fixtureVariants, first.map(choiceOf), [], weights),
    ).toThrow(CompositionRejected);
  });
});
