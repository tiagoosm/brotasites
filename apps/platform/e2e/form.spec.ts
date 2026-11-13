import { expect, type Page, test } from "@playwright/test";
import { fakeSupabase, padaria, SITE, signIn, withSite } from "./support/supabase";

// The 7-step form (docs/form-flow.md): signing in comes first, each step checks its own
// answers in Portuguese and saves them to the account.

const step = (slug: string) => new RegExp(`/criar/${SITE}/${slug}$`);

async function chooseCategory(page: Page, search: string, label: string) {
  await page.getByLabel("Tipo de negócio").fill(search);
  await page.getByText(label, { exact: true }).click();
  await expect(page.getByRole("radio", { name: label })).toHaveCount(0);
}

test("creating a site asks for an account first, on the server", async ({ page }) => {
  await page.goto("/criar");
  await expect(page).toHaveURL(/\/cadastro\?voltar=%2Fcriar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crie a sua conta");
  await page.getByRole("main").getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fcriar$/);
});

test("signed in, a new site starts at the first question", async ({ page, context }) => {
  const user = await signIn(context);
  const state = await fakeSupabase(context, user);
  // Nothing comes from the address anymore (the home page demo was removed in E17). A new site
  // starts from Meus sites (E32), which opens /criar?novo=1.
  await page.goto("/criar?novo=1&nome=Padaria%20do%20Z%C3%A9&tipo=padaria");
  await expect(page).toHaveURL(step("negocio"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qual é o seu negócio?");
  expect(state.site?.id).toBe(SITE);
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("");
  await expect(page.getByLabel("Tipo de negócio")).toHaveValue("");
});

test("signed in, a bare /criar leads to Meus sites, where drafts continue (E32)", async ({
  page,
  context,
}) => {
  await withSite(context, { draft: padaria, completed: ["negocio", "marca"] });
  await page.goto("/criar");
  await expect(page).toHaveURL(/\/meus-sites$/);
});

test("explains what is missing, in Portuguese, then saves and moves on", async ({
  page,
  context,
}) => {
  const state = await withSite(context);
  await page.goto(`/criar/${SITE}/negocio`);
  const next = page.getByRole("button", { name: "Próximo: marca e sensação" });
  await next.click();
  await expect(page.locator("#step-problem")).toHaveText("Informe o nome do negócio.");
  await expect(page).toHaveURL(step("negocio"));

  await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
  await chooseCategory(page, "padar", "Padaria");
  await page.getByLabel("Cidade", { exact: true }).fill("Santa Rita do Sapucaí");
  await page.getByLabel("Estado").selectOption("MG");
  await page
    .getByLabel("Conte em poucas palavras o que você faz")
    .fill("Pão de fermentação natural");
  await next.click();
  await expect(page).toHaveURL(step("marca"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Como você quer que o seu negócio pareça?",
  );
  await expect
    .poll(() => state.saved.at(-1))
    .toMatchObject({
      draft: { business: { name: "Padaria do Zé", category: "padaria", state: "MG" } },
      completed: ["negocio"],
    });
});

test("the answers survive a reload", async ({ page, context }) => {
  const state = await withSite(context);
  await page.goto(`/criar/${SITE}/negocio`);
  await page.getByLabel("Nome do negócio").fill("Barbearia do Léo");
  await expect.poll(() => state.saved.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Barbearia do Léo");
});

test("blocked topics stop the first step, kindly", async ({ page, context }) => {
  await withSite(context);
  await page.goto(`/criar/${SITE}/negocio`);
  await page.getByLabel("Nome do negócio").fill("Loja do Beto");
  await page
    .getByLabel("Conte em poucas palavras o que você faz")
    .fill("Vendemos vapes e pods descartáveis");
  await expect(page.getByText("Esse tipo de negócio a gente não atende.")).toBeVisible();
  await page.getByRole("button", { name: "Próximo: marca e sensação" }).click();
  await expect(page.locator("#step-problem")).toHaveText(
    "Não atendemos negócios de cigarro eletrônico e tabaco.",
  );
});

test("steps ahead of the person's progress send them back", async ({ page, context }) => {
  await withSite(context, { completed: ["negocio"] });
  await page.goto(`/criar/${SITE}/contato`);
  await expect(page).toHaveURL(step("marca"));
});

test("a site of another account is not found", async ({ page, context }) => {
  await withSite(context);
  await page.goto("/criar/00000000-0000-4000-8000-000000000000/negocio");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site não encontrado");
});

test("old addresses of the form lead to the new one", async ({ page }) => {
  await page.goto("/criar/negocio");
  await expect(page).toHaveURL(/\/cadastro\?voltar=%2Fcriar$/);
});

test("the description gets a gentle, optional nudge for more detail (E41)", async ({
  page,
  context,
}) => {
  await withSite(context, { draft: { business: { category: "padaria" } } });
  await page.goto(`/criar/${SITE}/negocio`);
  await expect(page.getByText(/Quanto mais você escrever, melhor fica o seu site/)).toBeVisible();
  await page.getByText("Ver um exemplo").click();
  await expect(page.getByText(/Padaria de bairro desde 1998/)).toBeVisible();
  const field = page.getByLabel("Conte em poucas palavras o que você faz");
  await field.fill("Padaria.");
  await expect(
    page.getByText(/Dá para contar um pouco mais: Qual é o produto mais pedido\?/),
  ).toBeVisible();
  await field.fill(
    "Padaria de bairro desde 1998, com pão de fermentação natural toda manhã, bolo de fubá da receita da avó, café passado na hora e encomendas de bolos e salgados para festas e aniversários. Fica na praça da matriz, aberta todo dia.",
  );
  await expect(page.getByText("Isso ajuda muito.")).toBeVisible();
  await expect(page.getByText(/Dá para contar um pouco mais/)).toHaveCount(0);
  // Each story question asks for a concrete detail.
  await expect(page.getByText("Ex.: o nome do produto ou do serviço campeão.")).toBeVisible();
});

test("the photos card says what makes a site the client's own (E41)", async ({ page, context }) => {
  await withSite(context, { draft: padaria, completed: ["negocio", "marca", "secoes"] });
  await page.goto(`/criar/${SITE}/conteudo`);
  await expect(
    page.getByText(/Fotos reais deixam o site com a sua cara\. Use fotos do seu espaço/),
  ).toBeVisible();
});
