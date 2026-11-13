import { type Personality, personalities } from "@brotasites/catalog";
import type { EngineInput } from "./input.js";
import { redoPersonalities } from "./redo.js";

// Which personality each direction starts from. The feelings use the personalities' words, so
// a client who chose "elegante" gets an elegant first direction.

const familyDefault: Record<EngineInput["family"], Personality> = {
  food: "acolhedor",
  beauty: "elegante",
  health: "acolhedor",
  automotive: "robusto",
  "home-services": "moderno",
  retail: "moderno",
  education: "acolhedor",
  professionals: "elegante",
  "events-creative": "ousado",
  "pet-agro-institutions": "acolhedor",
};

/** The opposite pole for the "Contraste" direction. */
const opposite: Record<Personality, Personality> = {
  acolhedor: "moderno",
  elegante: "ousado",
  moderno: "acolhedor",
  robusto: "elegante",
  ousado: "elegante",
};

export function directionPersonalities(
  input: EngineInput,
): [Personality, Personality, Personality] {
  const first = input.feelings[0] ?? familyDefault[input.family];
  const second = input.feelings[1] ?? first;
  // The contrast must differ from the other two: the opposite of the first, else of the second,
  // else any personality not used yet.
  const third =
    [opposite[first], opposite[second], ...personalities].find(
      (candidate) => candidate !== first && candidate !== second,
    ) ?? opposite[first];
  const base: [Personality, Personality, Personality] = [first, second, third];
  // E41: a redo rotates (at least 2 new against the round before) and follows the chips.
  const reasons = input.feedback?.reasons ?? [];
  if ((input.previous?.length ?? 0) === 0 && reasons.length === 0) return base;
  return redoPersonalities(base, input.round, reasons, input.previous ?? []);
}
