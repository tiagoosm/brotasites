// Prices in USD per million tokens, checked on 2026-10-27 in the official pricing page
// (platform.claude.com/docs/en/about-claude/pricing). Input and output are the base prices;
// cache writes use the 5-minute price. Check again before changing the model.

export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const PRICES_CHECKED_ON = "2026-10-27";

export const modelPrices: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  // Prompts up to 100,000 tokens; ours are far below that.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  // The simulated mode makes no API call.
  simulated: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
};

/** Unknown models are costed at the highest current price, so the budget errs on the safe side. */
const unknownModel: ModelPrice = { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export const noUsage: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
};

export function costOf(model: string, usage: Usage): number {
  const price = modelPrices[model] ?? unknownModel;
  return (
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheWriteTokens * price.cacheWrite +
      usage.cacheReadTokens * price.cacheRead) /
    1_000_000
  );
}
