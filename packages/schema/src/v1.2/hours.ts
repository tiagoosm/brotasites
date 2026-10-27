import { z } from "zod";
import { timeSchema } from "./primitives.js";

// Structured opening hours of schema 1.2. A day with no rule is closed. An interval whose
// close is earlier than its open crosses midnight into the next day (Sunday into Monday too).

export const weekDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof weekDays)[number];

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export const intervalSchema = z
  .strictObject({ open: timeSchema, close: timeSchema })
  .refine((interval) => interval.open !== interval.close, {
    path: ["close"],
    error:
      "O horário de fechar deve ser diferente do de abrir. Para 24 horas, use a opção própria.",
  });

export const hoursRuleSchema = z.strictObject({
  days: z
    .array(z.enum(weekDays))
    .min(1, "Escolha pelo menos um dia.")
    .refine((days) => new Set(days).size === days.length, "Cada dia só pode aparecer uma vez."),
  intervals: z
    .array(intervalSchema)
    .min(1, "Informe pelo menos um horário.")
    .max(3, "Use no máximo 3 horários por dia."),
});

export type HoursRule = z.infer<typeof hoursRuleSchema>;

function minutes(time: string): number {
  const [hours = 0, mins = 0] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/** Week-minute segments [start, end), Monday 00:00 = 0, split where they wrap past Sunday. */
export function weeklySegments(rules: readonly HoursRule[]): [number, number][] {
  const segments: [number, number][] = [];
  for (const rule of rules) {
    for (const day of new Set(rule.days)) {
      const base = weekDays.indexOf(day) * MINUTES_PER_DAY;
      for (const interval of rule.intervals) {
        const open = minutes(interval.open);
        let close = minutes(interval.close);
        if (close <= open) close += MINUTES_PER_DAY;
        const start = base + open;
        const end = base + close;
        if (end <= MINUTES_PER_WEEK) segments.push([start, end]);
        else segments.push([start, MINUTES_PER_WEEK], [0, end - MINUTES_PER_WEEK]);
      }
    }
  }
  return segments.sort((a, b) => a[0] - b[0]);
}

/** True when two intervals share any minute; touching ends (12:00 and 12:00) do not overlap. */
export function hasOverlap(rules: readonly HoursRule[]): boolean {
  const segments = weeklySegments(rules);
  return segments.some(
    (segment, index) => index > 0 && segment[0] < (segments[index - 1] as [number, number])[1],
  );
}

export const openingHoursSchema = z
  .strictObject({
    mode: z.enum(["schedule", "byAppointment", "always"]),
    rules: z.array(hoursRuleSchema).max(7),
    note: z.string().trim().max(120, "Use até 120 caracteres.").optional(),
  })
  .superRefine((hours, ctx) => {
    if (hours.mode !== "schedule") {
      if (hours.rules.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["rules"],
          message: "Horários só valem quando o modo é por horário.",
        });
      }
      return;
    }
    if (hours.rules.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rules"],
        message: "Informe em que dias e horários você atende.",
      });
      return;
    }
    const seen = new Set<WeekDay>();
    for (const rule of hours.rules) {
      // A day repeated inside one rule is reported by the rule itself.
      for (const day of new Set(rule.days)) {
        if (seen.has(day)) {
          ctx.addIssue({
            code: "custom",
            path: ["rules"],
            message: "Cada dia só pode aparecer em uma regra.",
          });
          return;
        }
        seen.add(day);
      }
    }
    if (hasOverlap(hours.rules)) {
      ctx.addIssue({
        code: "custom",
        path: ["rules"],
        message: "Há horários que se sobrepõem.",
      });
    }
  });

export type OpeningHours = z.infer<typeof openingHoursSchema>;
