import type { PhotoQuality } from "@brotasites/catalog";
import type { Family, Feeling, SectionId } from "@brotasites/schema/v1.2";

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
}

/** Lowercase, no accents, single spaces: "  Padaria do ZÉ " and "padaria do ze" seed alike. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The seed of a round: name, city, category and round, so a redo gives new directions. */
export function seedFor(input: Pick<EngineInput, "name" | "city" | "category" | "round">): string {
  return [normalizeText(input.name), normalizeText(input.city), input.category, input.round].join(
    "|",
  );
}
