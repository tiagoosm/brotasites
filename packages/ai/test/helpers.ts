import { type SiteConfig, siteConfigSchema } from "@brotasites/schema/v1.2";
import { configOf, facts } from "../src/evals/businesses.js";

export const padaria = facts[0] as (typeof facts)[number];

export function config(
  index = 0,
  change?: (input: ReturnType<typeof configOf>) => void,
): SiteConfig {
  const input = configOf(facts[index] as (typeof facts)[number]);
  change?.(input);
  return siteConfigSchema.parse(input);
}
