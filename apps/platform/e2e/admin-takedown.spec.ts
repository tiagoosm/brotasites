import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { padaria, SITE, siteRow, withSite } from "./support/supabase";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// "Retirada do ar" (E42) in the team panel: taking a site offline with a reason (shown to the
// client or not), putting it back, scheduling and cancelling a deletion, deleting now by typing
// the address, and the list of published sites with its filters and counter.

const live = (extra: Parameters<typeof siteRow>[1] = {}) =>
  siteRow("live", {
    subdomain: "padaria-do-ze",
    approved_direction: "d0000000-0000-4000-8000-000000000001",
    published_at: "2026-11-01T12:00:00Z",
    ...extra,
  });

test("the team takes a site offline with a reason, shows it, and puts it back", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { site: live(), draft: padaria, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  const section = page.getByRole("region", { name: "Retirada do ar" });
  await section.getByRole("button", { name: "Tirar do ar" }).click();

  const confirm = section.getByRole("button", { name: "Confirmar: tirar do ar" });
  await expect(confirm).toBeDisabled();
  await section.getByLabel("Motivo").selectOption("terms");
  await section.getByLabel("Mostrar a nota ao cliente").check();
  await section.getByLabel("Nota (o cliente vê este texto)").fill("Falta confirmar o contato");
  await confirm.click();

  await expect(section.getByRole("status")).toContainText("Tirar do ar: feito");
  await expect(section).toContainText("Fora do ar pela equipe.");
  await expect(section).toContainText("O cliente vê: “Falta confirmar o contato”.");
  await expect(section).toContainText("Equipe: Tirou do ar (Termos de uso): Falta confirmar");
  expect(state.adminPosts.at(-1)?.body).toEqual({
    action: "take_offline",
    note: "Falta confirmar o contato",
    reason: "terms",
    public: true,
  });

  await section.getByRole("button", { name: "Recolocar no ar" }).click();
  await section.getByLabel("Nota (fica no log)").fill("Contato confirmado");
  await section.getByRole("button", { name: "Confirmar: recolocar no ar" }).click();
  await expect(section.getByRole("button", { name: "Tirar do ar" })).toBeVisible();
});

test("scheduling a deletion, cancelling it, and deleting now with the typed address", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { site: live(), draft: padaria, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  const section = page.getByRole("region", { name: "Retirada do ar" });
  await section.getByRole("button", { name: "Agendar a exclusão" }).click();
  await section.getByLabel("Motivo").selectOption("abuse");
  await section.getByLabel(/quantos dias/).fill("3");
  await section.getByLabel("Nota (fica no log)").fill("Denúncia confirmada");
  await section.getByRole("button", { name: "Confirmar: agendar a exclusão" }).click();
  await expect(section).toContainText("Exclusão agendada para");
  await expect(section).toContainText("por decisão da equipe");
  expect(state.adminPosts.at(-1)?.body).toMatchObject({ action: "schedule_deletion", days: 3 });

  await section.getByRole("button", { name: "Cancelar a exclusão" }).click();
  await section.getByLabel("Nota (fica no log)").fill("Cliente corrigiu");
  await section.getByRole("button", { name: "Confirmar: cancelar a exclusão" }).click();
  await expect(section).not.toContainText("Exclusão agendada para");

  await section.getByRole("button", { name: "Excluir agora" }).click();
  await expect(section).toContainText("Não pode ser desfeito.");
  await section.getByLabel("Nota (fica no log)").fill("Pedido do cliente por e-mail");
  const remove = section.getByRole("button", { name: "Confirmar: excluir agora" });
  await section.getByLabel("Para confirmar, digite padaria-do-ze").fill("padaria");
  await expect(remove).toBeDisabled();
  await section.getByLabel("Para confirmar, digite padaria-do-ze").fill("padaria-do-ze");
  await remove.click();
  await expect(page).toHaveURL(/\/admin\/sites\?excluido=1$/);
  await expect(page.getByText("Site excluído. O registro ficou no log.")).toBeVisible();
});

test("deleting now is refused while a job or a charge is on the way", async ({ page, context }) => {
  await withSite(context, {
    site: live(),
    draft: padaria,
    admin: true,
    deleteBlockers: { job: true, payment: false },
  });
  await page.goto(`/admin/sites/${SITE}`);
  const section = page.getByRole("region", { name: "Retirada do ar" });
  await section.getByRole("button", { name: "Excluir agora" }).click();
  await expect(section.getByRole("alert")).toContainText("tarefa em andamento");
  await section.getByLabel("Nota (fica no log)").fill("Teste");
  await section.getByLabel("Para confirmar, digite padaria-do-ze").fill("padaria-do-ze");
  await expect(section.getByRole("button", { name: "Confirmar: excluir agora" })).toBeDisabled();
});

test("a site still in review has no 'Retirada do ar'", async ({ page, context }) => {
  await withSite(context, {
    site: siteRow("in_review", { subdomain: "padaria-do-ze" }),
    draft: padaria,
    admin: true,
  });
  await page.goto(`/admin/sites/${SITE}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padaria do Zé");
  await expect(page.getByRole("region", { name: "Retirada do ar" })).toHaveCount(0);
});

test("the list of published sites: filters, search and the scheduled counter", async ({
  page,
  context,
}) => {
  const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const state = await withSite(context, {
    site: live(),
    draft: padaria,
    admin: true,
    adminSites: [
      live(),
      live({
        id: "a0000000-0000-4000-8000-000000000002",
        subdomain: "oficina-do-joao",
        status: "offline",
        offline_by: "owner",
      }),
      live({
        id: "a0000000-0000-4000-8000-000000000003",
        subdomain: "salao-da-ana",
        status: "offline",
        offline_by: "owner",
        delete_after: soon,
        deletion_by: "owner",
      }),
    ],
  });
  await page.goto("/admin/sites");
  await expect(page.getByRole("link", { name: "Sites", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("Exclusões agendadas")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "3 sites" })).toBeVisible();

  await page.getByRole("button", { name: "Exclusão agendada (1)" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 site" })).toBeVisible();
  await expect(page.getByRole("link", { name: /salao-da-ana/ })).toContainText("exclusão em");

  await page.getByRole("button", { name: "Fora do ar" }).click();
  await expect(page.getByRole("link", { name: /oficina-do-joao/ })).toContainText(
    "Fora do ar pelo cliente",
  );

  await page.getByRole("button", { name: "Todos" }).click();
  await page.getByLabel("Buscar pelo endereço").fill("salao");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 site" })).toBeVisible();
  expect(state.adminGets.at(-1)).toBe("/api/admin/sites?q=salao&filter=&page=0");
});

for (const width of [340, 375, 1280]) {
  test(`'Retirada do ar' passes axe, with 44px targets and no sideways scroll at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await withSite(context, { site: live(), draft: padaria, admin: true });
    await page.goto(`/admin/sites/${SITE}`);
    const section = page.getByRole("region", { name: "Retirada do ar" });
    await section.getByRole("button", { name: "Tirar do ar" }).click();
    await expect(section.getByLabel("Motivo")).toBeVisible();
    const axe = await new AxeBuilder({ page }).include("section:has(#retirada)").analyze();
    expect(axe.violations).toEqual([]);
    expect(await findSmallTargetsWhileScrolling(page)).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
