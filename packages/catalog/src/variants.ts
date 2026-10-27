import type { Family, SectionId } from "@brotasites/schema/v1.2";
import type { Personality } from "./personality.js";

// Section variants (heroes and the other sections). Each one declares what it suits and what
// it needs, so the engine only offers variants the client's material can fill. The
// templates (E5) ship one base variant per section; the variant factory (E6) adds the rest.

export type PhotoRequirement = "none" | "optional" | "required";

/** What the client has: no photos, only weak ones, or at least one good photo. */
export type PhotoQuality = "none" | "weak" | "good";

export interface Variant {
  id: string;
  section: SectionId;
  /** Families it was designed for; "all" for the shared section variants. */
  families: readonly Family[] | "all";
  personalities: readonly Personality[];
  requires: {
    photo: PhotoRequirement;
    /** Needs a good photo (a cut-out or a full-screen hero); a weak one is not enough. */
    goodPhoto?: boolean;
  };
  version: number;
}

const everyPersonality: readonly Personality[] = [
  "acolhedor",
  "elegante",
  "moderno",
  "robusto",
  "ousado",
];

/** One base variant per section, for every family and personality (E5). */
function base(id: string, section: SectionId, photo: PhotoRequirement): Variant {
  return {
    id,
    section,
    families: "all",
    personalities: everyPersonality,
    requires: { photo },
    version: 1,
  };
}

export const variants: readonly Variant[] = [
  base("hero-split", "hero", "optional"),
  base("sobre-split", "sobre", "optional"),
  base("servicos-cards", "servicos", "none"),
  base("como-funciona-steps", "como-funciona", "none"),
  base("diferenciais-grid", "diferenciais", "none"),
  base("galeria-mosaic", "galeria", "required"),
  base("depoimentos-cards", "depoimentos", "none"),
  base("faq-accordion", "faq", "none"),
  base("cta-final-band", "cta-final", "none"),
  base("contato-columns", "contato", "none"),
];

/**
 * Variants of a section that suit the family and the personality (any personality when it is
 * undefined) and that the client's photos can fill.
 */
export function variantsFor(
  list: readonly Variant[],
  section: SectionId,
  family: Family,
  personality: Personality | undefined,
  photos: PhotoQuality,
): Variant[] {
  return list.filter(
    (variant) =>
      variant.section === section &&
      (variant.families === "all" || variant.families.includes(family)) &&
      (personality === undefined || variant.personalities.includes(personality)) &&
      (variant.requires.photo !== "required" || photos !== "none") &&
      (!variant.requires.goodPhoto || photos === "good"),
  );
}
