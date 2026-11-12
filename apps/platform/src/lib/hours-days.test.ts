import { type HoursRule, openingHoursSchema } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import {
  checkDay,
  copyDay,
  expandRules,
  groupWeek,
  overlapsAcrossDays,
  setDayOpen,
  weekSummary,
} from "./hours-days";

// E38: hours edited day by day, saved as the schema's rules (one per distinct set of intervals).

const weekdays = ["mon", "tue", "wed", "thu", "fri"] as const;
const nine = [{ open: "08:00", close: "18:00" }];

const cases: [string, HoursRule[]][] = [
  [
    "every day the same",
    [{ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], intervals: nine }],
  ],
  [
    "Saturday different",
    [
      { days: [...weekdays], intervals: nine },
      { days: ["sat"], intervals: [{ open: "08:00", close: "12:00" }] },
    ],
  ],
  ["days not in a row, the same", [{ days: ["mon", "wed", "fri"], intervals: nine }]],
  [
    "closed in the middle of the week",
    [{ days: ["mon", "tue", "thu", "fri", "sat"], intervals: nine }],
  ],
  [
    "three intervals",
    [
      {
        days: ["tue", "wed"],
        intervals: [
          { open: "07:00", close: "09:00" },
          { open: "11:00", close: "14:00" },
          { open: "18:00", close: "22:00" },
        ],
      },
    ],
  ],
  [
    "past midnight",
    [
      { days: ["fri", "sat"], intervals: [{ open: "18:00", close: "02:00" }] },
      { days: ["sun"], intervals: [{ open: "18:00", close: "23:00" }] },
    ],
  ],
];

describe("hours day by day, saved as rules (E38)", () => {
  for (const [name, rules] of cases) {
    it(`goes there and back without loss: ${name}`, () => {
      expect(openingHoursSchema.safeParse({ mode: "schedule", rules }).success).toBe(true);
      const grouped = groupWeek(expandRules(rules));
      expect(grouped).toEqual(rules);
      expect(expandRules(grouped)).toEqual(expandRules(rules));
    });
  }

  it("opens an old draft with groups, and merges groups with the same hours", () => {
    // Two groups of the old editor with the same hours become one rule; the days are the same.
    const old: HoursRule[] = [
      { days: ["sat"], intervals: nine },
      { days: ["mon", "tue"], intervals: nine },
    ];
    const week = expandRules(old);
    expect(week.mon).toEqual(nine);
    expect(week.sat).toEqual(nine);
    expect(week.sun).toBeNull();
    expect(groupWeek(week)).toEqual([{ days: ["mon", "tue", "sat"], intervals: nine }]);
  });

  it("builds 'Seg a Sex 8–18 e Sáb 8–12' with the shortcuts", () => {
    let week = expandRules([]);
    week = setDayOpen(week, "mon", true);
    week = copyDay(week, "mon", weekdays);
    week = setDayOpen(week, "sat", true);
    week = { ...week, sat: [{ open: "08:00", close: "12:00" }] };
    expect(groupWeek(week)).toEqual(cases[1]?.[1]);
    expect(weekSummary(week)).toBe("Seg a Sex 08:00–18:00; Sáb 08:00–12:00; Dom fechado");
    // Editing a copied day changes only that day.
    week = { ...week, wed: [{ open: "09:00", close: "18:00" }] };
    expect(weekSummary(week)).toBe(
      "Seg, Ter, Qui e Sex 08:00–18:00; Qua 09:00–18:00; Sáb 08:00–12:00; Dom fechado",
    );
  });

  it("copies only to the chosen days, and never from a closed day", () => {
    const week = expandRules([{ days: ["mon"], intervals: nine }]);
    const copied = copyDay(week, "mon", ["mon", "tue"]);
    expect(copied.tue).toEqual(nine);
    expect(copied.wed).toBeNull();
    expect(copyDay(week, "sun", ["mon"])).toBe(week);
  });

  it("closes a day and opens it again at the usual hours", () => {
    const week = expandRules([{ days: ["mon"], intervals: [{ open: "10:00", close: "12:00" }] }]);
    expect(setDayOpen(week, "mon", false).mon).toBeNull();
    expect(setDayOpen(setDayOpen(week, "mon", false), "mon", true).mon).toEqual(nine);
    // Opening an open day keeps its hours.
    expect(setDayOpen(week, "mon", true).mon).toEqual([{ open: "10:00", close: "12:00" }]);
  });

  it("flags same open and close, overlaps in a day, and hints past midnight", () => {
    expect(checkDay([{ open: "08:00", close: "08:00" }]).same).toEqual([0]);
    expect(
      checkDay([
        { open: "08:00", close: "12:00" },
        { open: "11:00", close: "14:00" },
      ]).overlap,
    ).toBe(true);
    expect(
      checkDay([
        { open: "08:00", close: "12:00" },
        { open: "12:00", close: "14:00" },
      ]).overlap,
    ).toBe(false);
    const late = checkDay([{ open: "18:00", close: "02:00" }]);
    expect(late.overnight).toEqual([0]);
    expect(late.overlap).toBe(false);
  });

  it("finds an overlap that only shows across midnight", () => {
    const week = expandRules([
      { days: ["fri"], intervals: [{ open: "18:00", close: "03:00" }] },
      { days: ["sat"], intervals: [{ open: "02:00", close: "06:00" }] },
    ]);
    expect(overlapsAcrossDays(week)).toBe(true);
    expect(overlapsAcrossDays(expandRules(cases[5]?.[1] ?? []))).toBe(false);
  });

  it("says when everything is closed", () => {
    expect(weekSummary(expandRules([]))).toBe("Seg a Dom fechados");
  });
});
