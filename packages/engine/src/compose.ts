import {
  compatibleFontPairs,
  createRandom,
  generatePalette,
  grammar,
  type PaletteMode,
  type Personality,
  type Variant,
} from "@brotasites/catalog";
import { contrastIssues, familyInfo, type Identity, type SectionId } from "@brotasites/schema/v1.2";
import {
  allowedTreatments,
  allowedVariants,
  type Direction,
  type DirectionId,
  type DirectionsResult,
  directionIds,
  directionLabels,
  EngineError,
  MIN_DIRECTION_DISTANCE,
  MIN_SITE_DISTANCE,
  optionsFor,
} from "./directions.js";
import { type DesignFeatures, designDistance, featuresOf, fingerprintOf } from "./features.js";
import { type EngineInput, seedFor } from "./input.js";
import { activeVariants, type CatalogWeights, compositionKey, NO_WEIGHTS } from "./weights.js";

// The engine's check of a composition proposed by someone else (the AI art director, E8). The
// proposal names catalog ids only; the engine still owns everything that must hold: every id
// fits the family, the photos and the direction's personality, the palette comes from the
// engine (so AA always holds) and the 3 directions keep the minimum distances. Anything off and
// the whole proposal is rejected with the reasons, so the caller can retry or use the engine.

export interface DirectionChoice {
  id: DirectionId;
  personality: Personality;
  heroVariant: string;
  sectionVariants: Partial<Record<SectionId, string>>;
  fontPair: string;
  typeScale: string;
  shape: string;
  ornamentSet: string;
  pattern: string;
  imageTreatment: string;
  dividerStyle: string;
  rhythm: string;
  /** Ignored when the client sent a logo (the mark is the logo). */
  markStyle?: string;
}

export class CompositionRejected extends EngineError {
  constructor(readonly reasons: string[]) {
    super(`Composition rejected: ${reasons.join("; ")}`);
  }
}

const allows = (list: readonly (readonly [string, number])[], id: string) =>
  list.some(([item, weight]) => item === id && weight > 0);

function checkChoice(
  choice: DirectionChoice,
  input: EngineInput,
  variants: readonly Variant[],
): string[] {
  const reasons: string[] = [];
  const where = choice.id;
  const { personality } = choice;
  const rules = grammar[personality];
  if (!rules) return [`${where}: unknown personality ${personality}`];

  const variantOk = (section: SectionId, id: string | undefined) =>
    id !== undefined &&
    allowedVariants(variants, section, input, personality).some((item) => item.id === id);
  if (!variantOk("hero", choice.heroVariant)) {
    reasons.push(`${where}: hero ${choice.heroVariant} does not fit`);
  }
  const sections: SectionId[] = (input.sections ?? familyInfo[input.family].defaultSections).filter(
    (section) => section !== "hero",
  );
  for (const section of sections) {
    const available = allowedVariants(variants, section, input, personality);
    if (available.length === 0) continue;
    if (!variantOk(section, choice.sectionVariants[section])) {
      reasons.push(`${where}: ${section} ${choice.sectionVariants[section] ?? "missing"}`);
    }
  }
  for (const section of Object.keys(choice.sectionVariants)) {
    if (!sections.includes(section as SectionId)) {
      reasons.push(`${where}: section ${section} is not on the page`);
    }
  }
  if (!compatibleFontPairs(personality).some((pair) => pair.id === choice.fontPair)) {
    reasons.push(`${where}: font pair ${choice.fontPair}`);
  }
  const fields = [
    ["typeScale", rules.scales],
    ["shape", rules.shapes],
    ["ornamentSet", rules.ornamentSets],
    ["pattern", rules.patterns],
    ["dividerStyle", rules.dividers],
    ["rhythm", rules.rhythms],
  ] as const;
  for (const [field, list] of fields) {
    if (!allows(list, choice[field])) reasons.push(`${where}: ${field} ${choice[field]}`);
  }
  if (!allows(allowedTreatments(input, personality), choice.imageTreatment)) {
    reasons.push(`${where}: imageTreatment ${choice.imageTreatment}`);
  }
  if (!input.hasLogo && choice.markStyle && !allows(rules.marks, choice.markStyle)) {
    reasons.push(`${where}: markStyle ${choice.markStyle}`);
  }
  return reasons;
}

/**
 * Turns a proposed composition into the 3 directions of a round, or throws CompositionRejected.
 * `neighbors` are the designs of other sites of the same family and city.
 */
export function composeDirections(
  input: EngineInput,
  variants: readonly Variant[],
  choices: readonly DirectionChoice[],
  neighbors: readonly DesignFeatures[] = [],
  weights: CatalogWeights = NO_WEIGHTS,
): DirectionsResult {
  const ids = choices.map((choice) => choice.id);
  if (ids.length !== 3 || directionIds.some((id) => !ids.includes(id))) {
    throw new CompositionRejected(["the 3 directions must be fiel-a-marca, evolucao, contraste"]);
  }
  const active = activeVariants(variants, weights);
  const reasons = choices.flatMap((choice) => [
    ...checkChoice(choice, input, active),
    ...(weights.compositions[compositionKey(choice)] === "retired"
      ? [`${choice.id}: this composition was retired`]
      : []),
  ]);
  if (reasons.length > 0) throw new CompositionRejected(reasons);

  const seed = seedFor(input);
  const directions: Direction[] = [];
  let firstMode: PaletteMode = "light";
  for (const id of directionIds) {
    const choice = choices.find((item) => item.id === id) as DirectionChoice;
    const subSeed = `${seed}|${id}|composed`;
    const random = createRandom(subSeed);
    const options = optionsFor(id, choice.personality, random, firstMode);
    const marks = grammar[choice.personality].marks;
    const identity: Omit<Identity, "fingerprint"> = {
      personality: choice.personality,
      heroVariant: choice.heroVariant,
      fontPair: choice.fontPair,
      typeScale: choice.typeScale,
      palette: generatePalette({
        personality: choice.personality,
        random,
        mode: options.mode,
        brandColors: input.brandColors,
        keepBrandColor: options.keepBrandColor,
        hueShift: options.hueShift,
      }),
      shape: choice.shape,
      ornamentSet: choice.ornamentSet,
      pattern: choice.pattern,
      imageTreatment: choice.imageTreatment,
      dividerStyle: choice.dividerStyle,
      markStyle: input.hasLogo ? "logo" : (choice.markStyle ?? (marks[0]?.[0] as string)),
      sectionVariants: { ...choice.sectionVariants },
      rhythm: choice.rhythm,
      motionPreset: "default",
    };
    if (contrastIssues(identity.palette).length > 0) {
      throw new CompositionRejected([`${id}: palette below AA`]);
    }
    const features = featuresOf(identity);
    if (id === "fiel-a-marca") firstMode = features.mode;
    directions.push({
      id,
      label: directionLabels[id],
      seed: subSeed,
      identity: { ...identity, fingerprint: fingerprintOf(features) },
      features,
    });
  }

  const distance: string[] = [];
  directions.forEach((direction, index) => {
    for (const other of directions.slice(index + 1)) {
      const value = designDistance(direction.features, other.features);
      if (value < MIN_DIRECTION_DISTANCE) {
        distance.push(`${direction.id} and ${other.id} too close (${value.toFixed(2)})`);
      }
    }
    for (const neighbor of neighbors) {
      const value = designDistance(direction.features, neighbor);
      if (value < MIN_SITE_DISTANCE) {
        distance.push(`${direction.id} too close to another site (${value.toFixed(2)})`);
      }
    }
  });
  if (distance.length > 0) throw new CompositionRejected(distance);
  return { seed, directions, warnings: [] };
}

/** The choices behind a direction, as a composition would propose them. */
export function choiceOf(direction: Direction): DirectionChoice {
  const { identity } = direction;
  return {
    id: direction.id,
    personality: identity.personality,
    heroVariant: identity.heroVariant,
    sectionVariants: { ...identity.sectionVariants },
    fontPair: identity.fontPair,
    typeScale: identity.typeScale,
    shape: identity.shape,
    ornamentSet: identity.ornamentSet,
    pattern: identity.pattern,
    imageTreatment: identity.imageTreatment,
    dividerStyle: identity.dividerStyle,
    rhythm: identity.rhythm,
    markStyle: identity.markStyle === "logo" ? undefined : identity.markStyle,
  };
}
