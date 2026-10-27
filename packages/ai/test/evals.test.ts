import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { variants } from "@brotasites/catalog";
import { siteConfigSchema } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import { configOf, engineInputOf, facts } from "../src/evals/businesses.js";
import { evaluate } from "../src/evals/evaluate.js";
import { compositionSchema, copySchema, SimulatedModelClient } from "../src/index.js";

// The 30-business evaluation in simulated mode, on every CI run. The summary is printed, so a
// change to a prompt, playbook or check shows its effect in the CI log. With a real model:
// `AI_MODE=live ... pnpm --filter @brotasites/ai eval`.

describe("evaluation set", () => {
  it("has 30 valid businesses, 10 per family of this round", () => {
    expect(facts).toHaveLength(30);
    for (const family of ["food", "beauty", "events-creative"]) {
      expect(facts.filter((item) => item.family === family)).toHaveLength(10);
    }
    for (const item of facts) {
      const parsed = siteConfigSchema.safeParse(configOf(item));
      expect(parsed.success, `${item.name}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it("builds a structured-output schema for every business", () => {
    for (const item of facts) {
      expect(() => zodOutputFormat(compositionSchema(engineInputOf(item), variants))).not.toThrow();
      expect(() =>
        zodOutputFormat(copySchema(siteConfigSchema.parse(configOf(item)))),
      ).not.toThrow();
    }
  });

  it("meets the bar in simulated mode", async () => {
    const report = await evaluate(new SimulatedModelClient());
    console.log("AI evaluation (simulated):", JSON.stringify(report.summary));
    const { summary } = report;
    expect(summary.jsonValidity).toBe(1);
    expect(summary.answersWithInventedFacts).toBe(0);
    expect(summary.answersWithBannedPhrases).toBe(0);
    expect(summary.genericHeroes).toBe(0);
    expect(summary.finalFactIssues).toBe(0);
    expect(summary.aiCopy).toBe(30);
    expect(summary.aiDirections).toBeGreaterThanOrEqual(27);
    expect(summary.minDirectionDistance).toBeGreaterThanOrEqual(0.45);
    expect(summary.costUsd).toBe(0);
  });
});
