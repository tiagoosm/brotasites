import { designDistance, MemoryRegistry } from "@brotasites/engine";
import { siteConfigSchema } from "@brotasites/schema/v1.2";
import {
  AiDirector,
  type AiEvent,
  checkFacts,
  copyFields,
  copyFromConfig,
  copyInputFrom,
  type ModelClient,
  sourceTexts,
} from "../index.js";
import { configOf, engineInputOf, facts } from "./businesses.js";

// The evaluation of the 30 businesses (docs/ai-and-reviewer.md, Evaluations). Metrics: JSON
// validity of the model's answers, invented facts and banned phrases in them (caught and
// thrown away; the final sites must have none), diversity across the 3 directions and the
// distance between sites of the same family. Works with the simulated or the live model.

export interface EvalCase {
  name: string;
  family: string;
  directions: { source: "ai" | "engine"; minDistance: number };
  copy: { source: "ai" | "engine"; finalFactIssues: number };
}

export interface EvalReport {
  model: string;
  cases: EvalCase[];
  summary: {
    modelCalls: number;
    invalidAnswers: number;
    jsonValidity: number;
    answersWithInventedFacts: number;
    answersWithBannedPhrases: number;
    genericHeroes: number;
    aiDirections: number;
    aiCopy: number;
    finalFactIssues: number;
    minDirectionDistance: number;
    minSameFamilyDistance: number;
    costUsd: number;
  };
}

export async function evaluate(model: ModelClient): Promise<EvalReport> {
  const events: AiEvent[] = [];
  const registry = new MemoryRegistry();
  const director = new AiDirector({ model, registry, onEvent: (event) => events.push(event) });
  const cases: EvalCase[] = [];
  const approved: { family: string; features: Parameters<typeof designDistance>[0] }[] = [];
  let costUsd = 0;

  for (const [index, item] of facts.entries()) {
    const siteId = `eval-${index}`;
    const input = engineInputOf(item);
    const directions = await director.generateDirections({ siteId, input });
    costUsd += directions.costUsd;
    const list = directions.directions;
    let minDistance = 1;
    list.forEach((a, i) => {
      for (const b of list.slice(i + 1))
        minDistance = Math.min(minDistance, designDistance(a.features, b.features));
    });
    const first = list[0];
    if (first) {
      await director.recordApproved(siteId, input.family, input.city, first);
      approved.push({ family: input.family, features: first.features });
    }

    const config = siteConfigSchema.parse(configOf(item));
    const copy = await director.writeCopy(config, { siteId, accountId: siteId });
    costUsd += copy.costUsd;
    const finalInput = copyInputFrom(config);
    const finalFields = copyFields(copyFromConfig(copy.config));
    const finalFactIssues =
      copy.source === "ai" ? checkFacts(finalFields, { texts: sourceTexts(finalInput) }).length : 0;
    cases.push({
      name: item.name,
      family: item.family,
      directions: { source: directions.source, minDistance },
      copy: { source: copy.source, finalFactIssues },
    });
  }

  let minSameFamilyDistance = 1;
  approved.forEach((a, i) => {
    for (const b of approved.slice(i + 1)) {
      if (a.family === b.family) {
        minSameFamilyDistance = Math.min(
          minSameFamilyDistance,
          designDistance(a.features, b.features),
        );
      }
    }
  });

  const calls = events.filter((event) => event.type === "model-call").length;
  const rejected = events.filter(
    (event): event is Extract<AiEvent, { type: "rejected" }> => event.type === "rejected",
  );
  const has = (pattern: RegExp) =>
    rejected.filter((event) => event.problems.some((problem) => pattern.test(problem))).length;
  const invalidAnswers = has(/not valid JSON|^[\w.()-]+: (Invalid|Too|Unrecognized|Expected)/);
  return {
    model: model.modelId,
    cases,
    summary: {
      modelCalls: calls,
      invalidAnswers,
      jsonValidity: calls === 0 ? 1 : (calls - invalidAnswers) / calls,
      answersWithInventedFacts: has(/is not in the data/),
      answersWithBannedPhrases: has(/: banned "/),
      genericHeroes: has(/names no concrete fact/),
      aiDirections: cases.filter((item) => item.directions.source === "ai").length,
      aiCopy: cases.filter((item) => item.copy.source === "ai").length,
      finalFactIssues: cases.reduce((sum, item) => sum + item.copy.finalFactIssues, 0),
      minDirectionDistance: Math.min(...cases.map((item) => item.directions.minDistance)),
      minSameFamilyDistance,
      costUsd,
    },
  };
}
