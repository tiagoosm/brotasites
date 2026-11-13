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
import {
  avoidFor,
  modeFromReasons,
  NO_AVOID,
  previousFeatures,
  type RedoAvoid,
  redoScore,
} from "./redo.js";
import {
  activeVariants,
  type CatalogWeights,
  type CompositionChoices,
  isRetired,
  NO_WEIGHTS,
  RECOMMENDED_SHARE,
  variantWeight,
} from "./weights.js";

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

export type Weighted = readonly (readonly [string, number])[];

function weighted(random: Random, list: Weighted): string {
  return random.weighted(list, ([, weight]) => weight)[0];
}

/** The variants a section may use: the direction's personality, else any personality. */
export function allowedVariants(
  variants: readonly Variant[],
  section: SectionId,
  input: EngineInput,
  personality: Personality,
): Variant[] {
  const exact = variantsFor(variants, section, input.family, personality, input.photos);
  if (exact.length > 0) return exact;
  return variantsFor(variants, section, input.family, undefined, input.photos);
}

function pickVariant(
  random: Random,
  variants: readonly Variant[],
  section: SectionId,
  input: EngineInput,
  personality: Personality,
  weights: CatalogWeights,
  avoid: ReadonlySet<string> = new Set(),
): string | undefined {
  const all = allowedVariants(variants, section, input, personality);
  // E41 "Layout diferente": leave out what earlier rounds used, when anything else fits.
  const fresh = all.filter((variant) => !avoid.has(variant.id));
  const allowed = fresh.length > 0 ? fresh : all;
  if (allowed.length === 0) return undefined;
  // With no recommendation every weight is 1, which draws exactly like random.pick.
  return random.weighted(allowed, (variant) => Math.max(variantWeight(variant.id, weights), 0.0001))
    .id;
}

/** A recommended composition this direction can use as it is, or undefined. */
function fittingRecommended(
  input: EngineInput,
  variants: readonly Variant[],
  personality: Personality,
  weights: CatalogWeights,
): CompositionChoices[] {
  const sections = (input.sections ?? familyInfo[input.family].defaultSections).filter(
    (section) => section !== "hero",
  );
  const fits = (section: SectionId, id: string | undefined) =>
    id !== undefined &&
    allowedVariants(variants, section, input, personality).some((variant) => variant.id === id);
  return weights.recommended.filter(
    (choices) =>
      choices.personality === personality &&
      fits("hero", choices.heroVariant) &&
      sections.every(
        (section) =>
          allowedVariants(variants, section, input, personality).length === 0 ||
          fits(section, choices.sectionVariants[section]),
      ) &&
      compatibleFontPairs(personality).some((pair) => pair.id === choices.fontPair) &&
      grammar[personality].ornamentSets.some(
        ([id, weight]) => id === choices.ornamentSet && weight > 0,
      ),
  );
}

/** Image treatments the personality allows for the photos the client has. */
export function allowedTreatments(input: EngineInput, personality: Personality): Weighted {
  if (input.photos === "none") return [["none", 1]];
  const allowed = grammar[personality].imageTreatments.filter(([id]) => {
    const treatment = imageTreatments.find((item) => item.id === id);
    return input.photos === "good" || !treatment?.needsGoodPhoto;
  });
  return allowed.length > 0 ? allowed : [["none", 1]];
}

export interface DrawOptions {
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
  weights: CatalogWeights = NO_WEIGHTS,
  base?: CompositionChoices,
  avoid: RedoAvoid = NO_AVOID,
): Identity {
  const { personality } = options;
  const rules = grammar[personality];
  const allPairs = compatibleFontPairs(personality);
  // E41 "Outras fontes": a pair earlier rounds did not use, when the personality has one.
  const freshPairs = allPairs.filter((pair) => !avoid.fontPairs.has(pair.id));
  const fontPairs = freshPairs.length > 0 ? freshPairs : allPairs;

  const heroVariant =
    base?.heroVariant ??
    pickVariant(random, variants, "hero", input, personality, weights, avoid.heroVariants);
  if (!heroVariant) throw new EngineError(`No hero variant for the family ${input.family}`);
  const sections = input.sections ?? familyInfo[input.family].defaultSections;
  const sectionVariants: Identity["sectionVariants"] = {};
  for (const section of sections) {
    if (section === "hero") continue;
    const variant =
      base?.sectionVariants[section] ??
      pickVariant(random, variants, section, input, personality, weights, avoid.sectionVariants);
    if (variant) sectionVariants[section] = variant;
  }

  const fontPair = base?.fontPair ?? random.pick(fontPairs).id;
  const identity: Omit<Identity, "fingerprint"> = {
    personality,
    heroVariant,
    fontPair,
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
    ornamentSet: base?.ornamentSet ?? weighted(random, rules.ornamentSets),
    pattern: weighted(random, rules.patterns),
    imageTreatment: weighted(random, allowedTreatments(input, personality)),
    dividerStyle: weighted(random, rules.dividers),
    markStyle: input.hasLogo ? "logo" : weighted(random, rules.marks),
    sectionVariants,
    rhythm: weighted(random, rules.rhythms),
    motionPreset: "default",
  };
  return { ...identity, fingerprint: fingerprintOf(featuresOf(identity)) };
}

/** Palette options of a direction: brand color kept, hue moved, or the opposite mode. */
export function optionsFor(
  id: DirectionId,
  personality: Personality,
  random: Random,
  firstMode: PaletteMode,
  /** E41: "Mais claro" or "Mais escuro" sets every direction's mode the personality allows. */
  forcedMode?: PaletteMode,
): DrawOptions {
  const modes = personalityPalettes[personality].modes;
  const options = baseOptions(id, personality, random, firstMode, modes);
  if (forcedMode && modes.includes(forcedMode)) return { ...options, mode: forcedMode };
  return options;
}

function baseOptions(
  id: DirectionId,
  personality: Personality,
  random: Random,
  firstMode: PaletteMode,
  modes: readonly PaletteMode[],
): DrawOptions {
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
  catalog: readonly Variant[],
  neighbors: readonly DesignFeatures[] = [],
  weights: CatalogWeights = NO_WEIGHTS,
): DirectionsResult {
  const variants = activeVariants(catalog, weights);
  const seed = seedFor(input);
  const personalities = directionPersonalities(input);
  // E41: the earlier rounds of this site, and what the client did not like.
  const previous = input.previous ?? [];
  const earlier = previousFeatures(previous);
  const reasons = input.feedback?.reasons ?? [];
  const avoid = avoidFor(reasons, previous);
  const forcedMode = modeFromReasons(reasons);
  const directions: Direction[] = [];
  const warnings: string[] = [];
  let firstMode: PaletteMode = "light";

  directionIds.forEach((id, index) => {
    const personality = personalities[index] as Personality;
    let best: { direction: Direction; score: number; toEarlier: number } | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const subSeed = `${seed}|${id}|${attempt}`;
      const random = createRandom(subSeed);
      const options = optionsFor(id, personality, random, firstMode, forcedMode);
      // "Contraste" always explores; the others take a recommended composition part of the time.
      const recommended =
        id === "contraste" ? [] : fittingRecommended(input, variants, personality, weights);
      const base =
        recommended.length > 0 && random.next() < RECOMMENDED_SHARE
          ? random.pick(recommended)
          : undefined;
      const identity = drawIdentity(
        random,
        input,
        variants,
        options,
        weights,
        // A recommended composition would undo "Layout diferente" or "Outras fontes".
        avoid.heroVariants.size + avoid.fontPairs.size > 0 ? undefined : base,
        avoid,
      );
      const features = featuresOf(identity);
      const toDirections = Math.min(
        1,
        ...directions.map((other) => designDistance(features, other.features)),
      );
      const toSites = Math.min(1, ...neighbors.map((other) => designDistance(features, other)));
      // Normalized so 1 means both minimums are met; the best attempt wins if none meets them.
      // A retired composition never wins over one that is not.
      // E41: also far from, and visibly different from, every direction of earlier rounds.
      const toEarlier = redoScore(features, earlier);
      const score =
        Math.min(toDirections / MIN_DIRECTION_DISTANCE, toSites / MIN_SITE_DISTANCE, toEarlier) -
        (isRetired(identity, weights) ? 2 : 0);
      const direction = { id, label: directionLabels[id], seed: subSeed, identity, features };
      if (!best || score > best.score) best = { direction, score, toEarlier };
      if (score >= 1) break;
    }
    if (!best) throw new EngineError("No direction drawn");
    if (best.score < 1) {
      warnings.push(
        best.toEarlier < 1
          ? `A direção "${directionLabels[id]}" ficou parecida com uma rodada anterior.`
          : `A direção "${directionLabels[id]}" ficou abaixo da distância mínima.`,
      );
    }
    if (index === 0) firstMode = best.direction.features.mode;
    directions.push(best.direction);
  });

  return { seed, directions, warnings };
}
