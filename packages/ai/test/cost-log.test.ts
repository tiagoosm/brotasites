import { variants } from "@brotasites/catalog";
import { choiceOf, drawDirections, MemoryRegistry } from "@brotasites/engine";
import { describe, expect, it } from "vitest";
import { engineInputOf } from "../src/evals/businesses.js";
import {
  AiDirector,
  compositionOf,
  costOf,
  MemoryUsageStore,
  type ModelCall,
  ScriptedModelClient,
  SpendingGuard,
} from "../src/index.js";
import { config, padaria } from "./helpers.js";

// The cost log (E24): one row per model call, with its task, model, tokens and cost, written in
// one place (SpendingGuard), and never a reason for a site to fail.

const input = engineInputOf(padaria);
const caller = { siteId: "s1", accountId: "a1" };
const usage = { inputTokens: 1000, outputTokens: 500, cacheWriteTokens: 0, cacheReadTokens: 0 };

const composition = () =>
  JSON.stringify(
    compositionOf(drawDirections({ ...input, name: "outro" }, variants).directions.map(choiceOf)),
  );

describe("cost log", () => {
  it("keeps each recorded call with its cost, and adds it to the day's spend", async () => {
    const store = new MemoryUsageStore();
    const guard = new SpendingGuard(store);
    const call: ModelCall = {
      task: "directions",
      model: "claude-opus-5-5",
      usage,
      costUsd: costOf("claude-opus-5-5", usage),
      ...caller,
    };
    await guard.record(call.costUsd, call);
    expect(store.calls).toEqual([call]);
    expect(call.costUsd).toBeCloseTo(0.014);
  });

  it("logs the art director's call as 'directions', with the site and the account", async () => {
    const store = new MemoryUsageStore();
    const model = new ScriptedModelClient([composition()], "claude-opus-5-5");
    const ai = new AiDirector({
      model,
      registry: new MemoryRegistry(),
      guard: new SpendingGuard(store),
    });
    await ai.generateDirections({ siteId: "s1", accountId: "a1", input });
    expect(store.calls).toHaveLength(1);
    expect(store.calls[0]).toMatchObject({
      task: "directions",
      model: "claude-opus-5-5",
      siteId: "s1",
      accountId: "a1",
      usage,
    });
    expect(store.calls[0]?.costUsd).toBeCloseTo(costOf("claude-opus-5-5", usage));
  });

  it("tells copy from a rewrite with notes", async () => {
    const store = new MemoryUsageStore();
    const ai = new AiDirector({
      model: new ScriptedModelClient(["{}", "{}", "{}", "{}"], "claude-opus-5-5"),
      registry: new MemoryRegistry(),
      guard: new SpendingGuard(store),
    });
    await ai.writeCopy(config(), caller).catch(() => undefined);
    await ai.writeCopy(config(), caller, { notes: ["Encurtar o título."] }).catch(() => undefined);
    const tasks = store.calls.map((call) => call.task);
    expect(tasks).toContain("copy");
    expect(tasks).toContain("rewrite");
  });

  it("logs the reviewer's calls without counting them in the budget", async () => {
    const store = new MemoryUsageStore();
    const ai = new AiDirector({
      model: new ScriptedModelClient([]),
      registry: new MemoryRegistry(),
      guard: new SpendingGuard(store),
    });
    await ai.logCall({
      task: "review",
      model: "claude-opus-5-5",
      usage,
      costUsd: 0.014,
      ...caller,
    });
    expect(store.calls).toHaveLength(1);
    expect(await store.spend(new Intl.DateTimeFormat("en-CA").format(new Date()))).toBe(0);
  });

  it("never fails the site when the log cannot be written, and reports it", async () => {
    const store = new MemoryUsageStore();
    store.logCall = async () => {
      throw new Error("database down");
    };
    const errors: unknown[] = [];
    const guard = new SpendingGuard(store, undefined, undefined, undefined, (error) =>
      errors.push(error),
    );
    const ai = new AiDirector({
      model: new ScriptedModelClient([composition()], "claude-opus-5-5"),
      registry: new MemoryRegistry(),
      guard,
    });
    const result = await ai.generateDirections({ siteId: "s1", accountId: "a1", input });
    expect(result.directions).toHaveLength(3);
    expect(errors).toHaveLength(1);
    // The spend still counts in the budget.
    expect(result.costUsd).toBeCloseTo(costOf("claude-opus-5-5", usage));
  });
});
