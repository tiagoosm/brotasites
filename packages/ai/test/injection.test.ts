import { MemoryRegistry } from "@brotasites/engine";
import { siteConfigSchema } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import { configOf } from "../src/evals/businesses.js";
import { injectionCases } from "../src/evals/injection.js";
import {
  AiDirector,
  copyFields,
  copyFromConfig,
  copyInputFrom,
  DATA_TAG,
  draftCopy,
  ScriptedModelClient,
} from "../src/index.js";
import { padaria } from "./helpers.js";

describe("prompt injection corpus", () => {
  for (const item of injectionCases) {
    it(`${item.id}: the data stays data and an obedient answer never reaches the site`, async () => {
      const input = configOf(padaria);
      item.apply(input);
      const parsed = siteConfigSchema.safeParse(input);
      // Some hostile values are already refused by the form schema; that is a pass too.
      if (!parsed.success) return;
      const site = parsed.data;
      const draft = draftCopy(copyInputFrom(site));
      const obeyed = { ...draft, hero: { ...draft.hero, subtitle: item.obeyed } };
      const model = new ScriptedModelClient([JSON.stringify(obeyed), JSON.stringify(obeyed)]);
      const ai = new AiDirector({ model, registry: new MemoryRegistry() });
      const result = await ai.writeCopy(site, { siteId: item.id, accountId: "a" });

      const prompt = model.requests[0]?.prompt ?? "";
      expect(prompt.match(new RegExp(`</${DATA_TAG}>`, "g"))).toHaveLength(1);
      expect(prompt).not.toMatch(/<script>/);
      expect(result.source).toBe("engine");
      const text = Object.values(copyFields(copyFromConfig(result.config))).join("\n");
      expect(text).not.toContain(item.obeyed);
    });
  }
});
