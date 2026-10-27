import { readFileSync } from "node:fs";
import type { SiteConfigInput } from "../../src/v1.2/index.js";
import { parseSiteConfig } from "../../src/v1.2/index.js";

const examplePath = new URL("../../../../docs/site-config.example.json", import.meta.url);

/** A fresh copy of the 1.2 example (Padaria do Zé). */
export function example(): SiteConfigInput {
  return JSON.parse(readFileSync(examplePath, "utf8"));
}

/** Parses the example after `change` and returns the issue paths ("" for the root). */
export function issuesAfter(change: (config: SiteConfigInput) => void): string[] {
  const config = example();
  change(config);
  const result = parseSiteConfig(config);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}
