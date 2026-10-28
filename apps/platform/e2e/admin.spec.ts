import { expect, test } from "@playwright/test";
import { padaria, SITE, siteRow, withSite } from "./support/supabase";

// The admin panel (E11): only listed admins get in; the queue, the review of one site with the
// reviewer's report, the logged decisions, and the catalog promotion cycle.

const inReview = {
  site: siteRow("in_review", {
    subdomain: "padaria-do-ze",
    preview_token: "tok_abcdefghijklmnopqrstuvwxyz012345",
    approved_direction: "d0000000-0000-4000-8000-000000000001",
  }),
  draft: padaria,
};

test("the panel asks to sign in, and is closed to clients", async ({ page, context }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fadmin$/);
  await withSite(context, inReview);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acesso restrito");
});

test("the queue lists sites waiting for a person, by status", async ({ page, context }) => {
  await withSite(context, { ...inReview, admin: true });
  await page.goto("/admin");
  await expect(page.getByRole("tab", { name: /Em revisão/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const item = page.getByRole("link", { name: /Padaria do Zé/ });
  await expect(item).toContainText("Revisor: ajustes sugeridos");
  await page.getByRole("tab", { name: /Suspensos/ }).click();
  await expect(page.getByText("Nada aqui agora.")).toBeVisible();
  await page.getByRole("tab", { name: /Em revisão/ }).click();
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/admin/sites/${SITE}$`));
});

test("reviewing a site: report, answers, and decisions that need a reason", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { ...inReview, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padaria do Zé");
  await expect(page.getByText("O título repete o nome do negócio.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir o site montado/ })).toHaveAttribute(
    "href",
    `https://previa.sites.localhost/${SITE}/tok_abcdefghijklmnopqrstuvwxyz012345/`,
  );
  await expect(page.getByText("Pão de fermentação natural", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Pedir ajustes" }).click();
  await expect(
    page.getByText("Escreva o motivo: o cliente e o registro precisam dele."),
  ).toBeVisible();
  await page.getByLabel("Nota").fill("Troque o título: ele repete o nome.");
  await page.getByRole("button", { name: "Pedir ajustes" }).click();
  await expect(page.getByText("Decisão registrada.")).toBeVisible();
  expect(state.adminPosts.at(-1)).toEqual({
    path: `/api/admin/sites/${SITE}/decide`,
    body: { action: "request_changes", note: "Troque o título: ele repete o nome." },
  });
  await expect(page.getByText(/Montando seu site/)).toBeVisible();
});

test("approving sends the finished site to the client", async ({ page, context }) => {
  const state = await withSite(context, { ...inReview, admin: true });
  await page.goto(`/admin/sites/${SITE}`);
  await page.getByRole("button", { name: "Aprovar para o cliente" }).click();
  await expect(page.getByText("Decisão registrada.")).toBeVisible();
  expect(state.site?.status).toBe("awaiting_approval");
});

test("the catalog shows the metrics and records recommendations and requests", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { ...inReview, admin: true });
  await page.goto("/admin/catalogo");
  const compositions = page.getByRole("region", { name: "Composições" });
  await expect(compositions.getByRole("row", { name: /0123456789abcdef/ })).toContainText("1.5");
  await compositions.getByRole("button", { name: "Aposentar 0123456789abcdef" }).click();
  await expect(
    page.getByText("Catálogo atualizado. Vale para as próximas direções."),
  ).toBeVisible();
  const variants = page.getByRole("region", { name: "Variantes" });
  await expect(variants.getByText("Recomendada")).toBeVisible();

  await page.getByLabel("O que falta").fill("Uma galeria em mosaico para padarias.");
  await page.getByLabel("Seção").selectOption("galeria");
  await page.getByRole("button", { name: "Registrar pedido" }).click();
  await expect(page.getByText("Pedido registrado.")).toBeVisible();
  expect(state.adminPosts.map((post) => post.body)).toEqual([
    { kind: "composition", ref: "0123456789abcdef", state: "retired" },
    { family: "food", section: "galeria", note: "Uma galeria em mosaico para padarias." },
  ]);
});
