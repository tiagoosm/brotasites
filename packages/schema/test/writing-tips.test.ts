import { describe, expect, it } from "vitest";
import { families, fewFacts, storyHints, storyQuestions, writingTips } from "../src/v1.2/index.js";

describe("writing tips (E41)", () => {
  it("every family has a thin and a detailed example and two guiding questions", () => {
    for (const family of families) {
      const tip = writingTips[family];
      expect(tip.good.length, family).toBeGreaterThan(tip.weak.length * 2);
      expect(
        tip.questions.every((question) => question.endsWith("?")),
        family,
      ).toBe(true);
      // A client's own words: never a price, a percentage or an award.
      expect(`${tip.weak} ${tip.good}`).not.toMatch(/R\$|%|prêmio|melhor d[oa]/i);
    }
  });

  it("every story question has a hint", () => {
    for (const [key] of storyQuestions) expect(storyHints[key]).toMatch(/^Ex\.: /);
  });

  it("knows when the client gave little", () => {
    expect(fewFacts({ description: "Padaria." })).toBe(true);
    expect(fewFacts({ description: "Padaria.", story: { origin: "  " } })).toBe(true);
    expect(fewFacts({ description: "Padaria.", story: { bestseller: "Pão de queijo" } })).toBe(
      false,
    );
    expect(fewFacts({ description: "x".repeat(80) })).toBe(false);
  });
});
