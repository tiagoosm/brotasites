import {
  type HoursRule,
  hasOverlap,
  type OpeningHours,
  type WeekDay,
  weekDays,
} from "@brotasites/schema/v1.2";

// Opening hours day by day (E38). The editor shows one row per day; the draft keeps the
// schema's rules (openingHoursSchema, unchanged): each rule groups the days that have exactly
// the same intervals. Expanding and grouping again loses nothing, so drafts saved with the old
// groups open as they were, with no migration.

export type Interval = HoursRule["intervals"][number];
/** Each day's intervals, in the order typed; null when the day is closed. */
export type Week = Record<WeekDay, Interval[] | null>;

export const DEFAULT_INTERVAL: Interval = { open: "08:00", close: "18:00" };

export const dayShort: Record<WeekDay, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};

export const dayLong: Record<WeekDay, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

/** The copy shortcuts: from one day to these. */
export const copyTargets: [string, WeekDay[]][] = [
  ["Seg a Sex", ["mon", "tue", "wed", "thu", "fri"]],
  ["Seg a Sáb", ["mon", "tue", "wed", "thu", "fri", "sat"]],
  ["Todos os dias", [...weekDays]],
];

/** One row per day from the schema's rules (a day in no rule is closed). */
export function expandRules(rules: readonly HoursRule[]): Week {
  const week = Object.fromEntries(weekDays.map((day) => [day, null])) as Week;
  for (const rule of rules) {
    for (const day of rule.days) {
      // A day in two rules is invalid in the schema; the first one shown wins.
      if (week[day] === null) week[day] = rule.intervals.map((interval) => ({ ...interval }));
    }
  }
  return week;
}

const keyOf = (intervals: readonly Interval[]) =>
  intervals.map((interval) => `${interval.open}-${interval.close}`).join(",");

/**
 * The schema's rules from the days: one rule per distinct set of intervals, its days in week
 * order, the rules ordered by their first day. Closed days are in no rule.
 */
export function groupWeek(week: Week): HoursRule[] {
  const groups = new Map<string, HoursRule>();
  for (const day of weekDays) {
    const intervals = week[day];
    if (!intervals || intervals.length === 0) continue;
    const key = keyOf(intervals);
    const group = groups.get(key);
    if (group) group.days.push(day);
    else groups.set(key, { days: [day], intervals: intervals.map((i) => ({ ...i })) });
  }
  return [...groups.values()];
}

/** Opens or closes a day; a day opened again starts from the usual 08:00 to 18:00. */
export function setDayOpen(week: Week, day: WeekDay, open: boolean): Week {
  return { ...week, [day]: open ? (week[day] ?? [{ ...DEFAULT_INTERVAL }]) : null };
}

/** Copies one day's intervals to other days (opening them); the rest stays as it was. */
export function copyDay(week: Week, from: WeekDay, to: readonly WeekDay[]): Week {
  const source = week[from];
  if (!source) return week;
  const next = { ...week };
  for (const day of to) next[day] = source.map((interval) => ({ ...interval }));
  return next;
}

const minutes = (time: string) => {
  const [hours = 0, mins = 0] = time.split(":").map(Number);
  return hours * 60 + mins;
};

export interface DayCheck {
  /** Indexes of intervals that open and close at the same time. */
  same: number[];
  /** Indexes of intervals that close after midnight (allowed: a hint, not an error). */
  overnight: number[];
  /** Two intervals of this day share some time. */
  overlap: boolean;
}

/** What to say next to a day's intervals. */
export function checkDay(intervals: readonly Interval[]): DayCheck {
  const same: number[] = [];
  const overnight: number[] = [];
  intervals.forEach((interval, index) => {
    if (interval.open === interval.close) same.push(index);
    else if (minutes(interval.close) < minutes(interval.open)) overnight.push(index);
  });
  const valid = intervals.filter((interval) => interval.open !== interval.close);
  const overlap = valid.length > 1 && hasOverlap([{ days: ["mon"], intervals: valid }]);
  return { same, overnight, overlap };
}

/**
 * An overlap between days only (an interval past midnight running into the next day's hours),
 * which no single day shows.
 */
export function overlapsAcrossDays(week: Week): boolean {
  const rules = groupWeek(week).map((rule) => ({
    ...rule,
    intervals: rule.intervals.filter((interval) => interval.open !== interval.close),
  }));
  const dayOverlap = weekDays.some((day) => {
    const intervals = week[day];
    return intervals ? checkDay(intervals).overlap : false;
  });
  return !dayOverlap && hasOverlap(rules.filter((rule) => rule.intervals.length > 0));
}

/** "Seg a Sex" for 3 or more days in a row, "Sáb e Dom" or "Seg, Qua e Sex" otherwise. */
export function daysLabel(days: readonly WeekDay[]): string {
  const indexes = days.map((day) => weekDays.indexOf(day)).sort((a, b) => a - b);
  const names = indexes.map((index) => dayShort[weekDays[index] as WeekDay]);
  if (names.length === 1) return names[0] as string;
  const inRow = indexes.every((day, i) => i === 0 || day === (indexes[i - 1] as number) + 1);
  if (inRow && names.length > 2) return `${names[0]} a ${names.at(-1)}`;
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** "Seg a Sex 08:00–18:00; Sáb 08:00–12:00; Dom fechado". */
export function weekSummary(week: Week): string {
  const parts = groupWeek(week).map(
    (rule) =>
      `${daysLabel(rule.days)} ${rule.intervals
        .map((interval) => `${interval.open}–${interval.close}`)
        .join(" e ")}`,
  );
  const closed = weekDays.filter((day) => !week[day] || week[day]?.length === 0);
  if (closed.length > 0) {
    parts.push(`${daysLabel(closed)} ${closed.length === 1 ? "fechado" : "fechados"}`);
  }
  return parts.join("; ");
}

/** The draft's value after a change to the days. */
export function withWeek(hours: OpeningHours, week: Week): OpeningHours {
  return { ...hours, rules: groupWeek(week) };
}
