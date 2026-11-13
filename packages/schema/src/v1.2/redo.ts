import { z } from "zod";
import { cleanText } from "./primitives.js";

// What the client did not like about a round of directions (E41, "Refazer"). Optional chips and
// a short note. The chips steer the engine deterministically (packages/engine, redo.ts); the
// note is data only: the art director may read it, delimited, never as an instruction. Labels
// are user-facing (pt-BR).

export const redoReasons = [
  "sober",
  "colorful",
  "modern",
  "classic",
  "lighter",
  "darker",
  "layout",
  "fonts",
] as const;
export type RedoReason = (typeof redoReasons)[number];

export const redoReasonLabels: Record<RedoReason, string> = {
  sober: "Mais sóbrio",
  colorful: "Mais colorido",
  modern: "Mais moderno",
  classic: "Mais clássico",
  lighter: "Mais claro",
  darker: "Mais escuro",
  layout: "Layout diferente",
  fonts: "Outras fontes",
};

/** Pairs that pull in opposite directions: the client may pick one of each, not both. */
export const redoOpposites: readonly (readonly [RedoReason, RedoReason])[] = [
  ["lighter", "darker"],
  ["modern", "classic"],
  ["sober", "colorful"],
];

export const REDO_NOTE_MAX = 140;

export const redoFeedbackSchema = z
  .object({
    reasons: z.array(z.enum(redoReasons)).max(redoReasons.length).default([]),
    note: z
      .string()
      .max(REDO_NOTE_MAX, { error: `Escreva em até ${REDO_NOTE_MAX} caracteres.` })
      .transform((text) => cleanText(text).replace(/\s+/g, " ").trim())
      .optional(),
  })
  .strict()
  .refine(
    (feedback) =>
      !redoOpposites.some(([a, b]) => feedback.reasons.includes(a) && feedback.reasons.includes(b)),
    { error: "Escolha só um de cada par (por exemplo, mais claro ou mais escuro)." },
  )
  .transform((feedback) => ({
    // Sorted and unique, so the same choice always seeds the same directions.
    reasons: redoReasons.filter((reason) => feedback.reasons.includes(reason)),
    ...(feedback.note ? { note: feedback.note } : {}),
  }));

export type RedoFeedback = z.output<typeof redoFeedbackSchema>;

/** True when the feedback says nothing (the client skipped the panel). */
export function isEmptyFeedback(feedback: RedoFeedback | undefined): boolean {
  return !feedback || (feedback.reasons.length === 0 && !feedback.note);
}
