import type { MarkStyle } from "./marks.js";
import type { Personality } from "./personality.js";

// The design grammar: which tokens suit each personality (docs/art-direction.md). The engine
// draws from these lists, with the weights, so a "robusto" site never gets a pastel scallop and
// an "acolhedor" one never gets a hard zigzag. Font pairs list their personalities in fonts.ts.

type Weighted = readonly [id: string, weight: number][];

export interface Grammar {
  scales: Weighted;
  shapes: Weighted;
  patterns: Weighted;
  dividers: Weighted;
  ornamentSets: Weighted;
  imageTreatments: Weighted;
  rhythms: Weighted;
  /** Monogram and wordmark styles; "logo" is used whenever the client sent a logo. */
  marks: readonly [MarkStyle, number][];
}

export const grammar: Record<Personality, Grammar> = {
  acolhedor: {
    scales: [
      ["gentle", 3],
      ["editorial", 2],
    ],
    shapes: [
      ["rounded", 3],
      ["arch", 2],
      ["pill", 1],
    ],
    patterns: [
      ["none", 2],
      ["dots", 2],
      ["grain-dots", 1],
    ],
    dividers: [
      ["wave-soft", 3],
      ["scallop", 2],
      ["arch", 2],
      ["drip", 1],
    ],
    ornamentSets: [
      ["organic", 3],
      ["handmade", 2],
      ["seals", 1],
    ],
    imageTreatments: [
      ["offset-frame", 3],
      ["arch-mask", 2],
      ["polaroid", 2],
      ["color-block", 1],
      ["grain", 1],
    ],
    rhythms: [
      ["aba", 3],
      ["calm", 2],
      ["bands", 1],
    ],
    marks: [
      ["monogram-circle", 3],
      ["monogram-arch", 2],
      ["monogram-seal", 1],
    ],
  },
  elegante: {
    scales: [
      ["editorial", 3],
      ["dramatic", 2],
    ],
    shapes: [
      ["sharp", 3],
      ["soft", 2],
      ["arch", 1],
    ],
    patterns: [
      ["none", 3],
      ["columns", 2],
      ["grid-lines", 1],
    ],
    dividers: [
      ["straight", 4],
      ["slant", 1],
      ["arch", 1],
    ],
    ornamentSets: [
      ["linear", 3],
      ["geometric", 1],
    ],
    imageTreatments: [
      ["none", 2],
      ["offset-frame", 2],
      ["arch-mask", 2],
      ["duotone", 1],
    ],
    rhythms: [
      ["calm", 3],
      ["dark-to-light", 2],
      ["abc", 1],
    ],
    marks: [
      ["wordmark", 3],
      ["monogram-square", 1],
      ["monogram-arch", 1],
    ],
  },
  moderno: {
    scales: [
      ["dramatic", 3],
      ["punchy", 2],
    ],
    shapes: [
      ["soft", 3],
      ["sharp", 2],
      ["rounded", 1],
    ],
    patterns: [
      ["grid-lines", 3],
      ["columns", 1],
      ["dots", 1],
      ["none", 1],
    ],
    dividers: [
      ["straight", 3],
      ["slant", 2],
      ["zigzag", 1],
    ],
    ornamentSets: [
      ["geometric", 3],
      ["linear", 2],
      ["playful", 1],
    ],
    imageTreatments: [
      ["tilt", 2],
      ["color-block", 2],
      ["circle-mask", 1],
      ["none", 1],
    ],
    rhythms: [
      ["abc", 3],
      ["bands", 2],
      ["aba", 1],
    ],
    marks: [
      ["wordmark", 3],
      ["monogram-square", 2],
      ["monogram-circle", 1],
    ],
  },
  robusto: {
    scales: [
      ["dramatic", 3],
      ["punchy", 2],
    ],
    shapes: [
      ["sharp", 3],
      ["soft", 2],
    ],
    patterns: [
      ["diagonal", 2],
      ["none", 2],
      ["grain-dots", 1],
    ],
    dividers: [
      ["straight", 3],
      ["zigzag", 2],
      ["slant", 1],
    ],
    ornamentSets: [
      ["seals", 3],
      ["geometric", 1],
    ],
    imageTreatments: [
      ["duotone", 2],
      ["stamp", 2],
      ["grain", 2],
      ["none", 1],
    ],
    rhythms: [
      ["dark-to-light", 3],
      ["abc", 2],
      ["bands", 1],
    ],
    marks: [
      ["monogram-seal", 3],
      ["wordmark", 2],
      ["monogram-square", 1],
    ],
  },
  ousado: {
    scales: [
      ["punchy", 3],
      ["dramatic", 1],
    ],
    shapes: [
      ["pill", 3],
      ["rounded", 2],
    ],
    patterns: [
      ["checker", 2],
      ["dots", 2],
      ["diagonal", 1],
    ],
    dividers: [
      ["wave-bold", 3],
      ["zigzag", 2],
      ["scallop", 2],
      ["drip", 2],
    ],
    ornamentSets: [
      ["playful", 3],
      ["seals", 2],
      ["organic", 1],
    ],
    imageTreatments: [
      ["color-block", 3],
      ["tilt", 2],
      ["polaroid", 2],
      ["stamp", 1],
      ["circle-mask", 1],
    ],
    rhythms: [
      ["bands", 3],
      ["abc", 2],
    ],
    marks: [
      ["monogram-circle", 2],
      ["monogram-seal", 2],
      ["wordmark", 1],
    ],
  },
};
