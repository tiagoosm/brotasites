import { variants as catalogVariants, type Variant } from "@brotasites/catalog";
import { choiceOf, drawDirections, type EngineInput } from "@brotasites/engine";
import { compositionOf } from "./composition.js";
import type { CopyInput } from "./copy.js";
import { draftCopy } from "./draft.js";
import { type ModelClient, ModelError, type ModelRequest, type ModelResponse } from "./model.js";

// The "simulated" mode (docs/ai-and-reviewer.md, Providers): answers in the shape of the real
// model without any API call, for tests, development and CI. The art director answers with
// the engine's own choices for a shifted seed; the copywriter with the client's own text.

export type SimulatedPayload =
  | { task: "art-director"; input: EngineInput }
  | { task: "copy"; input: CopyInput };

export class SimulatedModelClient implements ModelClient {
  readonly modelId = "simulated";
  calls = 0;

  constructor(private readonly variants: readonly Variant[] = catalogVariants) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    this.calls++;
    const payload = request.payload as SimulatedPayload;
    let answer: unknown;
    if (payload.task === "art-director") {
      const shifted = { ...payload.input, name: `${payload.input.name}|simulated` };
      const drawn = drawDirections(shifted, this.variants);
      answer = compositionOf(drawn.directions.map(choiceOf));
    } else if (payload.task === "copy") {
      answer = draftCopy(payload.input);
    } else {
      // The reviewer has its own simulated agent (packages/reviewer).
      throw new ModelError(`The simulated model does not answer ${request.task}`, false);
    }
    const text = JSON.stringify(answer);
    return {
      text,
      model: this.modelId,
      usage: {
        inputTokens: Math.ceil((request.system.length + request.prompt.length) / 4),
        outputTokens: Math.ceil(text.length / 4),
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      },
    };
  }
}
