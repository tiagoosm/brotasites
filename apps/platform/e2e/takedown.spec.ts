import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { padaria, SITE, siteRow, withSite } from "./support/supabase";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// "Gerenciar o site" (E42): the client takes their published site offline and back, schedules
// its deletion in steps (what goes, what stays, the copy, typing the address) and cancels it. The
// team's own measures show their reason and no button to undo them.

const page_ = `/meus-sites/${SITE}`;
const live = (extra: Parameters<typeof siteRow>[1] = {}) =>
  siteRow("live", {
    subdomain: "padaria-do-ze",
    approved_direction: "d0000000-0000-4000-8000-000000000000",
    ...extra,
  });

test("taking the site offline asks once, says nothing is deleted, and it comes back", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { site: live(), draft: padaria });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Gerenciar o site" });
  await section.getByRole("button", { name: "Tirar do ar" }).click();
  await expect(section).toContainText("Nada é apagado");
  await section.getByRole("button", { name: "Sim, tirar do ar" }).click();

  await expect(page.getByRole("status").filter({ hasText: "O site saiu do ar" })).toBeVisible();
  await expect(page.getByText("Fora do ar", { exact: true })).toBeVisible();
  // The copy can still be downloaded while it is offline.
  await expect(page.getByRole("button", { name: "Baixar o site (.zip)" })).toBeVisible();
  await section.getByRole("button", { name: "Recolocar no ar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "O site voltou ao ar" })).toBeVisible();
  expect(state.takedowns?.map((item) => item.action)).toEqual(["offline", "online"]);
});

test("deleting goes in steps, needs the exact address, and can be cancelled", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { site: live(), draft: padaria });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Gerenciar o site" });
  await section.getByRole("button", { name: "Excluir o site" }).click();

  const steps = page.getByRole("region", { name: "Excluir o site" });
  await expect(steps.getByRole("heading", { name: "O que é apagado" })).toBeVisible();
  await expect(steps.getByRole("heading", { name: "O que fica" })).toBeVisible();
  await expect(steps).toContainText("Os registros de pagamento");
  await expect(steps).toContainText("reservado para você por 30 dias");
  // No promise of a refund: only where to ask.
  await expect(steps).not.toContainText(/reembols|devolv/i);
  await expect(steps.getByRole("button", { name: "Baixar o site (.zip)" })).toBeVisible();
  await steps.getByRole("button", { name: "Continuar" }).click();

  const confirm = steps.getByRole("button", { name: "Excluir daqui a 7 dias" });
  await expect(confirm).toBeDisabled();
  await steps.getByLabel("Para confirmar, digite padaria-do-ze").fill("padaria-do-z");
  await expect(confirm).toBeDisabled();
  await steps.getByLabel("Para confirmar, digite padaria-do-ze").fill("Padaria-do-ze");
  await confirm.click();

  await expect(page.getByRole("status").filter({ hasText: "Exclusão agendada" })).toBeVisible();
  await expect(section).toContainText("Este site será excluído em");
  await expect(section).toContainText("daqui a 7 dias");
  expect(state.takedowns?.at(-1)?.body).toEqual({ confirm: true, address: "padaria-do-ze" });

  await section.getByRole("button", { name: "Cancelar a exclusão" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Exclusão cancelada" })).toBeVisible();
  await expect(section.getByRole("button", { name: "Recolocar no ar" })).toBeVisible();
});

test("the team's measures show their reason and only the team undoes them", async ({
  page,
  context,
}) => {
  await withSite(context, {
    site: live({
      status: "offline",
      offline_by: "admin",
      offline_public_reason: "o endereço de contato precisa ser confirmado",
      delete_after: null,
    }),
    draft: padaria,
  });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Gerenciar o site" });
  await expect(section).toContainText(
    "A equipe tirou o site do ar: o endereço de contato precisa ser confirmado",
  );
  await expect(section.getByRole("button", { name: "Recolocar no ar" })).toHaveCount(0);

  await withSite(context, {
    site: live({
      status: "offline",
      offline_by: "admin",
      delete_after: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      deletion_by: "admin",
    }),
    draft: padaria,
  });
  await page.reload();
  await expect(section).toContainText("A exclusão foi agendada pela equipe");
  await expect(section.getByRole("button", { name: "Cancelar a exclusão" })).toHaveCount(0);
});

test("a suspended site has no 'Gerenciar o site'", async ({ page, context }) => {
  await withSite(context, { site: live({ status: "suspended" }), draft: padaria });
  await page.goto(page_);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Gerenciar o site" })).toHaveCount(0);
});

for (const width of [375, 1280]) {
  test(`the delete steps pass axe, with 44px targets and no sideways scroll at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await withSite(context, { site: live(), draft: padaria });
    await page.goto(page_);
    await page.getByRole("button", { name: "Excluir o site" }).click();
    const steps = page.getByRole("region", { name: "Excluir o site" });
    await expect(steps.getByRole("heading", { name: "O que fica" })).toBeVisible();
    const axe = await new AxeBuilder({ page }).include("#gerenciar").analyze();
    expect(axe.violations).toEqual([]);
    const region = await new AxeBuilder({ page }).include("section:has(#gerenciar)").analyze();
    expect(region.violations).toEqual([]);
    expect(await findSmallTargetsWhileScrolling(page)).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
