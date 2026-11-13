import { type PaletteMode, type Personality, personalities } from "@brotasites/catalog";
import type { Identity, RedoReason } from "@brotasites/schema/v1.2";
import { type DesignFeatures, designDistance, featuresOf } from "./features.js";

// "Refazer" that really changes (E41). A redo used to draw from a new seed only, with the same
// feelings and brand color, so round 2 looked like round 1. Now a new round:
//   - keeps a minimum distance from every direction of the earlier rounds of the same site;
//   - differs from each of them on at least 2 visible axes (hue, light or dark, fonts, hero,
//     personality), not only in details;
//   - rotates personalities: at least 2 of the 3 did not appear in the round before;
//   - follows what the client did not like (the chips of RedoFeedback), deterministically.
// Round 0 has no earlier rounds and draws exactly as before.

/** A direction of an earlier round of the same site (from site_directions). */
export interface PreviousDirection {
  round: number;
  identity: Omit<Identity, "fingerprint"> & { fingerprint?: string };
}

/** Minimum distance between a new direction and any direction of an earlier round. */
export const MIN_REDO_DISTANCE = 0.45;
/** Visible axes a new direction must change against each earlier one. */
export const VISIBLE_AXES_REQUIRED = 2;
/** A hue move smaller than this does not count as a visible change. */
export const VISIBLE_HUE_STEP = 35;

export type VisibleAxis = "hue" | "mode" | "fontPair" | "heroVariant" | "personality";

/** The visible axes on which two designs differ. */
export function visibleDifferences(a: DesignFeatures, b: DesignFeatures): VisibleAxis[] {
  const axes: VisibleAxis[] = [];
  const gap = Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue));
  // A near-gray color has no hue the eye follows.
  if (gap >= VISIBLE_HUE_STEP && Math.min(a.chroma, b.chroma) >= 0.02) axes.push("hue");
  if (a.mode !== b.mode) axes.push("mode");
  if (a.fontPair !== b.fontPair) axes.push("fontPair");
  if (a.heroVariant !== b.heroVariant) axes.push("heroVariant");
  if (a.personality !== b.personality) axes.push("personality");
  return axes;
}

export function previousFeatures(previous: readonly PreviousDirection[]): DesignFeatures[] {
  return previous.map((item) => featuresOf(item.identity));
}

/**
 * How far a new design is from the earlier rounds, normalized so 1 means both rules hold:
 * the distance (over MIN_REDO_DISTANCE) and the visible axes (over VISIBLE_AXES_REQUIRED).
 */
export function redoScore(features: DesignFeatures, previous: readonly DesignFeatures[]): number {
  if (previous.length === 0) return 1;
  const distance = Math.min(...previous.map((other) => designDistance(features, other)));
  const visible = Math.min(...previous.map((other) => visibleDifferences(features, other).length));
  return Math.min(distance / MIN_REDO_DISTANCE, visible / VISIBLE_AXES_REQUIRED);
}

/** Personalities each chip asks for, in order of preference. */
const reasonPersonalities: Partial<Record<RedoReason, readonly Personality[]>> = {
  sober: ["elegante", "robusto"],
  classic: ["elegante", "acolhedor"],
  modern: ["moderno", "ousado"],
  // The most saturated palettes of the catalog.
  colorful: ["ousado", "moderno", "acolhedor"],
};

/** Personalities a chip rules out. */
const reasonAvoids: Partial<Record<RedoReason, readonly Personality[]>> = {
  sober: ["ousado"],
  classic: ["ousado"],
  modern: ["acolhedor"],
  colorful: ["elegante"],
};

export function preferredPersonalities(reasons: readonly RedoReason[]): Personality[] {
  const avoided = avoidedPersonalities(reasons);
  return unique(reasons.flatMap((reason) => reasonPersonalities[reason] ?? [])).filter(
    (personality) => !avoided.has(personality),
  );
}

export function avoidedPersonalities(reasons: readonly RedoReason[]): Set<Personality> {
  return new Set(reasons.flatMap((reason) => reasonAvoids[reason] ?? []));
}

/** The light mode a chip asks for, if any. */
export function modeFromReasons(reasons: readonly RedoReason[]): PaletteMode | undefined {
  if (reasons.includes("darker")) return "dark";
  if (reasons.includes("lighter") || reasons.includes("colorful")) return "light";
  return undefined;
}

/** What a new round must not reuse from the earlier ones, by chip. */
export interface RedoAvoid {
  heroVariants: ReadonlySet<string>;
  sectionVariants: ReadonlySet<string>;
  fontPairs: ReadonlySet<string>;
}

export function avoidFor(
  reasons: readonly RedoReason[],
  previous: readonly PreviousDirection[],
): RedoAvoid {
  const layout = reasons.includes("layout");
  const fonts = reasons.includes("fonts");
  return {
    heroVariants: new Set(layout ? previous.map((item) => item.identity.heroVariant) : []),
    sectionVariants: new Set(
      layout ? previous.flatMap((item) => Object.values(item.identity.sectionVariants)) : [],
    ),
    fontPairs: new Set(fonts ? previous.map((item) => item.identity.fontPair) : []),
  };
}

export const NO_AVOID: RedoAvoid = {
  heroVariants: new Set(),
  sectionVariants: new Set(),
  fontPairs: new Set(),
};

/** The personalities of the latest earlier round. */
export function lastRoundPersonalities(previous: readonly PreviousDirection[]): Set<string> {
  if (previous.length === 0) return new Set();
  const last = Math.max(...previous.map((item) => item.round));
  return new Set(
    previous.filter((item) => item.round === last).map((item) => item.identity.personality),
  );
}

/**
 * The 3 personalities of a redo round: the chips' preference first, then the client's own
 * picks, then the catalog rotated by round; at least 2 of the 3 new against the round before.
 */
export function redoPersonalities(
  base: readonly [Personality, Personality, Personality],
  round: number,
  reasons: readonly RedoReason[],
  previous: readonly PreviousDirection[],
): [Personality, Personality, Personality] {
  const last = lastRoundPersonalities(previous);
  const avoided = avoidedPersonalities(reasons);
  const preferred = preferredPersonalities(reasons);
  const shift = ((round % personalities.length) + personalities.length) % personalities.length;
  const rotated = [...personalities.slice(shift), ...personalities.slice(0, shift)];
  const pool = unique([...preferred, ...base, ...rotated]).filter(
    (personality) => !avoided.has(personality),
  );
  // Never empty: the chips rule out at most 2 of the 5.
  const first = (preferred[0] ?? (avoided.has(base[0]) ? pool[0] : base[0])) as Personality;
  const rest = pool.filter((personality) => personality !== first);
  const fresh = rest.filter((personality) => !last.has(personality));
  const stale = rest.filter((personality) => last.has(personality));
  const [second, third] = [...fresh, ...stale] as Personality[];
  return [first, second ?? first, third ?? second ?? first];
}

function unique<T>(list: readonly T[]): T[] {
  return [...new Set(list)];
}
