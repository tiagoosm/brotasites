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

function variant(
  id: string,
  section: SectionId,
  families: readonly Family[] | "all",
  personalities: readonly Personality[],
  photo: PhotoRequirement,
  goodPhoto = false,
): Variant {
  return {
    id,
    section,
    families,
    personalities,
    requires: goodPhoto ? { photo, goodPhoto } : { photo },
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
  // Variant factory (E6). Heroes per family: food 5, beauty 4, events and creatives 5.
  variant(
    "hero-feast",
    "hero",
    ["food"],
    ["acolhedor", "elegante", "robusto", "ousado"],
    "optional",
  ),
  variant("hero-poster", "hero", "all", everyPersonality, "none"),
  variant(
    "hero-fullbleed",
    "hero",
    ["food", "beauty", "events-creative", "automotive", "home-services"],
    ["elegante", "moderno", "robusto"],
    "required",
    true,
  ),
  variant(
    "hero-arch",
    "hero",
    ["beauty", "events-creative", "health", "professionals"],
    ["acolhedor", "elegante", "ousado"],
    "optional",
  ),
  variant(
    "hero-bento",
    "hero",
    ["food", "events-creative", "retail"],
    ["moderno", "ousado", "acolhedor"],
    "optional",
  ),
  variant(
    "hero-collage",
    "hero",
    ["events-creative", "food"],
    ["ousado", "acolhedor", "moderno"],
    "optional",
  ),
  variant("sobre-manifesto", "sobre", "all", ["acolhedor", "elegante", "robusto"], "optional"),
  variant("sobre-card", "sobre", "all", ["moderno", "ousado", "robusto"], "optional"),
  variant(
    "servicos-menu",
    "servicos",
    ["food", "beauty"],
    ["acolhedor", "elegante", "robusto", "moderno"],
    "none",
  ),
  variant("servicos-list", "servicos", "all", ["elegante", "moderno", "robusto"], "none"),
  variant("como-funciona-cards", "como-funciona", "all", everyPersonality, "none"),
  variant("como-funciona-path", "como-funciona", "all", ["acolhedor", "ousado", "moderno"], "none"),
  variant("diferenciais-split", "diferenciais", "all", ["elegante", "robusto", "moderno"], "none"),
  variant("diferenciais-ribbon", "diferenciais", "all", ["ousado", "moderno", "acolhedor"], "none"),
  variant("galeria-polaroids", "galeria", "all", ["acolhedor", "ousado"], "required"),
  variant("galeria-grid", "galeria", "all", ["elegante", "moderno", "robusto"], "required"),
  variant("depoimentos-quote", "depoimentos", "all", ["elegante", "robusto", "moderno"], "none"),
  variant("depoimentos-notes", "depoimentos", "all", ["acolhedor", "ousado"], "none"),
  variant("faq-columns", "faq", "all", ["moderno", "elegante", "robusto"], "none"),
  variant("faq-split", "faq", "all", ["acolhedor", "ousado", "moderno"], "none"),
  variant("cta-final-poster", "cta-final", "all", everyPersonality, "none"),
  variant("cta-final-stamp", "cta-final", "all", ["robusto", "ousado", "acolhedor"], "none"),
  variant("contato-card", "contato", "all", ["acolhedor", "ousado", "moderno"], "none"),
  variant("contato-split", "contato", "all", ["elegante", "robusto", "moderno"], "none"),
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
