import { readFileSync } from "node:fs";
import { variants } from "@brotasites/catalog";
import { statusAt } from "@brotasites/schema/hours";
import { parseSiteConfig } from "@brotasites/schema/v1.2";
import { describe, expect, it } from "vitest";
import { hoursRows, hoursSummary, weekSchedule } from "../src/v12/lib/hours";
import {
  ctaLink,
  directionsHref,
  formatPhone,
  phoneHref,
  primaryContact,
} from "../src/v12/lib/links";
import { resolveTheme } from "../src/v12/lib/theme";

const example = (() => {
  const raw = JSON.parse(
    readFileSync(new URL("../../../docs/site-config.example.json", import.meta.url), "utf8"),
  );
  const result = parseSiteConfig(raw);
  if (!result.success) throw new Error("The 1.2 example is invalid");
  return result.data;
})();

describe("opening hours (1.2)", () => {
  it("lists rules in week order with closed days last", () => {
    expect(hoursRows(example.business.openingHours)).toEqual([
      { label: "Seg a Sex", hours: "06:00 às 19:00", days: [1, 2, 3, 4, 5] },
      { label: "Sábado", hours: "06:00 às 14:00", days: [6] },
      { label: "Domingo", hours: "Fechado", days: [0] },
    ]);
  });

  it("names scattered days and joins split shifts", () => {
    const rows = hoursRows({
      mode: "schedule",
      rules: [
        {
          days: ["mon", "wed", "fri"],
          intervals: [
            { open: "08:00", close: "12:00" },
            { open: "14:00", close: "18:00" },
          ],
        },
      ],
    });
    expect(rows[0]).toMatchObject({
      label: "Seg, Qua e Sex",
      hours: "08:00 às 12:00 e 14:00 às 18:00",
    });
    expect(rows[1]).toMatchObject({ label: "Ter, Qui, Sáb e Dom", hours: "Fechado" });
  });

  it("knows when the business is open, across midnight and on closed days", () => {
    const week = weekSchedule({
      mode: "schedule",
      rules: [{ days: ["fri"], intervals: [{ open: "18:00", close: "02:00" }] }],
    });
    if (!week) throw new Error("no week");
    expect(statusAt(week, 6, 60)).toMatchObject({ open: true, detail: "Fecha às 02:00" });
    expect(statusAt(week, 6, 180)).toMatchObject({ open: false, detail: "Abre sexta às 18:00" });
    expect(statusAt(week, 0, 600)?.open).toBe(false);
  });

  it("summarizes 24 hours and appointments", () => {
    expect(hoursSummary({ mode: "always", rules: [] })).toBe("Aberto 24 horas");
    expect(hoursSummary({ mode: "byAppointment", rules: [] })).toBe("Atendimento com hora marcada");
    expect(weekSchedule({ mode: "byAppointment", rules: [] })).toBeNull();
  });
});

describe("links (1.2)", () => {
  const { business } = example;

  it("builds only https, tel: and mailto: links from the contact", () => {
    expect(primaryContact(business).href).toBe("https://wa.me/5535999990000");
    expect(phoneHref("3535550000")).toBe("tel:+553535550000");
    expect(ctaLink({ label: "Ligar", action: "phone" }, business).href).toBe("tel:+553535550000");
    expect(ctaLink({ label: "E-mail", action: "email" }, business).href).toBe(
      "mailto:contato@padariadoze.com.br",
    );
    expect(ctaLink({ label: "Ver", action: "section", section: "servicos" }, business).href).toBe(
      "#servicos",
    );
    expect(directionsHref(business)).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
  });

  it("formats phones for reading", () => {
    expect(formatPhone("3535550000")).toBe("(35) 3555-0000");
    expect(formatPhone("5535999990000")).toBe("(35) 99999-0000");
  });
});

describe("theme (1.2)", () => {
  it("resolves the identity into CSS with no inline URL other than the site's files", () => {
    const theme = resolveTheme(example);
    expect(theme.css).toContain("--color-primary:#B45309");
    expect(theme.css).toContain("@font-face");
    for (const url of theme.css.match(/url\("?([^")]+)"?\)/g) ?? []) {
      expect(url).toMatch(/^url\("?(\.\.\/fonts\/|grain\.svg)/);
    }
  });

  it("applies the client's color overrides", () => {
    const config = structuredClone(example);
    config.design.overrides.colors = { primary: "#7C2D12" };
    expect(resolveTheme(config).css).toContain("--color-primary:#7C2D12");
  });
});

describe("variant components", () => {
  it("exist for every variant in the catalog", () => {
    const registry = readFileSync(new URL("../src/v12/variants/index.ts", import.meta.url), "utf8");
    for (const variant of variants) expect(registry).toContain(`"${variant.id}":`);
  });
});
