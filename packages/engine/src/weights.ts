import { hashString, type Variant } from "@brotasites/catalog";
import type { Identity, SectionId } from "@brotasites/schema/v1.2";

// The admin's catalog decisions (docs/catalog-promotion.md, E11): a composition or a variant is
// "recommended" (drawn more often) or "retired" (never drawn). Weights have a cap and the draw
// keeps exploring: the "Contraste" direction never takes a recommended composition, and the other
// two take one only part of the time, so well over 20% of suggestions stay outside them. Weights
// never override contrast, photo requirements, distances or review: they only steer the draw.

export type CatalogState = "recommended" | "retired";

/** The choices that make a composition, as stored with a recommendation. */
export interface CompositionChoices {
  personality: string;
  heroVariant: string;
  sectionVariants: Partial<Record<SectionId, string>>;
  fontPair: string;
  ornamentSet: string;
}

export interface CatalogWeights {
  /** Variant id -> state. */
  variants: Record<string, CatalogState>;
  /** Composition key -> state. */
  compositions: Record<string, CatalogState>;
  /** The recommended compositions themselves, so the engine can draw them. */
  recommended: CompositionChoices[];
}

export const NO_WEIGHTS: CatalogWeights = { variants: {}, compositions: {}, recommended: [] };

/** How much more often a recommended variant is drawn (the cap). */
export const RECOMMENDED_WEIGHT = 3;
/** The share of draws, in the directions that may use one, that take a recommended composition. */
export const RECOMMENDED_SHARE = 0.6;
/** Suggestions drawn outside the recommended compositions: at least this share. */
export const MIN_EXPLORATION = 0.2;

/** 16 hex characters naming a composition (the variant of each section, fonts, ornaments). */
export function compositionKey(choices: CompositionChoices): string {
  const sections = Object.entries(choices.sectionVariants)
    .filter(([, id]) => id)
    .sort(([a], [b]) => a.localeCompare(b));
  const canonical = JSON.stringify([
    choices.personality,
    choices.heroVariant,
    sections,
    choices.fontPair,
    choices.ornamentSet,
  ]);
  const a = hashString(canonical).toString(16).padStart(8, "0");
  const b = hashString(`composition|${canonical}`).toString(16).padStart(8, "0");
  return a + b;
}

export function choicesOfIdentity(identity: Identity): CompositionChoices {
  return {
    personality: identity.personality,
    heroVariant: identity.heroVariant,
    sectionVariants: identity.sectionVariants,
    fontPair: identity.fontPair,
    ornamentSet: identity.ornamentSet,
  };
}

/** The draw weight of a variant: 0 when retired, the cap when recommended. */
export function variantWeight(id: string, weights: CatalogWeights): number {
  const state = weights.variants[id];
  return state === "retired" ? 0 : state === "recommended" ? RECOMMENDED_WEIGHT : 1;
}

/**
 * The catalog without retired variants. A section that would lose its last variant for a family
 * keeps them: an empty section is worse than an old variant, and the admin sees the warning.
 */
export function activeVariants(
  variants: readonly Variant[],
  weights: CatalogWeights,
): readonly Variant[] {
  if (Object.keys(weights.variants).length === 0) return variants;
  return variants.filter((variant) => {
    if (variantWeight(variant.id, weights) > 0) return true;
    const families = variant.families === "all" ? ["all"] : variant.families;
    return families.every(
      (family) =>
        !variants.some(
          (other) =>
            other.section === variant.section &&
            variantWeight(other.id, weights) > 0 &&
            (other.families === "all" ||
              family === "all" ||
              (other.families as readonly string[]).includes(family)),
        ),
    );
  });
}

export function isRetired(identity: Identity, weights: CatalogWeights): boolean {
  return weights.compositions[compositionKey(choicesOfIdentity(identity))] === "retired";
}
