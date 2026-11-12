import { expect, test } from "@playwright/test";
import { padaria, SITE, withSite } from "./support/supabase";

// E38: fields that showed something other than what the person typed.

const lastBusiness = (state: { saved: { draft: Record<string, unknown> }[] }) =>
  (state.saved.at(-1)?.draft.business ?? {}) as { foundedYear?: number };

test("the year field shows each digit typed; the draft gets the year at 4 digits", async ({
  page,
  context,
}) => {
  // The example has no founding year.
  const state = await withSite(context, { draft: padaria });
  await page.goto(`/criar/${SITE}/negocio`);
  const year = page.getByLabel("Ano em que começou (opcional)");
  for (const typed of ["1", "19", "199"]) {
    await year.fill(typed);
    await expect(year).toHaveValue(typed);
  }
  // Nothing to say while typing; on leaving the field, it asks for 4 digits.
  await expect(page.getByText("Use 4 números, como 1998.")).toHaveCount(0);
  await year.blur();
  await expect(page.getByText("Use 4 números, como 1998.")).toBeVisible();
  await year.fill("1998");
  await expect(year).toHaveValue("1998");
  await expect(page.getByText("Use 4 números, como 1998.")).toHaveCount(0);
  await expect.poll(() => lastBusiness(state).foundedYear).toBe(1998);
  // Erased: the field and the draft are empty again.
  await year.fill("");
  await expect(year).toHaveValue("");
  await expect.poll(() => lastBusiness(state).foundedYear).toBeUndefined();
});

test("a saved year comes back, and a year in the future is refused next to the field", async ({
  page,
  context,
}) => {
  await withSite(context, {
    draft: { ...padaria, business: { ...padaria.business, foundedYear: 2001 } },
  });
  await page.goto(`/criar/${SITE}/negocio`);
  const year = page.getByLabel("Ano em que começou (opcional)");
  await expect(year).toHaveValue("2001");
  await year.fill(String(new Date().getFullYear() + 1));
  await expect(page.getByText("O ano não pode estar no futuro.")).toBeVisible();
  await year.fill("19");
  await page.getByRole("button", { name: "Próximo: marca e sensação" }).click();
  await expect(page.locator("#step-problem")).toHaveText("Use 4 números, como 1998.");
});

test("hours day by day: Monday to Friday 8 to 18 and Saturday 8 to 12 (E38)", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    draft: { business: padaria.business, content: padaria.content },
    completed: ["negocio", "marca", "conteudo", "secoes"],
  });
  await page.goto(`/criar/${SITE}/contato`);
  // The start: Monday to Friday, 08:00 to 18:00; the weekend closed.
  await expect(page.getByText("Seg a Sex 08:00–18:00; Sáb e Dom fechados.")).toBeVisible();
  const saturday = page.getByRole("listitem", { name: "Sábado" });
  await saturday.getByRole("switch", { name: "Sábado: aberto" }).click();
  await saturday.getByLabel("Fecha").fill("12:00");
  await expect(
    page.getByText("Seg a Sex 08:00–18:00; Sáb 08:00–12:00; Dom fechado."),
  ).toBeVisible();
  // Each day changes alone: Wednesday opens later.
  await page.getByRole("listitem", { name: "Quarta" }).getByLabel("Abre").fill("09:00");
  await expect(
    page.getByText(
      "Seg, Ter, Qui e Sex 08:00–18:00; Qua 09:00–18:00; Sáb 08:00–12:00; Dom fechado.",
    ),
  ).toBeVisible();
  await expect
    .poll(() => (state.saved.at(-1)?.draft.contact as { openingHours?: unknown })?.openingHours)
    .toEqual({
      mode: "schedule",
      rules: [
        { days: ["mon", "tue", "thu", "fri"], intervals: [{ open: "08:00", close: "18:00" }] },
        { days: ["wed"], intervals: [{ open: "09:00", close: "18:00" }] },
        { days: ["sat"], intervals: [{ open: "08:00", close: "12:00" }] },
      ],
    });
});

test("hours: the same time to open and close is flagged next to the day; past midnight is a hint", async ({
  page,
  context,
}) => {
  await withSite(context, {
    draft: { business: padaria.business, content: padaria.content },
    completed: ["negocio", "marca", "conteudo", "secoes"],
  });
  await page.goto(`/criar/${SITE}/contato`);
  const friday = page.getByRole("listitem", { name: "Sexta" });
  await friday.getByLabel("Fecha").fill("08:00");
  await expect(friday.getByText(/Abre e fecha no mesmo horário/)).toBeVisible();
  await friday.getByLabel("Abre").fill("18:00");
  await friday.getByLabel("Fecha").fill("02:00");
  await expect(friday.getByText("Fecha depois da meia-noite.")).toBeVisible();
  await expect(friday.getByText(/Abre e fecha no mesmo horário/)).toHaveCount(0);
});
