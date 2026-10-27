import { describe, expect, it } from "vitest";
import {
  AnthropicModelClient,
  ModelError,
  modelFromEnv,
  SimulatedModelClient,
} from "../src/index.js";

function fakeFetch(reply: Record<string, unknown>, status = 200) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify(reply), {
      status,
      headers: { "content-type": "application/json", "request-id": "req_test" },
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text: '{"ok":true}' }],
  stop_reason: "end_turn",
  stop_details: null,
  stop_sequence: null,
  usage: {
    input_tokens: 1200,
    output_tokens: 300,
    cache_creation_input_tokens: 900,
    cache_read_input_tokens: 0,
  },
  ...overrides,
});

const request = {
  task: "copy" as const,
  system: "instructions",
  prompt: "<client_data>{}</client_data>",
  schema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  },
  maxTokens: 4000,
  payload: null,
};

describe("AnthropicModelClient", () => {
  it("sends one structured-output request with no tools and no sampling parameters", async () => {
    const { fetch, calls } = fakeFetch(message());
    const client = new AnthropicModelClient({
      modelId: "claude-opus-5-5",
      apiKey: "test-key",
      fetch,
      maxRetries: 0,
    });
    const response = await client.complete(request);

    expect(response).toEqual({
      text: '{"ok":true}',
      model: "claude-opus-5-5",
      usage: { inputTokens: 1200, outputTokens: 300, cacheWriteTokens: 900, cacheReadTokens: 0 },
    });
    const [call] = calls;
    expect(new URL(call?.url ?? "").pathname).toBe("/v1/messages");
    expect(call?.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(call?.body).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      fallbacks: "default",
      system: [{ type: "text", text: "instructions", cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: request.prompt }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: request.schema } },
    });
    for (const key of ["tools", "temperature", "top_p", "top_k", "thinking"]) {
      expect(call?.body).not.toHaveProperty(key);
    }
  });

  it("turns refusals, cut-off answers and API errors into ModelError", async () => {
    const refused = new AnthropicModelClient({
      modelId: "claude-opus-5-5",
      apiKey: "k",
      maxRetries: 0,
      fetch: fakeFetch(
        message({ stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber" } }),
      ).fetch,
    });
    await expect(refused.complete(request)).rejects.toThrow(/declined \(cyber\)/);

    const cut = new AnthropicModelClient({
      modelId: "claude-opus-5-5",
      apiKey: "k",
      maxRetries: 0,
      fetch: fakeFetch(message({ stop_reason: "max_tokens" })).fetch,
    });
    await expect(cut.complete(request)).rejects.toMatchObject({ retryable: true });

    const bad = new AnthropicModelClient({
      modelId: "claude-opus-5-5",
      apiKey: "k",
      maxRetries: 0,
      fetch: fakeFetch(
        { type: "error", error: { type: "invalid_request_error", message: "nope" } },
        400,
      ).fetch,
    });
    await expect(bad.complete(request)).rejects.toBeInstanceOf(ModelError);
  });
});

describe("modelFromEnv", () => {
  it("is simulated unless live mode is asked for with a model id and a key", () => {
    expect(modelFromEnv({})).toBeInstanceOf(SimulatedModelClient);
    expect(() => modelFromEnv({ AI_MODE: "live" })).toThrow(/AI_MODEL_ID/);
    expect(() => modelFromEnv({ AI_MODE: "live", AI_MODEL_ID: "claude-opus-5-5" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    const live = modelFromEnv({
      AI_MODE: "live",
      AI_MODEL_ID: "claude-sonnet-5-5",
      ANTHROPIC_API_KEY: "k",
    });
    expect(live.modelId).toBe("claude-sonnet-5-5");
    expect(() =>
      modelFromEnv({
        AI_MODE: "live",
        AI_MODEL_ID: "x",
        ANTHROPIC_API_KEY: "k",
        AI_EFFORT: "huge",
      }),
    ).toThrow();
  });
});
