import type { SectionId } from "@brotasites/schema/v1.2";

// What the reviewer reports (docs/ai-and-reviewer.md, Reviewer). Every check, deterministic or
// the agent's, returns findings in this shape. Messages are shown in the admin queue (pt-BR).

export type Severity = "low" | "medium" | "high";

/** What the generator can do about a finding without leaving the catalog. */
export type Fix =
  | { type: "swap-variant"; section: SectionId }
  | { type: "rewrite-copy" }
  | { type: "repair-colors" };

export interface Finding {
  /** The check that found it ("overflow", "external-request", "agent:repetition", ...). */
  check: string;
  severity: Severity;
  /** Security findings never go through the fix loop: the site waits for a person. */
  security?: boolean;
  /** A section id, or "page" for the whole page. */
  where: SectionId | "page";
  /** Viewport width in px, for checks that depend on it. */
  width?: number;
  message: string;
  fix?: Fix;
}

export const severityRank: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

/** Same check in the same place: the same finding, whatever the wording or width. */
export function findingKey(finding: Finding): string {
  return `${finding.check}|${finding.where}`;
}
