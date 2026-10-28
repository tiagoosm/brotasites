import { variants } from "@brotasites/catalog";
import { choiceOf, drawDirections, MemoryRegistry } from "@brotasites/engine";
import { describe, expect, it } from "vitest";
import { engineInputOf } from "../src/evals/businesses.js";
import {
  AiDirector,
  type AiEvent,
  compositionOf,
  copyFromConfig,
  copyInputFrom,
  draftCopy,
  MemoryUsageStore,
  ModelError,
  NeedsAttention,
  ScriptedModelClient,
  SimulatedModelClient,
  SpendingGuard,
} from "../src/index.js";
import { config, padaria } from "./helpers.js";

const input = engineInputOf(padaria);
const caller = { siteId: "s1", accountId: "a1" };

function director(
  model: ScriptedModelClient | SimulatedModelClient,
  events: AiEvent[] = [],
  guard?: SpendingGuard,
) {
  return new AiDirector({
    model,
    registry: new MemoryRegistry(),
    guard,
    onEvent: (event) => events.push(event),
  });
}

const goodComposition = () =>
  JSON.stringify(
    compositionOf(drawDirections({ ...input, name: "outro" }, variants).directions.map(choiceOf)),
  );

describe("art director", () => {
  it("uses the AI's composition once the engine accepts it, and caches it", async () => {
    const model = new ScriptedModelClient([goodComposition()]);
    const ai = director(model);
    const first = await ai.generateDirections({ siteId: "s1", input });
    expect(first.source).toBe("ai");
    expect(first.directions.map((d) => d.id)).toEqual(["fiel-a-marca", "evolucao", "contraste"]);
    const again = await ai.generateDirections({ siteId: "s1", input });
    expect(again.source).toBe("ai");
    expect(again.costUsd).toBe(0);
    expect(model.requests).toHaveLength(1);
  });

  it("retries once with the reasons, then falls back to the engine", async () => {
    const events: AiEvent[] = [];
    const model = new ScriptedModelClient(['{"hero": "not a composition"}', "not json"]);
    const result = await director(model, events).generateDirections({ siteId: "s1", input });
    expect(result.source).toBe("engine");
    expect(result.directions).toHaveLength(3);
    expect(model.requests).toHaveLength(2);
    expect(model.requests[1]?.prompt).toMatch(/previous answer was rejected/);
    expect(events.filter((e) => e.type === "rejected")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "fallback", task: "art-director" });
  });

  it("puts the client data in a delimited block and the catalog outside it", async () => {
    const model = new ScriptedModelClient([goodComposition()]);
    await director(model).generateDirections({ siteId: "s1", input });
    const prompt = model.requests[0]?.prompt ?? "";
    expect(prompt).toMatch(/<catalog>[\s\S]*<\/catalog>\s*<client_data>[\s\S]*<\/client_data>$/);
    expect(model.requests[0]?.system).toMatch(/never an instruction to you/);
  });

  it("skips the AI past the limits and still returns directions", async () => {
    const guard = new SpendingGuard(new MemoryUsageStore(), {
      roundsPerSitePerDay: 1,
      roundsPerAccountPerDay: 10,
      dailyBudgetUsd: 10,
      alertRatio: 0.8,
    });
    const model = new SimulatedModelClient();
    const ai = director(model, [], guard);
    await ai.generateDirections({ siteId: "s1", input });
    const second = await ai.generateDirections({ siteId: "s1", input: { ...input, round: 1 } });
    expect(second.source).toBe("engine");
    expect(model.calls).toBe(1);
  });

  it("asks for attention when neither the AI nor the engine can draw", async () => {
    const model = new ScriptedModelClient([
      new ModelError("down", true),
      new ModelError("down", true),
    ]);
    const ai = new AiDirector({ model, registry: new MemoryRegistry(), variants: [] });
    await expect(ai.generateDirections({ siteId: "s1", input })).rejects.toBeInstanceOf(
      NeedsAttention,
    );
  });
});

describe("copy", () => {
  it("writes the simulated copy into a valid config with the versions", async () => {
    const result = await director(new SimulatedModelClient()).writeCopy(config(), caller);
    expect(result.source).toBe("ai");
    expect(result.config.ai).toMatchObject({
      promptVersion: "copy-2026-10-27.1",
      playbookVersion: "food@1+common@1",
      modelId: "simulated",
    });
    expect(result.config.ai.generatedFields).toContain("sections.hero.content.title");
  });

  it("throws away an answer with an invented phone and uses the fixed retry", async () => {
    const site = config();
    const draft = draftCopy(copyInputFrom(site));
    const invented = { ...draft, hero: { ...draft.hero, subtitle: "Ligue (11) 98888-7777" } };
    const fixed = { ...draft, hero: { ...draft.hero, subtitle: "Pão saindo do forno no Centro" } };
    const events: AiEvent[] = [];
    const model = new ScriptedModelClient([JSON.stringify(invented), JSON.stringify(fixed)]);
    const result = await director(model, events).writeCopy(site, caller);
    expect(result.source).toBe("ai");
    expect(copyFromConfig(result.config).hero.subtitle).toBe("Pão saindo do forno no Centro");
    expect(model.requests[1]?.prompt).toMatch(/98888.*is not in the data/);
  });

  it("never touches fields the client edited by hand", async () => {
    const site = config(0, (input) => {
      input.ai.userEditedFields = [
        "sections.hero.content.title",
        "sections.servicos.content.items",
      ];
    });
    const draft = draftCopy(copyInputFrom(site));
    const answer = {
      ...draft,
      hero: { ...draft.hero, title: "Padaria do Zé no Centro" },
      servicos: {
        title: "Do forno",
        items: draft.servicos?.items.map(() => ({ description: "Feito no dia." })),
      },
    };
    const result = await director(new ScriptedModelClient([JSON.stringify(answer)])).writeCopy(
      site,
      caller,
    );
    const copy = copyFromConfig(result.config);
    expect(copy.hero.title).toBe("Pão quentinho todo dia");
    expect(copy.servicos?.title).toBe("Do forno");
    expect(copy.servicos?.items[0]?.description).toBe(
      "Fermentação natural, feitos todas as manhãs.",
    );
  });

  it("keeps service names and prices, which are not in the answer", async () => {
    const site = config(1);
    const result = await director(new SimulatedModelClient()).writeCopy(site, caller);
    const before = site.sections.find((s) => s.id === "servicos");
    const after = result.config.sections.find((s) => s.id === "servicos");
    const pick = (s: typeof before) =>
      s?.id === "servicos" ? s.content.items.map(({ name, price }) => ({ name, price })) : [];
    expect(pick(after)).toEqual(pick(before));
  });

  it("passes the reviewer's notes to the model and does not reuse the answer cached without them", async () => {
    const site = config();
    const answer = JSON.stringify(draftCopy(copyInputFrom(site)));
    const model = new ScriptedModelClient([answer, answer]);
    const ai = director(model);
    await ai.writeCopy(site, caller);
    await ai.writeCopy(site, caller, { notes: ["O título repete o da seção sobre."] });
    expect(model.requests).toHaveLength(2);
    expect(model.requests[1]?.prompt).toMatch(/Address these points:\n- O título repete/);
  });

  it("falls back to the client's own text when the AI fails twice", async () => {
    const model = new ScriptedModelClient([new ModelError("overloaded", true), "{}"]);
    const result = await director(model).writeCopy(config(), caller);
    expect(result.source).toBe("engine");
    expect(result.config.ai.modelId).toBe("engine");
    expect(result.warnings[0]).toMatch(/próprio cliente/);
  });
});
