import Anthropic from "@anthropic-ai/sdk";
import { type ModelClient, ModelError, type ModelRequest, type ModelResponse } from "./model.js";

// The live client: Claude through the Anthropic SDK. One Messages request per task, with:
// - the instructions as a cached system block (they repeat on every request);
// - structured outputs, so the answer is JSON in the task's schema (we still validate it);
// - adaptive thinking (the default on current models) at the configured effort;
// - server-side refusal fallbacks ("default"), so a false-positive safety decline is retried
//   on the model Anthropic recommends instead of failing the round.
// No tools, no sampling parameters, nothing but the prompt and the delimited client data.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicClientOptions {
  modelId: string;
  apiKey?: string;
  effort?: Effort;
  /** Injected for tests; the SDK's own fetch otherwise. */
  fetch?: typeof fetch;
  maxRetries?: number;
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AnthropicModelClient implements ModelClient {
  readonly modelId: string;
  private readonly client: Anthropic;
  private readonly effort: Effort;

  constructor(options: AnthropicClientOptions) {
    this.modelId = options.modelId;
    this.effort = options.effort ?? "medium";
    this.client = new Anthropic({
      apiKey: options.apiKey,
      maxRetries: options.maxRetries ?? 2,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await this.client.beta.messages.create({
        model: this.modelId,
        max_tokens: request.maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: request.prompt }],
        output_config: {
          effort: this.effort,
          format: { type: "json_schema", schema: request.schema },
        },
      });
    } catch (error) {
      if (
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError
      ) {
        throw new ModelError(`Claude unavailable: ${error.message}`, true);
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new ModelError(`Claude unreachable: ${error.message}`, true);
      }
      if (error instanceof Anthropic.APIError) {
        throw new ModelError(`Claude request failed (${error.status}): ${error.message}`, false);
      }
      throw error;
    }

    if (message.stop_reason === "refusal") {
      throw new ModelError(
        `Claude declined (${message.stop_details?.category ?? "no category"})`,
        false,
      );
    }
    if (message.stop_reason === "max_tokens") {
      throw new ModelError("Claude's answer was cut off (max_tokens)", true);
    }
    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    const usage = message.usage;
    return {
      text,
      model: message.model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}
