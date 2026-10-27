import {
  compatibleFontPairs,
  grammar,
  imageTreatments,
  type Personality,
  personalities,
  type Variant,
  variantsFor,
} from "@brotasites/catalog";
import {
  allowedTreatments,
  type DirectionChoice,
  type DirectionId,
  directionIds,
  type EngineInput,
} from "@brotasites/engine";
import { familyInfo, type SectionId } from "@brotasites/schema/v1.2";
import { z } from "zod";

// The art director's answer (docs/ai-and-reviewer.md, Art director): the 3 directions as
// catalog ids only. The schema is built per request from what this site may use (family and
// photos), so every value is a closed enum: no free text, no URL, no code. The engine then
// checks the finer rules (personality fit, AA, distances) in composeDirections.

const enumOf = (ids: readonly string[]) => z.enum(ids as [string, ...string[]]);
const unique = (ids: Iterable<string>) => [...new Set(ids)].sort();

/** Sections after the hero that have variants for this site. */
export function pageSections(input: EngineInput, variants: readonly Variant[]): SectionId[] {
  return (input.sections ?? familyInfo[input.family].defaultSections).filter(
    (section) =>
      section !== "hero" &&
      variantsFor(variants, section, input.family, undefined, input.photos).length > 0,
  );
}

export function compositionSchema(input: EngineInput, variants: readonly Variant[]) {
  const forSection = (section: SectionId) =>
    unique(variantsFor(variants, section, input.family, undefined, input.photos).map((v) => v.id));
  if (forSection("hero").length === 0) throw new Error(`No hero variant for ${input.family}`);
  const sections = pageSections(input, variants);
  const tokens = (pick: (personality: Personality) => readonly (readonly [string, number])[]) =>
    enumOf(unique(personalities.flatMap((p) => pick(p).map(([id]) => id))));
  const direction = z.strictObject({
    personality: z.enum(personalities),
    heroVariant: enumOf(forSection("hero")),
    sectionVariants: z.strictObject(
      Object.fromEntries(sections.map((section) => [section, enumOf(forSection(section))])),
    ),
    fontPair: enumOf(unique(personalities.flatMap((p) => compatibleFontPairs(p).map((f) => f.id)))),
    typeScale: tokens((p) => grammar[p].scales),
    shape: tokens((p) => grammar[p].shapes),
    ornamentSet: tokens((p) => grammar[p].ornamentSets),
    pattern: tokens((p) => grammar[p].patterns),
    imageTreatment: tokens((p) => allowedTreatments(input, p)),
    dividerStyle: tokens((p) => grammar[p].dividers),
    rhythm: tokens((p) => grammar[p].rhythms),
    markStyle: tokens((p) => grammar[p].marks),
  });
  return z.strictObject(
    Object.fromEntries(directionIds.map((id) => [id, direction])) as Record<
      DirectionId,
      typeof direction
    >,
  );
}

export type Composition = z.infer<ReturnType<typeof compositionSchema>>;

export function choicesOf(composition: Composition): DirectionChoice[] {
  return directionIds.map((id) => {
    const item = composition[id];
    return {
      id,
      personality: item.personality,
      heroVariant: item.heroVariant,
      sectionVariants: item.sectionVariants as Partial<Record<SectionId, string>>,
      fontPair: item.fontPair,
      typeScale: item.typeScale,
      shape: item.shape,
      ornamentSet: item.ornamentSet,
      pattern: item.pattern,
      imageTreatment: item.imageTreatment,
      dividerStyle: item.dividerStyle,
      rhythm: item.rhythm,
      markStyle: item.markStyle,
    };
  });
}

/** The inverse of choicesOf, for the simulated model and the tests. */
export function compositionOf(choices: readonly DirectionChoice[]): Record<string, unknown> {
  return Object.fromEntries(
    choices.map((choice) => {
      const { id, markStyle, ...rest } = choice;
      return [id, { ...rest, markStyle: markStyle ?? "monogram-circle" }];
    }),
  );
}

/**
 * The catalog the art director chooses from, per personality: what suits it (with the
 * grammar's weights) and which variants it may use on this page. Our own data, not the client's.
 */
export function catalogMenu(input: EngineInput, variants: readonly Variant[]) {
  const sections: SectionId[] = ["hero", ...pageSections(input, variants)];
  return Object.fromEntries(
    personalities.map((personality) => {
      const rules = grammar[personality];
      const variantList = (section: SectionId) => {
        const exact = variantsFor(variants, section, input.family, personality, input.photos);
        const list =
          exact.length > 0
            ? exact
            : variantsFor(variants, section, input.family, undefined, input.photos);
        return list.map((variant) => variant.id);
      };
      return [
        personality,
        {
          fontPairs: compatibleFontPairs(personality).map((pair) => pair.id),
          typeScales: rules.scales,
          shapes: rules.shapes,
          ornamentSets: rules.ornamentSets,
          patterns: rules.patterns,
          imageTreatments: allowedTreatments(input, personality).map(([id, weight]) => [
            id,
            weight,
            imageTreatments.find((item) => item.id === id)?.needsGoodPhoto
              ? "needs a good photo"
              : "",
          ]),
          dividers: rules.dividers,
          rhythms: rules.rhythms,
          markStyles: input.hasLogo ? [["logo", 1]] : rules.marks,
          variants: Object.fromEntries(sections.map((section) => [section, variantList(section)])),
        },
      ];
    }),
  );
}
