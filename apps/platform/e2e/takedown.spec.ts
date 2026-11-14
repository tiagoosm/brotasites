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

// E43: the withdrawal (direito de arrependimento) within 7 days of the payment.
const paidDaysAgo = (days: number) => [
  {
    amount_cents: 29700,
    paid_at: new Date(Date.now() - days * 86_400_000).toISOString(),
    status: "paid",
  },
];

test("within 7 days of paying, the client withdraws and gets the receipt at once", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { site: live(), draft: padaria, payments: paidDaysAgo(2) });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Gerenciar o site" });
  await expect(section).toContainText("receber de volta os R$ 297 pagos");
  await expect(section).toContainText("Código de Defesa do Consumidor, art. 49");
  await section.getByRole("button", { name: "Desistir da compra" }).click();

  const step = page.getByRole("region", { name: "Desistir da compra" });
  await expect(step).toContainText("O site sai do ar agora");
  await expect(step.getByRole("button", { name: "Baixar o site (.zip)" })).toBeVisible();
  await step.getByRole("button", { name: "Sim, desistir e receber R$ 297" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Desistência recebida" })).toBeVisible();
  await expect(section).toContainText("Desistência recebida em");
  await expect(section).toContainText("Vamos devolver R$ 297 pelo mesmo meio de pagamento");
  await expect(section).toContainText("Este site será excluído em");
  await expect(section.getByRole("button", { name: "Desistir da compra" })).toHaveCount(0);
  // The contract is over: no way back to the site with the refund.
  await expect(section.getByRole("button", { name: "Cancelar a exclusão" })).toHaveCount(0);
  await expect(section).toContainText("Você desistiu da compra, então a exclusão segue.");
  expect(state.takedowns?.map((item) => item.action)).toEqual(["withdraw"]);
});

test("within the 7 days, the delete steps point to the withdrawal instead", async ({
  page,
  context,
}) => {
  await withSite(context, { site: live(), draft: padaria, payments: paidDaysAgo(1) });
  await page.goto(page_);
  await page.getByRole("button", { name: "Excluir o site" }).click();
  const steps = page.getByRole("region", { name: "Excluir o site" });
  await expect(steps).toContainText("Excluir não devolve o valor pago");
  await expect(steps).toContainText("use “Desistir da compra” até");
});

test("after the 7 days, there is no withdrawal and deleting says it refunds nothing", async ({
  page,
  context,
}) => {
  await withSite(context, { site: live(), draft: padaria, payments: paidDaysAgo(10) });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Gerenciar o site" });
  await expect(section.getByRole("button", { name: "Tirar do ar" })).toBeVisible();
  await expect(section.getByRole("button", { name: "Desistir da compra" })).toHaveCount(0);
  await section.getByRole("button", { name: "Excluir o site" }).click();
  await expect(page.getByRole("region", { name: "Excluir o site" })).toContainText(
    "o prazo de 7 dias para desistir com devolução terminou",
  );
});

test("a refunded withdrawal says so", async ({ page, context }) => {
  await withSite(context, {
    site: live({
      status: "offline",
      offline_by: "owner",
      deletion_by: "owner",
      delete_after: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    }),
    draft: padaria,
    payments: paidDaysAgo(2),
    refunds: [
      {
        amount_cents: 29700,
        status: "refunded",
        requested_at: new Date(Date.now() - 86_400_000).toISOString(),
        resolved_at: new Date().toISOString(),
      },
    ],
  });
  await page.goto(page_);
  await expect(page.getByRole("region", { name: "Gerenciar o site" })).toContainText(
    "Valor devolvido: R$ 297",
  );
});

test("a suspended site can still be withdrawn within the 7 days, and nothing else", async ({
  page,
  context,
}) => {
  await withSite(context, {
    site: live({ status: "suspended" }),
    draft: padaria,
    payments: paidDaysAgo(3),
  });
  await page.goto(page_);
  const section = page.getByRole("region", { name: "Gerenciar o site" });
  await expect(section.getByRole("button", { name: "Desistir da compra" })).toBeVisible();
  await expect(section.getByRole("button", { name: "Tirar do ar" })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Excluir o site" })).toHaveCount(0);
});

test("the terms and the payment page state the withdrawal and the no-refund rule", async ({
  page,
}) => {
  await page.goto("/termos");
  await expect(page.getByText(/Direito de arrependimento: em até 7 dias/)).toBeVisible();
  await expect(page.getByText(/Depois desse prazo, excluir o site/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tirar o site do ar e excluir" })).toBeVisible();
  await page.goto("/privacidade");
  await expect(page.getByText(/Registros de pagamento e de devolução/)).toBeVisible();
});
