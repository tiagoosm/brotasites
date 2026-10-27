import { checkVariant, type DialectIssue } from "./dialect.js";

// The restricted code layer (docs/catalog-promotion.md): one day the AI may propose a new
// variant as HTML and CSS. It stays OFF until the blind test shows a real gain; this round only
// has the switch and the entry point, which runs the dialect validator and refuses everything
// while the switch is off.

export interface CodeVariantProposal {
  section: string;
  markup: string;
  css: string;
}

export interface CodeVariantVerdict {
  accepted: boolean;
  reason: "switched-off" | "dialect" | "needs-human-review";
  issues: DialectIssue[];
}

/** AI_CODE_VARIANTS=true turns the layer on; anything else (or nothing) keeps it off. */
export function codeVariantsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.AI_CODE_VARIANTS === "true";
}

/**
 * First gate for a proposed variant. Even when the layer is on, passing the dialect only sends
 * it on to the four states, the reviewer agent and human review; nothing is published here.
 */
export function screenCodeVariant(
  proposal: CodeVariantProposal,
  env: Record<string, string | undefined> = process.env,
): CodeVariantVerdict {
  if (!codeVariantsEnabled(env)) return { accepted: false, reason: "switched-off", issues: [] };
  const issues = checkVariant(proposal);
  if (issues.length > 0) return { accepted: false, reason: "dialect", issues };
  return { accepted: false, reason: "needs-human-review", issues: [] };
}
