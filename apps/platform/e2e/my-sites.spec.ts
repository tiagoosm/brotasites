import { expect, test } from "@playwright/test";
import {
  allBefore,
  PAYMENT,
  padaria,
  SITE,
  siteRow,
  threeDirections,
  withSite,
} from "./support/supabase";

// After the form: sending the answers, the 3 directions on "Meus sites", the finished site,
// the address, approval and the test payment. Generation is asynchronous: no loading screen.

const dashboard = `/meus-sites/${SITE}`;
const allSteps = allBefore("endereco");

test("Meus sites needs an account, and the old page leads there", async ({ page }) => {
  await page.goto("/meu-site");
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fmeus-sites$/);
});

test("sending the answers starts the directions and opens the dashboard", async ({
  page,
  context,
}) => {
  const state = await withSite(context, { draft: padaria, completed: allBefore("direcao") });
  await page.goto(`/criar/${SITE}/direcao`);
  await expect(page.getByText(/Fiel à marca/)).toBeVisible();
  await page.getByRole("button", { name: "Ver as 3 direções" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padaria do Zé");
  await expect(page.getByRole("status").first()).toContainText("Criando as 3 direções");
  await expect(page.getByText("Respostas recebidas. Estamos criando as 3 direções.")).toBeVisible();
  expect(state.rpc.map((call) => call.name)).toContain("request_directions");
  expect(state.api).toContain("/api/jobs/start");
  expect(state.saved.at(-1)?.completed).toContain("direcao");
});

test("what is missing to generate is listed, with links back", async ({ page, context }) => {
  await withSite(context, {
    draft: { business: { name: "Padaria do Zé" } },
    completed: allBefore("direcao"),
  });
  await page.goto(`/criar/${SITE}/direcao`);
  await expect(page.getByText("o tipo de negócio")).toBeVisible();
  await expect(page.getByText("um contato (WhatsApp, telefone ou e-mail)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver as 3 direções" })).toBeDisabled();
});

test("the list shows each site and whose turn it is", async ({ page, context }) => {
  await withSite(context, { site: siteRow("awaiting_direction_choice"), draft: padaria });
  await page.goto("/meus-sites");
  const card = page.getByRole("link", { name: /Padaria do Zé/ });
  await expect(card).toContainText("Escolha uma das 3");
  await expect(card).toContainText("Sua vez");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
});

test("choosing one of the 3 directions, after a confirmation", async ({ page, context }) => {
  const state = await withSite(context, {
    site: siteRow("awaiting_direction_choice"),
    draft: padaria,
    completed: allSteps,
    directions: threeDirections,
  });
  await page.goto(dashboard);
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) });
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText([
    "Fiel à marca",
    "Evolução",
    "Contraste",
  ]);
  await expect(page.getByRole("img", { name: "Direção Evolução, no computador" })).toBeVisible();

  const evolution = cards.filter({ hasText: "Evolução" });
  await evolution.getByRole("button", { name: "Escolher esta" }).click();
  await expect(evolution.getByText("A identidade fica fixa depois disso.")).toBeVisible();
  await evolution.getByRole("button", { name: "Sim, escolher" }).click();
  await expect(page.getByRole("status").first()).toContainText("Montando seu site");
  expect(state.rpc.at(-1)).toEqual({
    name: "choose_direction",
    body: { p_site_id: SITE, p_direction_id: threeDirections[1]?.id },
  });
});

test("none of the 3 fits: asking for 3 more", async ({ page, context }) => {
  const state = await withSite(context, {
    site: siteRow("awaiting_direction_choice"),
    draft: padaria,
    directions: threeDirections,
  });
  await page.goto(dashboard);
  await page.getByRole("button", { name: "Nenhuma serviu: criar outras 3" }).click();
  await expect(page.getByRole("status").first()).toContainText("Criando as 3 direções");
  expect(state.rpc.at(-1)?.name).toBe("request_directions");
});

const finished = {
  draft: padaria,
  completed: allSteps,
  site: siteRow("awaiting_approval", {
    subdomain: "padaria-do-ze",
    preview_token: "tok_abcdefghijklmnopqrstuvwxyz012345",
    approved_direction: threeDirections[0]?.id ?? null,
  }),
};

test("the finished site: private address, approval and the test payment", async ({
  page,
  context,
}) => {
  const state = await withSite(context, finished);
  await page.goto(dashboard);
  await expect(page.getByRole("link", { name: /Ver o site pronto/ })).toHaveAttribute(
    "href",
    `https://previa.sites.localhost/${SITE}/tok_abcdefghijklmnopqrstuvwxyz012345/`,
  );
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}/pagamento\\?p=${PAYMENT}$`));
  await expect(page.getByText("R$ 297")).toBeVisible();
  await expect(page.getByText("Pagamento único. Sem mensalidade.")).toBeVisible();
  await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
  await expect(page.getByRole("status").first()).toContainText("Colocando no ar");
  expect(state.api).toEqual(
    expect.arrayContaining([`/api/sites/${SITE}/approve`, `/api/payments/${PAYMENT}/confirm-stub`]),
  );
});

test("asking for changes rebuilds with the approved identity", async ({ page, context }) => {
  const state = await withSite(context, finished);
  await page.goto(dashboard);
  await expect(page.getByRole("link", { name: "Textos, serviços e fotos" })).toHaveAttribute(
    "href",
    `/criar/${SITE}/conteudo`,
  );
  await page.getByRole("button", { name: "Montar o site de novo com as mudanças" }).click();
  await expect(page.getByRole("status").first()).toContainText("Montando seu site");
  expect(state.rpc.at(-1)?.name).toBe("request_rebuild");
});

test("the address: suggestion, availability and keeping it before approving", async ({
  page,
  context,
}) => {
  const state = await withSite(context, {
    ...finished,
    site: { ...finished.site, subdomain: null },
    taken: ["padaria-do-ze"],
  });
  await page.goto(`/criar/${SITE}/endereco`);
  await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("padaria-do-ze");
  await expect(page.getByText("Esse endereço já está em uso.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar e publicar" })).toBeDisabled();
  await page.getByRole("button", { name: /^Usar padaria-do-ze-/ }).click();
  await expect(page.getByText("Disponível.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar este endereço" }).click();
  await expect(page.getByText("Endereço guardado para o seu site.")).toBeVisible();
  expect(state.site?.subdomain).toMatch(/^padaria-do-ze-santa-rita/);
  await page.getByRole("button", { name: "Aprovar e publicar" }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboard}/pagamento`));
});
