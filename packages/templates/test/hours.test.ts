import { describe, expect, it } from "vitest";
import {
  buildWeek,
  localTime,
  parseDays,
  parseHours,
  parseOpeningHours,
  statusAt,
  timeZoneForState,
} from "../src/lib/hours";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("parseDays", () => {
  it.each([
    ["Seg a Sex", [1, 2, 3, 4, 5]],
    ["Segunda-feira a Sexta-feira", [1, 2, 3, 4, 5]],
    ["seg-sex", [1, 2, 3, 4, 5]],
    ["Sábado", [6]],
    ["Sáb.", [6]],
    ["Domingo", [0]],
    ["Seg, Qua e Sex", [1, 3, 5]],
    ["Sex a Seg", [5, 6, 0, 1]],
    ["Todos os dias", [0, 1, 2, 3, 4, 5, 6]],
    ["Fins de semana", [6, 0]],
  ])("%s", (text, expected) => {
    expect(parseDays(text)?.sort()).toEqual([...expected].sort());
  });

  it.each(["Feriados", "Às vezes", "Seg a Funday", ""])("rejects %s", (text) => {
    expect(parseDays(text)).toBeNull();
  });
});

describe("parseHours", () => {
  it.each([
    ["06:00 - 19:00", [[h(6), h(19)]]],
    ["06:00 – 14:00", [[h(6), h(14)]]],
    ["6h às 19h", [[h(6), h(19)]]],
    ["das 6h30 às 19h", [[h(6, 30), h(19)]]],
    [
      "08:00 - 12:00 e 14:00 - 18:00",
      [
        [h(8), h(12)],
        [h(14), h(18)],
      ],
    ],
    ["18:00 - 02:00", [[h(18), h(2)]]],
    ["Fechado", []],
    ["24 horas", [[0, h(24)]]],
  ])("%s", (text, expected) => {
    expect(parseHours(text)).toEqual(expected);
  });

  it.each(["Sob consulta", "06:00", "25:00 - 26:00", "06:00 - 06:00", "manhã e tarde"])(
    "rejects %s",
    (text) => {
      expect(parseHours(text)).toBeNull();
    },
  );
});

describe("parseOpeningHours", () => {
  it("returns null if any row is not understood", () => {
    expect(
      parseOpeningHours([
        { days: "Seg a Sex", hours: "06:00 - 19:00" },
        { days: "Sábado", hours: "sob consulta" },
      ]),
    ).toBeNull();
  });

  it("ignores holiday rows", () => {
    expect(
      parseOpeningHours([
        { days: "Seg a Sex", hours: "06:00 - 19:00" },
        { days: "Feriados", hours: "08:00 - 12:00" },
      ]),
    ).toHaveLength(1);
  });
});

describe("statusAt", () => {
  // Padaria do Zé: weekdays 06-19, Saturday 06-14, closed on Sunday.
  const bakery = buildWeek(
    parseOpeningHours([
      { days: "Seg a Sex", hours: "06:00 - 19:00" },
      { days: "Sábado", hours: "06:00 - 14:00" },
      { days: "Domingo", hours: "Fechado" },
    ]) ?? [],
  );

  it("is open during business hours", () => {
    expect(statusAt(bakery, 2, h(10))).toEqual({
      open: true,
      label: "Aberto agora",
      detail: "Fecha às 19:00",
    });
  });

  it("closes exactly at closing time", () => {
    expect(statusAt(bakery, 2, h(19))?.detail).toBe("Abre amanhã às 06:00");
  });

  it("opens later today", () => {
    expect(statusAt(bakery, 2, h(5))?.detail).toBe("Abre hoje às 06:00");
  });

  it("skips closed days", () => {
    expect(statusAt(bakery, 6, h(15))?.detail).toBe("Abre segunda às 06:00");
    expect(statusAt(bakery, 0, h(10))?.open).toBe(false);
  });

  it("follows hours past midnight", () => {
    const bar = buildWeek(parseOpeningHours([{ days: "Sex e Sáb", hours: "18:00 - 02:00" }]) ?? []);
    expect(statusAt(bar, 5, h(23))?.detail).toBe("Fecha às 02:00");
    // Saturday 01:00 is still Friday night.
    expect(statusAt(bar, 6, h(1))?.open).toBe(true);
  });

  it("is unknown for days that are not listed", () => {
    const weekdaysOnly = buildWeek(
      parseOpeningHours([{ days: "Seg a Sex", hours: "08:00 - 18:00" }]) ?? [],
    );
    expect(statusAt(weekdaysOnly, 0, h(10))).toBeNull();
    expect(statusAt(weekdaysOnly, 5, h(20))).toBeNull();
  });

  it("handles businesses open around the clock", () => {
    const always = buildWeek(
      parseOpeningHours([{ days: "Todos os dias", hours: "24 horas" }]) ?? [],
    );
    expect(statusAt(always, 3, h(3))?.detail).toBe("Aberto 24 horas");
  });
});

describe("time zones", () => {
  it("uses the state's time zone", () => {
    expect(timeZoneForState("MG")).toBe("America/Sao_Paulo");
    expect(timeZoneForState("am")).toBe("America/Manaus");
    expect(timeZoneForState(undefined)).toBe("America/Sao_Paulo");
  });

  it("reads weekday and minute in that zone", () => {
    // 2026-10-19 is a Monday; 13:30 UTC is 10:30 in São Paulo.
    const instant = new Date("2026-10-19T13:30:00Z");
    expect(localTime(instant, "America/Sao_Paulo")).toEqual({ weekday: 1, minute: h(10, 30) });
    expect(localTime(instant, "America/Manaus")).toEqual({ weekday: 1, minute: h(9, 30) });
  });
});
