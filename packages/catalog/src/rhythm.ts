// Section rhythm: which tone each section after the hero takes. Tones map to palette pairs that
// already pass AA: base (text on background), surface (text on surface), inverse (background
// color on the text color) and brand (onPrimary on primary).

export type SectionTone = "base" | "surface" | "inverse" | "brand";

export interface Rhythm {
  id: string;
  /** Repeats over the sections after the hero. */
  pattern: readonly SectionTone[];
  /** Tone of the last section (contact), so the page ends on a firm note. */
  last: SectionTone;
}

export const rhythms: readonly Rhythm[] = [
  { id: "aba", pattern: ["base", "surface"], last: "surface" },
  { id: "abc", pattern: ["base", "surface", "inverse"], last: "inverse" },
  { id: "bands", pattern: ["base", "brand", "base", "surface"], last: "inverse" },
  { id: "calm", pattern: ["base", "base", "surface"], last: "surface" },
  { id: "dark-to-light", pattern: ["inverse", "surface", "base"], last: "inverse" },
];

/** Tone of each section after the hero, in order. */
export function sectionTones(rhythm: Rhythm, count: number): SectionTone[] {
  return Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? rhythm.last
      : (rhythm.pattern[index % rhythm.pattern.length] as SectionTone),
  );
}
