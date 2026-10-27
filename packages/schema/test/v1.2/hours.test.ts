import { describe, expect, it } from "vitest";
import { type OpeningHours, openingHoursSchema } from "../../src/v1.2/index.js";

function issues(hours: OpeningHours): string[] {
  const result = openingHoursSchema.safeParse(hours);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

const day = (open: string, close: string) => ({ open, close });

describe("opening hours 1.2", () => {
  it("accepts split shifts and intervals that touch", () => {
    expect(
      issues({
        mode: "schedule",
        rules: [{ days: ["mon"], intervals: [day("08:00", "12:00"), day("12:00", "18:00")] }],
      }),
    ).toEqual([]);
  });

  it("refuses overlapping intervals on the same day", () => {
    expect(
      issues({
        mode: "schedule",
        rules: [{ days: ["mon"], intervals: [day("08:00", "12:00"), day("11:00", "14:00")] }],
      }),
    ).toEqual(["rules"]);
  });

  it("accepts a night shift that crosses midnight", () => {
    expect(
      issues({
        mode: "schedule",
        rules: [
          { days: ["fri"], intervals: [day("18:00", "02:00")] },
          { days: ["sat"], intervals: [day("02:00", "14:00")] },
        ],
      }),
    ).toEqual([]);
  });

  it("refuses a night shift that runs into the next day's hours", () => {
    expect(
      issues({
        mode: "schedule",
        rules: [
          { days: ["fri"], intervals: [day("18:00", "02:00")] },
          { days: ["sat"], intervals: [day("01:00", "14:00")] },
        ],
      }),
    ).toEqual(["rules"]);
  });

  it("wraps Sunday night into Monday", () => {
    expect(
      issues({
        mode: "schedule",
        rules: [
          { days: ["sun"], intervals: [day("20:00", "03:00")] },
          { days: ["mon"], intervals: [day("02:00", "10:00")] },
        ],
      }),
    ).toEqual(["rules"]);
  });

  it("refuses a day in two rules and a repeated day", () => {
    expect(
      issues({
        mode: "schedule",
        rules: [
          { days: ["mon", "tue"], intervals: [day("08:00", "12:00")] },
          { days: ["tue"], intervals: [day("14:00", "18:00")] },
        ],
      }),
    ).toEqual(["rules"]);
    expect(
      issues({
        mode: "schedule",
        rules: [{ days: ["mon", "mon"], intervals: [day("08:00", "12:00")] }],
      }),
    ).toEqual(["rules.0.days"]);
  });

  it("allows at most 3 intervals a day", () => {
    const intervals = [day("06:00", "08:00"), day("09:00", "11:00"), day("12:00", "14:00")];
    expect(issues({ mode: "schedule", rules: [{ days: ["mon"], intervals }] })).toEqual([]);
    expect(
      issues({
        mode: "schedule",
        rules: [{ days: ["mon"], intervals: [...intervals, day("15:00", "17:00")] }],
      }),
    ).toEqual(["rules.0.intervals"]);
  });

  it.each([["24:00"], ["8:00"], ["08:60"], ["08h00"]])("refuses the time %s", (time) => {
    expect(
      issues({ mode: "schedule", rules: [{ days: ["mon"], intervals: [day(time, "18:00")] }] }),
    ).toEqual(["rules.0.intervals.0.open"]);
  });

  it("refuses an interval that opens and closes at the same time", () => {
    expect(
      issues({ mode: "schedule", rules: [{ days: ["mon"], intervals: [day("08:00", "08:00")] }] }),
    ).toEqual(["rules.0.intervals.0.close"]);
  });

  it("takes no rules by appointment or 24 hours, and needs rules on a schedule", () => {
    expect(issues({ mode: "byAppointment", rules: [] })).toEqual([]);
    expect(issues({ mode: "always", rules: [], note: "Inclusive feriados." })).toEqual([]);
    expect(
      issues({ mode: "always", rules: [{ days: ["mon"], intervals: [day("08:00", "12:00")] }] }),
    ).toEqual(["rules"]);
    expect(issues({ mode: "schedule", rules: [] })).toEqual(["rules"]);
  });

  it("limits the note to 120 characters", () => {
    expect(issues({ mode: "byAppointment", rules: [], note: "x".repeat(121) })).toEqual(["note"]);
  });
});
