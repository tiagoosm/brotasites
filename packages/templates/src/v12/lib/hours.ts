import { buildWeek, type ParsedRow, type WeekSchedule } from "@brotasites/schema/hours";
import type { OpeningHours } from "@brotasites/schema/v1.2";

// Structured opening hours (schema 1.2) for display and for the "open now" sign. A day with no
// rule is closed.

const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const short = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const long = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
/** Index in `order` (Monday first) to the 0 = Sunday index of the schedule. */
const toSundayFirst = (index: number) => (index + 1) % 7;

const minutes = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};

export interface HoursRow {
  label: string;
  hours: string;
  /** 0 = Sunday, for marking today in the browser. */
  days: number[];
}

/** Consecutive days read as a range ("Seg a Sex"); others are listed ("Seg, Qua e Sex"). */
function daysLabel(indexes: number[]): string {
  if (indexes.length === 1) return long[indexes[0] as number] as string;
  const consecutive = indexes.every((day, i) => i === 0 || day === (indexes[i - 1] as number) + 1);
  if (consecutive && indexes.length > 2) {
    return `${short[indexes[0] as number]} a ${short[indexes.at(-1) as number]}`;
  }
  const names = indexes.map((day) => short[day] as string);
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** Rows for the contact section, in week order, closed days last. */
export function hoursRows(hours: OpeningHours): HoursRow[] {
  if (hours.mode !== "schedule") return [];
  const rows = hours.rules.map((rule) => {
    const indexes = rule.days.map((day) => order.indexOf(day)).sort((a, b) => a - b);
    return {
      first: indexes[0] ?? 0,
      label: daysLabel(indexes),
      hours: rule.intervals.map((interval) => `${interval.open} às ${interval.close}`).join(" e "),
      days: indexes.map(toSundayFirst),
    };
  });
  rows.sort((a, b) => a.first - b.first);
  const open = new Set(hours.rules.flatMap((rule) => rule.days));
  const closed = order.map((day, index) => (open.has(day) ? -1 : index)).filter((i) => i >= 0);
  const result: HoursRow[] = rows.map(({ label, hours: text, days }) => ({
    label,
    hours: text,
    days,
  }));
  if (closed.length > 0) {
    result.push({ label: daysLabel(closed), hours: "Fechado", days: closed.map(toSundayFirst) });
  }
  return result;
}

/** One line summary for 24 hours or by appointment; null for a schedule. */
export function hoursSummary(hours: OpeningHours): string | null {
  if (hours.mode === "always") return "Aberto 24 horas";
  if (hours.mode === "byAppointment") return "Atendimento com hora marcada";
  return null;
}

/** Weekly schedule for the "open now" sign; every day is known (closed days are empty). */
export function weekSchedule(hours: OpeningHours): WeekSchedule | null {
  if (hours.mode === "byAppointment") return null;
  if (hours.mode === "always") return Array.from({ length: 7 }, () => [[0, 24 * 60]]);
  const rows: ParsedRow[] = hours.rules.map((rule) => ({
    days: rule.days.map((day) => toSundayFirst(order.indexOf(day))),
    ranges: rule.intervals.map((interval) => [minutes(interval.open), minutes(interval.close)]),
  }));
  return buildWeek(rows).map((ranges) => ranges ?? []);
}
