import {
  compatibleFontPairs,
  createRandom,
  generatePalette,
  grammar,
  imageTreatments,
  type PaletteMode,
  type Personality,
  personalityPalettes,
  type Random,
  type Variant,
  variantsFor,
} from "@brotasites/catalog";
import { familyInfo, type Identity, type SectionId } from "@brotasites/schema/v1.2";
import { type DesignFeatures, designDistance, featuresOf, fingerprintOf } from "./features.js";
import type { EngineInput } from "./input.js";
import { seedFor } from "./input.js";
import { directionPersonalities } from "./personality.js";

// The 3 directions of a round: "Fiel à marca" keeps the client's brand color and first
// feeling, "Evolução" moves the hue and uses the second feeling, "Contraste" takes the opposite
// personality and, where it can, the opposite light mode. Each direction is redrawn (with a
// sub-seed, so it stays deterministic) until it is far enough from the other directions and
// from the sites of the same family in the same city.

export const directionIds = ["fiel-a-marca", "evolucao", "contraste"] as const;
export type DirectionId = (typeof directionIds)[number];

export const directionLabels: Record<DirectionId, string> = {
  "fiel-a-marca": "Fiel à marca",
  evolucao: "Evolução",
  contraste: "Contraste",
};

/** Minimum distance between the 3 directions of a round. */
export const MIN_DIRECTION_DISTANCE = 0.45;
/** Minimum distance from any site of the same family in the same city (drafts included). */
export const MIN_SITE_DISTANCE = 0.3;
const MAX_ATTEMPTS = 24;

export interface Direction {
  id: DirectionId;
  label: string;
  seed: string;
  identity: Identity;
  features: DesignFeatures;
}

export class EngineError extends Error {}

type Weighted = readonly (readonly [string, number])[];

function weighted(random: Random, list: Weighted): string {
  return random.weighted(list, ([, weight]) => weight)[0];
}

/** A variant for the section; any personality when none fits the direction's exactly. */
function pickVariant(
  random: Random,
  variants: readonly Variant[],
  section: SectionId,
  input: EngineInput,
  personality: Personality,
): string | undefined {
  const exact = variantsFor(variants, section, input.family, personality, input.photos);
  if (exact.length > 0) return random.pick(exact).id;
  const anyPersonality = variantsFor(variants, section, input.family, undefined, input.photos);
  if (anyPersonality.length > 0) return random.pick(anyPersonality).id;
  return undefined;
}

interface DrawOptions {
  personality: Personality;
  mode?: PaletteMode;
  keepBrandColor: boolean;
  hueShift: number;
}

function drawIdentity(
  random: Random,
  input: EngineInput,
  variants: readonly Variant[],
  options: DrawOptions,
): Identity {
  const { personality } = options;
  const rules = grammar[personality];
  const fontPairs = compatibleFontPairs(personality);
  const treatments =
    input.photos === "none"
      ? [["none", 1] as const]
      : rules.imageTreatments.filter(([id]) => {
          const treatment = imageTreatments.find((item) => item.id === id);
          return input.photos === "good" || !treatment?.needsGoodPhoto;
        });

  const heroVariant = pickVariant(random, variants, "hero", input, personality);
  if (!heroVariant) throw new EngineError(`No hero variant for the family ${input.family}`);
  const sections = input.sections ?? familyInfo[input.family].defaultSections;
  const sectionVariants: Identity["sectionVariants"] = {};
  for (const section of sections) {
    if (section === "hero") continue;
    const variant = pickVariant(random, variants, section, input, personality);
    if (variant) sectionVariants[section] = variant;
  }

  const identity: Omit<Identity, "fingerprint"> = {
    personality,
    heroVariant,
    fontPair: random.pick(fontPairs).id,
    typeScale: weighted(random, rules.scales),
    palette: generatePalette({
      personality,
      random,
      mode: options.mode,
      brandColors: input.brandColors,
      keepBrandColor: options.keepBrandColor,
      hueShift: options.hueShift,
    }),
    shape: weighted(random, rules.shapes),
    ornamentSet: weighted(random, rules.ornamentSets),
    pattern: weighted(random, rules.patterns),
    imageTreatment: weighted(random, treatments.length > 0 ? treatments : [["none", 1]]),
    dividerStyle: weighted(random, rules.dividers),
    markStyle: input.hasLogo ? "logo" : weighted(random, rules.marks),
    sectionVariants,
    rhythm: weighted(random, rules.rhythms),
    motionPreset: "default",
  };
  return { ...identity, fingerprint: fingerprintOf(featuresOf(identity)) };
}

function optionsFor(
  id: DirectionId,
  personality: Personality,
  random: Random,
  firstMode: PaletteMode,
): DrawOptions {
  const modes = personalityPalettes[personality].modes;
  if (id === "fiel-a-marca") {
    return { personality, mode: modes[0], keepBrandColor: true, hueShift: 0 };
  }
  if (id === "evolucao") {
    const turn = random.range(25, 60) * (random.next() < 0.5 ? -1 : 1);
    return { personality, mode: firstMode, keepBrandColor: false, hueShift: Math.round(turn) };
  }
  const flipped: PaletteMode = firstMode === "light" ? "dark" : "light";
  return {
    personality,
    mode: modes.includes(flipped) ? flipped : modes[0],
    keepBrandColor: false,
    hueShift: Math.round(random.range(120, 240)),
  };
}

export interface DirectionsResult {
  seed: string;
  directions: Direction[];
  /** pt-BR notes for the admin when a distance could not be reached. */
  warnings: string[];
}

/**
 * Draws the 3 directions of a round. `neighbors` are the designs of other sites of the same
 * family and city (from the uniqueness registry).
 */
export function drawDirections(
  input: EngineInput,
  variants: readonly Variant[],
  neighbors: readonly DesignFeatures[] = [],
): DirectionsResult {
  const seed = seedFor(input);
  const personalities = directionPersonalities(input);
  const directions: Direction[] = [];
  const warnings: string[] = [];
  let firstMode: PaletteMode = "light";

  directionIds.forEach((id, index) => {
    const personality = personalities[index] as Personality;
    let best: { direction: Direction; score: number } | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const subSeed = `${seed}|${id}|${attempt}`;
      const random = createRandom(subSeed);
      const identity = drawIdentity(
        random,
        input,
        variants,
        optionsFor(id, personality, random, firstMode),
      );
      const features = featuresOf(identity);
      const toDirections = Math.min(
        1,
        ...directions.map((other) => designDistance(features, other.features)),
      );
      const toSites = Math.min(1, ...neighbors.map((other) => designDistance(features, other)));
      // Normalized so 1 means both minimums are met; the best attempt wins if none meets them.
      const score = Math.min(toDirections / MIN_DIRECTION_DISTANCE, toSites / MIN_SITE_DISTANCE);
      const direction = { id, label: directionLabels[id], seed: subSeed, identity, features };
      if (!best || score > best.score) best = { direction, score };
      if (score >= 1) break;
    }
    if (!best) throw new EngineError("No direction drawn");
    if (best.score < 1) {
      warnings.push(`A direção "${directionLabels[id]}" ficou abaixo da distância mínima.`);
    }
    if (index === 0) firstMode = best.direction.features.mode;
    directions.push(best.direction);
  });

  return { seed, directions, warnings };
}
