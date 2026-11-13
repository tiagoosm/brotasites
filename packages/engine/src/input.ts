import type { PhotoQuality } from "@brotasites/catalog";
import type { Family, Feeling, RedoFeedback, SectionId } from "@brotasites/schema/v1.2";
import type { PreviousDirection } from "./redo.js";

// What the engine needs from the form answers. Only facts that shape the design: the text of
// the site is the AI's job (E8).

export interface EngineInput {
  name: string;
  city: string;
  category: string;
  family: Family;
  feelings: readonly Feeling[];
  brandColors: readonly string[];
  hasLogo: boolean;
  photos: PhotoQuality;
  /** Sections after the hero; the family's defaults when omitted. */
  sections?: readonly SectionId[];
  /** 0 for the first directions, +1 on every redo. */
  round: number;
  /** E41: every direction of the earlier rounds of this site (none in round 0). */
  previous?: readonly PreviousDirection[];
  /** E41: what the client did not like about the last round (optional chips and note). */
  feedback?: RedoFeedback;
}

/** Lowercase, no accents, single spaces: "  Padaria do ZÉ " and "padaria do ze" seed alike. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * The seed of a round: name, city, category and round, so a redo gives new directions, and the
 * chips of the redo (E41), so the same answers, round and chips give the same directions.
 */
export function seedFor(
  input: Pick<EngineInput, "name" | "city" | "category" | "round" | "feedback">,
): string {
  const parts = [normalizeText(input.name), normalizeText(input.city), input.category, input.round];
  const reasons = input.feedback?.reasons ?? [];
  return [...parts, ...(reasons.length > 0 ? [reasons.join(",")] : [])].join("|");
}
