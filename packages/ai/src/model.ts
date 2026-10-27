import type { Usage } from "./prices.js";

// What the AI layer needs from a model: one request in, one JSON text out. The live client
// calls Claude (anthropic.ts); the simulated one answers without any API call (simulated.ts).
// The model gets no tools and no secrets: only the prompt, the delimited data and the schema.

export type AiTask = "art-director" | "copy";

export interface ModelRequest {
  task: AiTask;
  /** Instructions (English). Stable per prompt version, so the API can cache it. */
  system: string;
  /** The user turn: the task and the delimited client data. */
  prompt: string;
  /** JSON Schema of the answer (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens: number;
  /** The structured input behind the prompt; only the simulated client reads it. */
  payload: unknown;
}

export interface ModelResponse {
  text: string;
  /** The model that answered (a server-side fallback may answer instead of the requested one). */
  model: string;
  usage: Usage;
}

/** The model did not give a usable answer: refusal, cut-off output, API error. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface ModelClient {
  readonly modelId: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

/** Answers from a fixed list, in order: for tests of retries, fallbacks and hostile output. */
export class ScriptedModelClient implements ModelClient {
  readonly requests: ModelRequest[] = [];
  constructor(
    private readonly answers: (string | Error)[],
    readonly modelId = "scripted",
  ) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(request);
    const answer = this.answers.shift();
    if (answer === undefined) throw new ModelError("No scripted answer left", false);
    if (answer instanceof Error) throw answer;
    return {
      text: answer,
      model: this.modelId,
      usage: { inputTokens: 1000, outputTokens: 500, cacheWriteTokens: 0, cacheReadTokens: 0 },
    };
  }
}
