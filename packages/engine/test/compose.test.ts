import { contrastIssues } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import {
  CompositionRejected,
  choiceOf,
  composeDirections,
  drawDirections,
  type EngineInput,
} from "../src/index.js";
import { businesses, fixtureVariants } from "./fixtures.js";

const inputs: EngineInput[] = businesses.map((business) => ({ ...business, round: 0 }));

describe("composeDirections", () => {
  it("accepts the engine's own choices for the 30 businesses, with AA palettes", () => {
    let accepted = 0;
    for (const input of inputs) {
      const choices = drawDirections(input, fixtureVariants).directions.map(choiceOf);
      try {
        const result = composeDirections(input, fixtureVariants, choices);
        accepted++;
        for (const direction of result.directions) {
          expect(contrastIssues(direction.identity.palette)).toEqual([]);
        }
      } catch (error) {
        // Only a distance can fail: the palettes are redrawn, every id is valid.
        expect((error as CompositionRejected).reasons.join()).toMatch(/too close/);
      }
    }
    expect(accepted).toBeGreaterThanOrEqual(27);
  });

  it("rejects ids outside the catalog, the family or the personality", () => {
    const input = inputs[0] as EngineInput;
    const choices = drawDirections(input, fixtureVariants).directions.map(choiceOf);
    const broken = choices.map((choice, index) =>
      index === 0
        ? { ...choice, heroVariant: "hero-made-up", fontPair: "comic-sans", shape: "zigzag-x" }
        : choice,
    );
    const error = (() => {
      try {
        composeDirections(input, fixtureVariants, broken);
      } catch (caught) {
        return caught as CompositionRejected;
      }
    })();
    expect(error).toBeInstanceOf(CompositionRejected);
    expect(error?.reasons.join("\n")).toMatch(/hero hero-made-up/);
    expect(error?.reasons.join("\n")).toMatch(/font pair comic-sans/);
    expect(error?.reasons.join("\n")).toMatch(/shape zigzag-x/);
  });

  it("rejects a missing direction and three copies of the same design", () => {
    const input = inputs[1] as EngineInput;
    const choices = drawDirections(input, fixtureVariants).directions.map(choiceOf);
    expect(() => composeDirections(input, fixtureVariants, choices.slice(0, 2))).toThrow(
      CompositionRejected,
    );
    const first = choices[0] as (typeof choices)[number];
    const same = (["fiel-a-marca", "evolucao", "contraste"] as const).map((id) => ({
      ...first,
      id,
    }));
    expect(() => composeDirections(input, fixtureVariants, same)).toThrow(/too close/);
  });

  it("keeps the minimum distance from other sites of the same family and city", () => {
    const input = inputs[0] as EngineInput;
    const drawn = drawDirections(input, fixtureVariants);
    const choices = drawn.directions.map(choiceOf);
    const neighbors = composeDirections(input, fixtureVariants, choices).directions.map(
      (direction) => direction.features,
    );
    expect(() => composeDirections(input, fixtureVariants, choices, neighbors)).toThrow(
      /another site/,
    );
  });
});
